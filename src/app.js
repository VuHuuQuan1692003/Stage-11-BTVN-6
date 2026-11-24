// ===== BÀI LÀM: lắp ráp ứng dụng =====
// Hiện chỉ có phần của Bài 5. TODO: thêm lớp bảo vệ, giới hạn đăng nhập và gắn router /auth, /orders (xem đề, thứ tự middleware rất quan trọng)
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const config = require("./config/env");

const notFound = require("./middlewares/notFound");
const errorHandler = require("./middlewares/errorHandler");
const productsRouter = require("./routes/products.routes");
const authRouter = require("./routes/auth.routes");
const ordersRouter = require("./routes/orders.routes");

const app = express();

app.use(helmet());
app.use(cors({ origin: ["http://localhost:5173"] }));

if (config.nodeEnv !== "test") {
  app.use(morgan("dev"));
}

app.use(express.json());

// Kiểm tra máy chủ còn sống
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/products", productsRouter);
app.use("/auth", authRouter);
app.use("/orders", ordersRouter);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
