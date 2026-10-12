const express = require("express");
const shifts = require("../services/shift.service");
const { authenticate, requireRole } = require("../middleware/auth.middleware");
const router = express.Router();

// Returns shifts belonging to the logged-in staff member
router.get("/mine", authenticate, requireRole("staff", "manager"), (req, res) => {
	const mine = shifts.getShifts().filter((s) => s.staffId === req.user.id);
	res.json(mine);
});

// Where the signed-in staff member is in today's shift (New Zealand time),
// with exact start/end times so the page's countdown is accurate anywhere
router.get("/status", authenticate, requireRole("staff", "manager"), (req, res) => {
	res.json({ ...shifts.shiftStatus(req.user.id), serverNow: Date.now() });
});

module.exports = router;
