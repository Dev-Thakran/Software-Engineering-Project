const express = require("express");
const checkins = require("../services/checkin.service");
const { authenticate, requireRole } = require("../middleware/auth.middleware");
const router = express.Router();

// Check-in operations are for hotel staff and managers only
router.use(authenticate, requireRole("staff", "manager"));

// Sends a service error as its HTTP status; anything else is a real failure
function handle(fn) {
	return (req, res, next) => {
		try {
			res.json(fn(req));
		} catch (err) {
			if (err.status)
				return res.status(err.status).json({ error: err.message, offShift: err.offShift });
			next(err);
		}
	};
}

// Today's check-in count
router.get(
	"/today",
	handle(() => {
		const todays = checkins.getTodaysCheckins();
		return { count: todays.length, checkins: todays };
	}),
);

// Guests awaiting check-in - bookings arriving today
router.get(
	"/queue",
	handle(() => {
		const queue = checkins.getQueue();
		return { count: queue.length, bookings: queue };
	}),
);

// Currently in residence
router.get(
	"/residence",
	handle(() => checkins.getInResidence()),
);

// Rooms waiting to be cleaned after a check-out
router.get(
	"/housekeeping",
	handle(() => checkins.getHousekeeping()),
);

router.post(
	"/housekeeping/:roomId",
	handle((req) => checkins.markClean(req.params.roomId, req.user)),
);

router.post(
	"/checkin/:bookingId",
	handle((req) => checkins.checkIn(req.params.bookingId, req.user)),
);

router.post(
	"/checkout/:checkinId",
	handle((req) => {
		checkins.checkOut(req.params.checkinId, req.user);
		return { message: "Checked out successfully" };
	}),
);

module.exports = router;
