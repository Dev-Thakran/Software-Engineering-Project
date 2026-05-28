const express = require("express");
const fs = require("fs");
const path = require("path");
const { authenticate } = require("../middleware/auth.middleware");
const router = express.Router();

const CHECKINS_FILE = path.join(__dirname, "../data/checkins.json");
const BOOKINGS_FILE = path.join(__dirname, "../data/bookings.json");

function readJSON(file) {
	return JSON.parse(fs.readFileSync(file, "utf8"));
}
function writeJSON(file, data) {
	fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Today's check-in count
router.get("/today", authenticate, (req, res) => {
	const checkins = readJSON(CHECKINS_FILE);
	const today = new Date().toLocaleDateString("en-CA");
	const todays = checkins.filter((c) => c.checkInTime.split("T")[0] === today);
	res.json({ count: todays.length, checkins: todays });
});

// Guests awaiting check-in - pending bookings with today's check-in date
router.get("/queue", authenticate, (req, res) => {
	const bookings = readJSON(BOOKINGS_FILE);
	const today = new Date().toLocaleDateString("en-CA");
	const queue = bookings.filter(
		(b) => b.checkIn === today && b.status === "booked",
	);
	res.json({ count: queue.length, bookings: queue });
});

// Currently in residence - checked-in entries
router.get("/residence", authenticate, (req, res) => {
	const checkins = readJSON(CHECKINS_FILE);
	const inRes = checkins.filter((c) => c.status === "staying");
	res.json(inRes);
});

// Check in a guest - moves booking into checkins.json as checked-in
router.post("/checkin/:bookingId", authenticate, (req, res) => {
	const bookings = readJSON(BOOKINGS_FILE);
	const checkins = readJSON(CHECKINS_FILE);

	const idx = bookings.findIndex((b) => b.id === req.params.bookingId);
	if (idx === -1) return res.status(404).json({ error: "Booking not found" });

	const booking = bookings[idx];

	// Update booking status to confirmed
	bookings[idx].status = "staying";
	writeJSON(BOOKINGS_FILE, bookings);

	// Create a new checkin entry
	const newCheckin = {
		id: "ci" + Date.now(),
		bookingId: booking.id,
		userId: booking.userId,
		guestName: booking.userName,
		guestEmail: booking.guestEmail || "",
		roomId: booking.roomId,
		roomType: booking.roomType,
		floor: booking.floor,
		checkInTime: new Date().toISOString(),
		checkOutDate: booking.checkOut,
		total: booking.total,
		status: "staying",
		attendingStaff: req.user.name,
		handledBy: req.user.id,
	};

	checkins.push(newCheckin);
	writeJSON(CHECKINS_FILE, checkins);

	res.json(newCheckin);
});

// Check out a guest - marks checkin and booking as checked-out
router.post("/checkout/:checkinId", authenticate, (req, res) => {
	const checkins = readJSON(CHECKINS_FILE);
	const bookings = readJSON(BOOKINGS_FILE);

	const cidx = checkins.findIndex((c) => c.id === req.params.checkinId);
	if (cidx === -1) return res.status(404).json({ error: "Checkin not found" });

	// Mark checkin as checked-out
	checkins[cidx].status = "completed";
	writeJSON(CHECKINS_FILE, checkins);

	// Mark the linked booking as checked-out too
	const bidx = bookings.findIndex((b) => b.id === checkins[cidx].bookingId);
	if (bidx !== -1) {
		bookings[bidx].status = "completed";
		writeJSON(BOOKINGS_FILE, bookings);
	}

	res.json({ message: "Checked out successfully" });
});

module.exports = router;
