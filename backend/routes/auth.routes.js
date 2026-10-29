const express = require("express");
const { register, login, forgotPassword, resetPassword } = require("../controllers/auth.controller");
const { authenticate } = require("../middleware/auth.middleware");
const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/forgot", forgotPassword);
router.post("/reset", resetPassword);
// Lets the frontend check whether a stored token is still valid
router.get("/verify", authenticate, (req, res) => {
	res.json({ id: req.user.id, name: req.user.name, role: req.user.role });
});

module.exports = router;
