const express = require("express");
const ctrl = require("../controllers/room.controller");
const referenceRepo = require("../repositories/reference.repository");
const availability = require("../services/availability.service");
const bookingRepo = require("../repositories/booking.repository");
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

// Date ranges a room is already taken, from today on - for the calendar on
// the room page. Only dates are returned, never who booked.
router.get("/:id/booked", (req, res) => {
	const today = availability.today();
	res.json(
		bookingRepo
			.getAll()
			.filter(
				(b) =>
					b.roomId === req.params.id &&
					availability.ACTIVE_STATUSES.includes(b.status) &&
					b.checkOut > today,
			)
			.map((b) => ({ checkIn: b.checkIn, checkOut: b.checkOut }))
			.sort((a, b) => a.checkIn.localeCompare(b.checkIn)),
	);
});

router.get("/", ctrl.getAll); // public
router.get("/:id", ctrl.getOne); // public - must come after the sub-resources
router.post("/", authenticate, requireRole("manager"), ctrl.addRoom);
// Only the manager changes room details and prices
router.patch("/floors/:floor", authenticate, requireRole("manager"), ctrl.updateFloorPrice);
router.patch("/:id", authenticate, requireRole("manager"), ctrl.updateRoom);
router.delete("/:id", authenticate, requireRole("manager"), ctrl.deleteRoom);

module.exports = router;
