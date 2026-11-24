// ===== BÀI LÀM: auth.schema =====
// Luật dữ liệu vào cho đăng ký và đăng nhập, viết bằng zod. Giữ nguyên hai tên xuất.
const { z } = require("zod");

// TODO: email (bỏ khoảng trắng, chữ thường), password (8 đến 72 ký tự), fullName; trường role do client gửi phải bị bỏ đi
const registerSchema = z.object({
  email: z.string({ required_error: "Email là bắt buộc" }).trim().toLowerCase().email("Email không hợp lệ"),
  password: z
    .string({ required_error: "Mật khẩu là bắt buộc" })
    .min(8, "Mật khẩu phải từ 8 đến 72 ký tự")
    .max(72, "Mật khẩu phải từ 8 đến 72 ký tự"),
  fullName: z.string({ required_error: "Họ và tên là bắt buộc" }).min(1, "Họ và tên là bắt buộc"),
});

// TODO: email và password bắt buộc
const loginSchema = z.object({
  email: z.string({ required_error: "Email là bắt buộc" }).trim().toLowerCase().email("Email không hợp lệ"),
  password: z.string({ required_error: "Mật khẩu là bắt buộc" }).min(1, "Mật khẩu là bắt buộc"),
});

module.exports = { registerSchema, loginSchema };
