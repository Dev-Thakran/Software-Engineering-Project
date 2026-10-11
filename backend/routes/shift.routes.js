const express = require("express");
const shifts = require("../services/shift.service");
const { authenticate, requireRole } = require("../middleware/auth.middleware");
const router = express.Router();

// Returns shifts belonging to the logged-in staff member
router.get("/mine", authenticate, requireRole("staff", "manager"), (req, res) => {
	const mine = shifts.getShifts().filter((s) => s.staffId === req.user.id);
	res.json(mine);
});

module.exports = router;
