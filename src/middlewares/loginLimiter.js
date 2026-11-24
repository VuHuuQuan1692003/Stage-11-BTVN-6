// ===== BÀI LÀM: loginLimiter =====
// TODO: dùng express-rate-limit: tối đa 5 yêu cầu mỗi 15 phút cho mỗi IP; vượt thì chuyển httpError 429 RATE_LIMITED
const rateLimit = require("express-rate-limit");
const httpError = require("../errors/httpError");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(httpError(429, "RATE_LIMITED", "Quá nhiều yêu cầu, hãy thử lại sau"));
  },
});

module.exports = loginLimiter;
