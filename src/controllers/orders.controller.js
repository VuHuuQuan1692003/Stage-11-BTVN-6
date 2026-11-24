// ===== BÀI LÀM: orders.controller =====
// Giữ nguyên tên hàm; userId của đơn luôn lấy từ req.user, không lấy từ thân yêu cầu.
const repository = require("../repositories/orders.repository");
const httpError = require("../errors/httpError");

// TODO: POST /orders, trả 201 và đơn vừa tạo (đọc lại bằng repository.findById)
async function createOrder(req, res) {
  const orderId = await repository.createOrder(req.user.id, req.body.items);
  const order = await repository.findById(orderId);
  res.status(201).json(order);
}

// TODO: GET /orders, trả { data, meta: { page, limit, total, totalPages } }; khách chỉ thấy đơn của mình
async function listOrders(req, res) {
  const filters = {
    page: req.query.page,
    limit: req.query.limit,
    status: req.query.status,
  };

  if (req.user.role === "customer") {
    filters.userId = req.user.id;
  } else if (req.query.userId) {
    filters.userId = req.query.userId;
  }

  const [data, total] = await Promise.all([
    repository.findAll(filters),
    repository.count(filters),
  ]);

  const page = filters.page || 1;
  const limit = filters.limit || 5;
  const totalPages = Math.ceil(total / limit) || 0;

  res.status(200).json({
    data,
    meta: {
      page,
      limit,
      total,
      totalPages,
    },
  });
}

// TODO: GET /orders/:id, 404 khi không có đơn, 403 khi không phải chủ đơn và không phải admin
async function getOrder(req, res) {
  const order = await repository.findById(req.params.id);
  if (!order) {
    throw httpError(404, "NOT_FOUND", "Không tìm thấy đơn hàng");
  }

  if (req.user.role !== "admin" && order.userId !== req.user.id) {
    throw httpError(403, "FORBIDDEN", "Bạn không có quyền thực hiện thao tác này");
  }

  res.status(200).json(order);
}

// TODO: PATCH /orders/:id/status, trả đơn sau khi sửa hoặc 404 khi không có đơn
async function updateOrderStatus(req, res) {
  const order = await repository.updateStatus(req.params.id, req.body.status);
  if (!order) {
    throw httpError(404, "NOT_FOUND", "Không tìm thấy đơn hàng");
  }

  res.status(200).json(order);
}

module.exports = { createOrder, listOrders, getOrder, updateOrderStatus };
