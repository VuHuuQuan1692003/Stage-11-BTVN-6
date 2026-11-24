// ===== BÀI LÀM: auth.routes =====
// TODO: POST /register, POST /login (công khai, có validate) và GET /me (cần authenticate)
const express = require("express");
const asyncHandler = require("../middlewares/asyncHandler");
const validate = require("../middlewares/validate");
const authenticate = require("../middlewares/authenticate");
const loginLimiter = require("../middlewares/loginLimiter");
const controller = require("../controllers/auth.controller");
const { registerSchema, loginSchema } = require("../schemas/auth.schema");

const router = express.Router();

router.post("/register", validate(registerSchema, "body"), asyncHandler(controller.register));
router.post("/login", loginLimiter, validate(loginSchema, "body"), asyncHandler(controller.login));
router.get("/me", authenticate, asyncHandler(controller.me));

module.exports = router;
