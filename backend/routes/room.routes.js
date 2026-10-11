const express = require("express");
const ctrl = require("../controllers/room.controller");
const referenceRepo = require("../repositories/reference.repository");
const availability = require("../services/availability.service");
const { authenticate, requireRole } = require("../middleware/auth.middleware");
const router = express.Router();

// Public sub-resources - MUST be before /:id to avoid route conflicts
router.get("/:id/amenities", (req, res) => {
	res.json(referenceRepo.getAmenities(req.params.id));
});

// Whether a room is free for a stay, e.g. ?checkIn=2026-10-03&checkOut=2026-10-05
router.get("/:id/availability", (req, res) => {
	const { checkIn, checkOut } = req.query;
	const invalid = availability.validateStay(checkIn, checkOut);
	if (invalid) return res.status(400).json({ error: invalid });
	res.json({
		available: availability.isRoomFree(req.params.id, checkIn, checkOut),
	});
});

router.get("/", ctrl.getAll); // public
router.get("/:id", ctrl.getOne); // public - must come after the sub-resources
router.post("/", authenticate, requireRole("manager"), ctrl.addRoom);
router.patch(
	"/:id",
	authenticate,
	requireRole("manager", "staff"),
	ctrl.updateRoom,
);
router.delete("/:id", authenticate, requireRole("manager"), ctrl.deleteRoom);

module.exports = router;
