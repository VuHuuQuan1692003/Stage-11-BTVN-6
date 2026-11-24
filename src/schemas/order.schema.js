// ===== BÀI LÀM: order.schema =====
// Luật dữ liệu vào cho /orders, viết bằng zod. Giữ nguyên bốn tên xuất.
const { z } = require("zod");

// TODO: thân đặt hàng { items: [{ productId, quantity }] }, từ 1 đến 20 dòng
const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1)
    .max(20),
});

// TODO: query của GET /orders: page, limit, status và userId tùy chọn
const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(5),
  status: z.enum(["pending", "paid", "cancelled"]).optional(),
  userId: z.coerce.number().int().positive().optional(),
});

// TODO: tham số :id trên URL
const orderIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// TODO: thân PATCH /orders/:id/status { status } với status thuộc paid, cancelled
const updateOrderStatusSchema = z.object({
  status: z.enum(["paid", "cancelled"]),
});

module.exports = {
  createOrderSchema,
  listOrdersQuerySchema,
  orderIdParamSchema,
  updateOrderStatusSchema,
};
