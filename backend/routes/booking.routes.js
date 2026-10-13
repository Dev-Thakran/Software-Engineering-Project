const express = require("express");
const ctrl = require("../controllers/booking.controller");
const { authenticate, requireRole } = require("../middleware/auth.middleware");
const router = express.Router();

router.get("/", authenticate, ctrl.getAll);
router.post("/", authenticate, requireRole("customer"), ctrl.create);
router.patch(
	"/:id",
	authenticate,
	requireRole("customer", "staff", "manager"), // customers: their own only
	ctrl.updateStatus,
);

module.exports = router;
