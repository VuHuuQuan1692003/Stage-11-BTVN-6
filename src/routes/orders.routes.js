// ===== BÀI LÀM: orders.routes =====
// TODO: POST /, GET /, GET /:id, PATCH /:id/status (xem đề về quyền và thứ tự middleware)
const express = require("express");
const asyncHandler = require("../middlewares/asyncHandler");
const validate = require("../middlewares/validate");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const controller = require("../controllers/orders.controller");
const {
  createOrderSchema,
  listOrdersQuerySchema,
  orderIdParamSchema,
  updateOrderStatusSchema,
} = require("../schemas/order.schema");

const router = express.Router();

router.post(
  "/",
  authenticate,
  authorize("customer"),
  validate(createOrderSchema, "body"),
  asyncHandler(controller.createOrder)
);

router.get(
  "/",
  authenticate,
  validate(listOrdersQuerySchema, "query"),
  asyncHandler(controller.listOrders)
);

router.get(
  "/:id",
  authenticate,
  validate(orderIdParamSchema, "params"),
  asyncHandler(controller.getOrder)
);

router.patch(
  "/:id/status",
  authenticate,
  authorize("admin"),
  validate(orderIdParamSchema, "params"),
  validate(updateOrderStatusSchema, "body"),
  asyncHandler(controller.updateOrderStatus)
);

module.exports = router;
