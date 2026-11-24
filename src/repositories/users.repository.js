// ===== BÀI LÀM: users.repository =====
// SQL của bảng users. Giữ nguyên tên hàm và tham số; passwordHash chỉ dùng trong máy chủ, không bao giờ ra response.
const pool = require("../db/pool");

// TODO: trả người dùng { id, email, passwordHash, fullName, role } hoặc null
async function findByEmail(email) {
  const [rows] = await pool.query(
    "SELECT id, email, password_hash, full_name, role FROM users WHERE email = ?",
    [email.trim().toLowerCase()]
  );
  if (rows.length === 0) return null;
  const user = rows[0];
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.password_hash,
    fullName: user.full_name,
    role: user.role,
  };
}

// TODO: trả người dùng { id, email, passwordHash, fullName, role } hoặc null
async function findById(id) {
  const [rows] = await pool.query(
    "SELECT id, email, password_hash, full_name, role FROM users WHERE id = ?",
    [id]
  );
  if (rows.length === 0) return null;
  const user = rows[0];
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.password_hash,
    fullName: user.full_name,
    role: user.role,
  };
}

// TODO: thêm người dùng mới (vai trò customer) rồi trả về người dùng vừa tạo
async function create({ email, passwordHash, fullName }) {
  const [result] = await pool.query(
    "INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, 'customer')",
    [email.trim().toLowerCase(), passwordHash, fullName]
  );
  return {
    id: result.insertId,
    email: email.trim().toLowerCase(),
    passwordHash,
    fullName,
    role: "customer",
  };
}

module.exports = { findByEmail, findById, create };
