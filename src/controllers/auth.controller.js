// ===== BÀI LÀM: auth.controller =====
// Giữ nguyên tên hàm; không bao giờ trả passwordHash trong response.
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../config/env");
const httpError = require("../errors/httpError");
const usersRepo = require("../repositories/users.repository");

// TODO: POST /auth/register, trả 201 và người dùng công khai { id, email, fullName, role }
async function register(req, res) {
  const { email, password, fullName } = req.body;
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await usersRepo.findByEmail(normalizedEmail);
  if (existing) {
    throw httpError(409, "CONFLICT", "Email đã được đăng ký");
  }

  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  const user = await usersRepo.create({
    email: normalizedEmail,
    passwordHash,
    fullName,
  });

  res.status(201).json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  });
}

// TODO: POST /auth/login, trả 200 { token, user }
async function login(req, res) {
  const { email, password } = req.body;
  const normalizedEmail = email.trim().toLowerCase();

  const user = await usersRepo.findByEmail(normalizedEmail);
  if (!user) {
    throw httpError(401, "UNAUTHORIZED", "Email hoặc mật khẩu không đúng");
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw httpError(401, "UNAUTHORIZED", "Email hoặc mật khẩu không đúng");
  }

  const token = jwt.sign(
    { sub: String(user.id), role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  res.status(200).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    },
  });
}

// TODO: GET /auth/me, trả người dùng công khai của chính mình
async function me(req, res) {
  const user = await usersRepo.findById(req.user.id);
  if (!user) {
    throw httpError(401, "UNAUTHORIZED", "Thiếu hoặc sai mã xác thực");
  }

  res.status(200).json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  });
}

module.exports = { register, login, me };
