# Design Specification: Rikkei Shop Authentication, Authorization, Order APIs, and Security Layer

**Date:** 2026-11-24  
**Topic:** Rikkei Shop Auth & Orders API System (Stage 11 BTVN 6)  
**Status:** Approved by User

---

## 1. Context & Objectives

Rikkei Shop requires user authentication, role-based authorization, an order management subsystem with transactional integrity and stock restoration, and HTTP hardening layers.

### Key Goals
1. Secure account registration and login via bcrypt hashing and JWT tokens.
2. Protect `/auth/me`, `/products` modification endpoints, and `/orders` endpoints according to user roles (`admin`, `customer`).
3. Guarantee atomic order placement (existing `createOrder`) and order status transitions (`updateStatus`) with concurrent stock restoration safety.
4. Add rate limiting on `/auth/login` and HTTP security headers (Helmet, CORS) across all endpoints.
5. Pass all 45 Vitest test cases and manual verification curls.

---

## 2. Architecture & Components

```
                          Client Request
                                |
                     [Helmet & CORS Middleware]
                                |
                  [loginLimiter (POST /auth/login)]
                                |
                    [Router: /auth, /products, /orders]
                                |
                 [authenticate -> authorize -> validate]
                                |
                           [Controllers]
                                |
                          [Repositories]
                                |
                             [MySQL 8]
```

### Component Breakdown

### 2.1 Middleware
* `src/middlewares/authenticate.js`:
  * Parses header `Authorization: Bearer <token>`.
  * Verifies JWT with `config.jwtSecret`.
  * If missing, malformed, expired, or invalid signature $\rightarrow$ passes `httpError(401, "UNAUTHORIZED", "Thiếu hoặc sai mã xác thực")` to `next()`.
  * Attaches `req.user = { id: Number(payload.sub), role: payload.role }`.
* `src/middlewares/authorize.js`:
  * `authorize(...roles)` returns middleware that checks `roles.includes(req.user?.role)`.
  * If unauthorized $\rightarrow$ passes `httpError(403, "FORBIDDEN", "Bạn không có quyền thực hiện thao tác này")` to `next()`.
* `src/middlewares/loginLimiter.js`:
  * Uses `express-rate-limit`: 5 requests per 15-minute window per IP.
  * On exceed: `httpError(429, "RATE_LIMITED", "Quá nhiều yêu cầu, hãy thử lại sau")`.
* `src/app.js`:
  * Mounts `helmet()`.
  * Mounts `cors()` with origin `http://localhost:5173`, supporting methods `GET, POST, PUT, PATCH, DELETE, OPTIONS` and headers `Content-Type, Authorization`, returning 204 on `OPTIONS`.
  * Conditionally mounts `morgan("dev")` when `config.nodeEnv !== "test"`.

### 2.2 Validation Schemas (`src/schemas/`)
* `src/schemas/auth.schema.js`:
  * `registerSchema`:
    * `email`: string, trimmed, lowercase, valid email format.
    * `password`: string, min 8, max 72 characters.
    * `fullName`: string, min 1 character.
    * Any extra fields (specifically `role`) are stripped or omitted.
  * `loginSchema`:
    * `email`: string, min 1.
    * `password`: string, min 1.
* `src/schemas/order.schema.js`:
  * `createOrderSchema`:
    * `items`: array with min 1, max 20 elements.
    * Each item: `{ productId: z.number().int().positive(), quantity: z.number().int().positive() }`.
  * `listOrdersQuerySchema`:
    * `page`: coerced number, int, min 1, default 1.
    * `limit`: coerced number, int, min 1, max 50, default 5.
    * `status`: optional enum `['pending', 'paid', 'cancelled']`.
    * `userId`: optional coerced positive int.
  * `orderIdParamSchema`:
    * `id`: coerced positive int.
  * `updateOrderStatusSchema`:
    * `status`: enum `['paid', 'cancelled']`.

### 2.3 Repositories (`src/repositories/`)
* `src/repositories/users.repository.js`:
  * `findByEmail(email)`: query by lowercase email; returns `{ id, email, passwordHash: row.password_hash, fullName: row.full_name, role: row.role }` or `null`.
  * `findById(id)`: query by user id; returns `{ id, email, passwordHash: row.password_hash, fullName: row.full_name, role: row.role }` or `null`.
  * `create({ email, passwordHash, fullName })`: inserts into `users (email, password_hash, full_name, role)` with role `'customer'`. Returns created record.
* `src/repositories/orders.repository.js`:
  * `findById(id)`: queries `orders` and `order_items` joined with `products` (`SELECT product_id AS productId, name, quantity, unit_price AS unitPrice`). Returns `{ id, userId, status, total, createdAt, items }` or `null`.
  * `findAll(filters)`:
    * Dynamically constructs WHERE clause for `filters.userId` and `filters.status`.
    * Orders by `o.id DESC`.
    * Applies `LIMIT ? OFFSET ?`.
    * For each order, attaches line items.
  * `count(filters)`:
    * Counts total orders matching `userId` and `status` filters.
  * `updateStatus(id, newStatus)`:
    * Starts transaction via `connection.beginTransaction()`.
    * `SELECT status FROM orders WHERE id = ? FOR UPDATE`. If missing, returns `null`.
    * Validates allowed transitions:
      * `pending` $\rightarrow$ `paid`: valid.
      * `pending` $\rightarrow$ `cancelled`: valid (restores inventory).
      * `paid` $\rightarrow$ `cancelled`: valid (restores inventory).
      * Invalid transitions $\rightarrow$ throws `httpError(409, "CONFLICT", \`Không thể chuyển đơn hàng từ \${currentStatus} sang \${newStatus}\`)`.
    * Updates `orders SET status = ? WHERE id = ?`.
    * If `newStatus === 'cancelled'`:
      * Reads all items for this order: `SELECT product_id, quantity FROM order_items WHERE order_id = ?`.
      * Executes `UPDATE products SET stock = stock + ? WHERE id = ?`.
      * If any query throws (e.g. MySQL integer overflow limit 4294967295), rollbacks and rethrows.
    * Commits transaction, fetches updated order with items, and returns it.

### 2.4 Controllers (`src/controllers/`)
* `src/controllers/auth.controller.js`:
  * `register`: validates duplication via `findByEmail`, hashes password with `bcrypt.hash(password, config.bcryptRounds)`, calls `usersRepo.create(...)`, responds `201 { id, email, fullName, role }`.
  * `login`: validates user exists and `bcrypt.compare(password, user.passwordHash)`. If either fails $\rightarrow$ throws `httpError(401, "UNAUTHORIZED", "Email hoặc mật khẩu không đúng")`. Signs token: `jwt.sign({ sub: String(user.id), role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn })`. Responds `200 { token, user: { id, email, fullName, role } }`.
  * `me`: queries `usersRepo.findById(req.user.id)`. If `null` $\rightarrow$ throws `httpError(401, "UNAUTHORIZED", "Thiếu hoặc sai mã xác thực")`. Responds `200 { id, email, fullName, role }`.
* `src/controllers/orders.controller.js`:
  * `createOrder`: forces `userId = req.user.id`. Calls `repository.createOrder(userId, req.body.items)`. Reads back order with `findById` and returns `201`.
  * `listOrders`: if `req.user.role === 'customer'`, ignores client query `userId` and overrides with `req.user.id`. Calls `repository.findAll(...)` and `repository.count(...)`. Responds `200 { data, meta: { page, limit, total, totalPages } }`.
  * `getOrder`: calls `repository.findById(req.params.id)`. If `!order` $\rightarrow$ throws `404 "Không tìm thấy đơn hàng"`. If `req.user.role !== 'admin' && order.userId !== req.user.id` $\rightarrow$ throws `403 "Bạn không có quyền thực hiện thao tác này"`. Responds `200 order`.
  * `updateOrderStatus`: calls `repository.updateStatus(req.params.id, req.body.status)`. If `null` $\rightarrow$ throws `404 "Không tìm thấy đơn hàng"`. Responds `200 order`.

### 2.5 Route Mapping (`src/routes/`)
* `src/routes/auth.routes.js`:
  * `POST /register`: `validate(registerSchema, "body")`, `asyncHandler(register)`
  * `POST /login`: `loginLimiter`, `validate(loginSchema, "body")`, `asyncHandler(login)`
  * `GET /me`: `authenticate`, `asyncHandler(me)`
* `src/routes/products.routes.js`:
  * `GET /`: public
  * `GET /:id`: public
  * `POST /`: `authenticate`, `authorize('admin')`, `validate(createProductSchema, "body")`, `asyncHandler(controller.createProduct)`
  * `PUT /:id`: `authenticate`, `authorize('admin')`, `validate(idParamSchema, "params")`, `validate(createProductSchema, "body")`, `asyncHandler(controller.updateProduct)`
  * `PATCH /:id`: `authenticate`, `authorize('admin')`, `validate(idParamSchema, "params")`, `validate(updateProductSchema, "body")`, `asyncHandler(controller.updateProduct)`
  * `DELETE /:id`: `authenticate`, `authorize('admin')`, `validate(idParamSchema, "params")`, `asyncHandler(controller.deleteProduct)`
* `src/routes/orders.routes.js`:
  * `POST /`: `authenticate`, `authorize('customer')`, `validate(createOrderSchema, "body")`, `asyncHandler(createOrder)`
  * `GET /`: `authenticate`, `validate(listOrdersQuerySchema, "query")`, `asyncHandler(listOrders)`
  * `GET /:id`: `authenticate`, `validate(orderIdParamSchema, "params")`, `asyncHandler(getOrder)`
  * `PATCH /:id/status`: `authenticate`, `authorize('admin')`, `validate(orderIdParamSchema, "params")`, `validate(updateOrderStatusSchema, "body")`, `asyncHandler(updateOrderStatus)`

---

## 3. Error Handling Specifications

All errors return JSON structure: `{ error: { code, message, details? } }`.
- Status 400: `VALIDATION_ERROR` with `details: [{ field, message }]`.
- Status 401: `UNAUTHORIZED` (`"Thiếu hoặc sai mã xác thực"` or `"Email hoặc mật khẩu không đúng"`).
- Status 403: `FORBIDDEN` (`"Bạn không có quyền thực hiện thao tác này"`).
- Status 404: `NOT_FOUND` (`"Không tìm thấy đơn hàng"` or `"Không tìm thấy sản phẩm"`).
- Status 409: `CONFLICT` (`"Email đã được đăng ký"`, `"Không đủ hàng trong kho"`, `"Sản phẩm đã có trong đơn hàng, không thể xóa"`, `"Không thể chuyển đơn hàng từ X sang Y"`).
- Status 429: `RATE_LIMITED` (`"Quá nhiều yêu cầu, hãy thử lại sau"`).
- Status 500: `INTERNAL_ERROR` (`"Lỗi máy chủ"`).

---

## 4. Verification Plan

1. **Environment Setup & DB Migration**:
   * Verify MySQL connectivity and run `npm run db:setup`.
2. **Automated Testing**:
   * Run `npm test` against `rikkei_shop_test`.
   * Expect 45/45 tests passing across `auth.test.js`, `products.test.js`, `orders.test.js`, `rate-limit.test.js`, and `security.test.js`.
3. **Manual Testing Scenarios**:
   * Step 1: Admin login via curl (`POST /auth/login`).
   * Step 2: Register user with attempted role elevation (`POST /auth/register`).
   * Step 3: Customer places order (`POST /orders`).
   * Step 4: Cross-user access blocked (`GET /orders/3` as Lan).
   * Step 5: Admin cancels order (`PATCH /orders/5/status`) and verifies 409 on second cancel.
   * Step 6: Unauthorized `/auth/me` returns 401.
