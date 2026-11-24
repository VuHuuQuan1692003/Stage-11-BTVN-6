// ===== Mã nền (có sẵn, KHÔNG sửa) =====
// Tạo đơn hàng trong một giao dịch: hoặc trừ kho và ghi đủ orders + order_items, hoặc không đổi gì cả
const pool = require("../db/pool");
const httpError = require("../errors/httpError");

// items: [{ productId, quantity }]; trả id đơn mới (trạng thái pending)
async function createOrder(userId, items) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    let total = 0;
    const lines = [];
    for (const item of items) {
      const [rows] = await connection.execute("SELECT id, price FROM products WHERE id = ?", [item.productId]);
      if (rows.length === 0) {
        throw httpError(404, "NOT_FOUND", "Không tìm thấy sản phẩm");
      }
      // Điều kiện stock >= ? nằm trong chính câu UPDATE nên hai đơn cùng mua món cuối không thể cùng thành công
      const [updated] = await connection.execute(
        "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?",
        [item.quantity, item.productId, item.quantity]
      );
      if (updated.affectedRows === 0) {
        throw httpError(409, "CONFLICT", "Không đủ hàng trong kho");
      }
      total += rows[0].price * item.quantity;
      lines.push({ productId: item.productId, quantity: item.quantity, unitPrice: rows[0].price });
    }
    const [order] = await connection.execute(
      "INSERT INTO orders (user_id, status, total) VALUES (?, 'pending', ?)",
      [userId, total]
    );
    for (const line of lines) {
      await connection.execute(
        "INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)",
        [order.insertId, line.productId, line.quantity, line.unitPrice]
      );
    }
    await connection.commit();
    return order.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
// ===== HẾT MÃ NỀN =====

// ===== BÀI LÀM: orders.repository (đọc đơn, đổi trạng thái và hoàn kho) =====
// Đơn hàng trả ra có dạng { id, userId, status, total, createdAt, items: [{ productId, name, quantity, unitPrice }] }
// Giữ nguyên tên hàm và tham số; createOrder ở khối mã nền phía trên không được sửa.

// TODO: một đơn kèm items, hoặc null khi không có
async function findById(id) {
  const [orderRows] = await pool.query(
    "SELECT id, user_id AS userId, status, total, created_at AS createdAt FROM orders WHERE id = ?",
    [id]
  );
  if (orderRows.length === 0) return null;
  const order = orderRows[0];

  const [itemRows] = await pool.query(
    `SELECT oi.product_id AS productId, p.name, oi.quantity, oi.unit_price AS unitPrice
     FROM order_items oi
     JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = ?
     ORDER BY oi.id ASC`,
    [id]
  );

  return {
    ...order,
    items: itemRows,
  };
}

// TODO: một trang đơn hàng; filters gồm page, limit, userId và status (hai trường sau có thể vắng); đơn mới nhất đứng đầu
async function findAll(filters = {}) {
  const conditions = [];
  const params = [];
  if (filters.userId !== undefined && filters.userId !== null) {
    conditions.push("user_id = ?");
    params.push(filters.userId);
  }
  if (filters.status) {
    conditions.push("status = ?");
    params.push(filters.status);
  }

  let sql = "SELECT id, user_id AS userId, status, total, created_at AS createdAt FROM orders";
  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += " ORDER BY id DESC LIMIT ? OFFSET ?";

  const page = Number(filters.page) || 1;
  const limit = Number(filters.limit) || 5;
  const offset = (page - 1) * limit;
  params.push(limit, offset);

  const [orderRows] = await pool.query(sql, params);
  if (orderRows.length === 0) return [];

  const orderIds = orderRows.map((o) => o.id);
  const [itemRows] = await pool.query(
    `SELECT oi.order_id AS orderId, oi.product_id AS productId, p.name, oi.quantity, oi.unit_price AS unitPrice
     FROM order_items oi
     JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id IN (?)
     ORDER BY oi.id ASC`,
    [orderIds]
  );

  const itemsByOrder = {};
  for (const item of itemRows) {
    if (!itemsByOrder[item.orderId]) {
      itemsByOrder[item.orderId] = [];
    }
    const { orderId, ...rest } = item;
    itemsByOrder[orderId].push(rest);
  }

  return orderRows.map((o) => ({
    ...o,
    items: itemsByOrder[o.id] || [],
  }));
}

// TODO: tổng số đơn khớp filters (không phân trang)
async function count(filters = {}) {
  const conditions = [];
  const params = [];
  if (filters.userId !== undefined && filters.userId !== null) {
    conditions.push("user_id = ?");
    params.push(filters.userId);
  }
  if (filters.status) {
    conditions.push("status = ?");
    params.push(filters.status);
  }

  let sql = "SELECT COUNT(*) AS total FROM orders";
  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }

  const [[row]] = await pool.query(sql, params);
  return row.total;
}

// TODO: đổi trạng thái đơn trong một giao dịch, hủy đơn thì hoàn kho; trả đơn sau khi sửa, null khi không có đơn, 409 khi chuyển không hợp lệ
async function updateStatus(id, newStatus) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      "SELECT id, status FROM orders WHERE id = ? FOR UPDATE",
      [id]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return null;
    }

    const currentStatus = rows[0].status;

    const isValid =
      (currentStatus === "pending" && newStatus === "paid") ||
      (currentStatus === "pending" && newStatus === "cancelled") ||
      (currentStatus === "paid" && newStatus === "cancelled");

    if (!isValid) {
      throw httpError(
        409,
        "CONFLICT",
        `Không thể chuyển đơn hàng từ ${currentStatus} sang ${newStatus}`
      );
    }

    await connection.execute("UPDATE orders SET status = ? WHERE id = ?", [newStatus, id]);

    if (newStatus === "cancelled") {
      const [items] = await connection.execute(
        "SELECT product_id, quantity FROM order_items WHERE order_id = ? ORDER BY id ASC",
        [id]
      );
      for (const item of items) {
        await connection.execute(
          "UPDATE products SET stock = stock + ? WHERE id = ?",
          [item.quantity, item.product_id]
        );
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return await findById(id);
}

module.exports = { createOrder, findById, findAll, count, updateStatus };
