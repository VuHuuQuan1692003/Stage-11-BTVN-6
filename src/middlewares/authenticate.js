// ===== BÀI LÀM: authenticate =====
// TODO: đọc header Authorization: Bearer <token>, kiểm tra token; hợp lệ thì gắn req.user = { id, role }, sai thì chuyển httpError 401
const jwt = require("jsonwebtoken");
const config = require("../config/env");
const httpError = require("../errors/httpError");

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
    return next(httpError(401, "UNAUTHORIZED", "Thiếu hoặc sai mã xác thực"));
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (!payload || payload.sub === undefined || payload.sub === null) {
      return next(httpError(401, "UNAUTHORIZED", "Thiếu hoặc sai mã xác thực"));
    }
    req.user = {
      id: Number(payload.sub),
      role: payload.role,
    };
    next();
  } catch (error) {
    return next(httpError(401, "UNAUTHORIZED", "Thiếu hoặc sai mã xác thực"));
  }
}

module.exports = authenticate;
