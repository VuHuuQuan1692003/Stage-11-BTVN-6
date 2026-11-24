// ===== BÀI LÀM: authorize =====
// TODO: authorize(...roles) trả về middleware; vai trò của req.user không nằm trong roles thì chuyển httpError 403
const httpError = require("../errors/httpError");

function authorize(...roles) {
  return function checkRole(req, res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(httpError(403, "FORBIDDEN", "Bạn không có quyền thực hiện thao tác này"));
    }
    next();
  };
}

module.exports = authorize;
