const bookingRepo = require("../repositories/booking.repository");
const roomRepo = require("../repositories/room.repository");
const userRepo = require("../repositories/user.repository");
const availability = require("../services/availability.service");

function getAll(req, res) {
	// Staff and managers see all bookings; customers see only their own
	const bookings =
		req.user.role === "customer"
			? bookingRepo.findByUser(req.user.id)
			: bookingRepo.getAll();
	res.json(bookings);
}

function create(req, res) {
	const { roomId, checkIn, checkOut } = req.body;
	if (!roomId || !checkIn || !checkOut)
		return res
			.status(400)
			.json({ error: "roomId, checkIn, and checkOut are required" });
	const invalid = availability.validateStay(checkIn, checkOut);
	if (invalid) return res.status(400).json({ error: invalid });
	const room = roomRepo.findById(roomId);
	if (!room) return res.status(404).json({ error: "Room not found" });
	if (!availability.isRoomFree(roomId, checkIn, checkOut))
		return res
			.status(409)
			.json({ error: "Room is already booked for those dates" });
	const nights = availability.nightsBetween(checkIn, checkOut);
	const booking = {
		id: "b" + Date.now(),
		userId: req.user.id,
		userName: req.user.name,
		guestEmail: userRepo.findById(req.user.id)?.email || "",
		roomId,
		roomType: room.type,
		floor: room.floor,
		checkIn,
		checkOut,
		nights,
		total: nights * room.price,
		status: "booked",
		createdAt: new Date().toISOString(),
	};
	bookingRepo.save(booking);
	res.status(201).json(booking);
}

// Staff and managers can cancel a booking that hasn't checked in yet.
// Check-out goes through /checkins so the room is freed correctly.
function updateStatus(req, res) {
	const { status } = req.body;
	if (status !== "cancelled")
		return res.status(400).json({ error: "Invalid status" });
	const existing = bookingRepo.findById(req.params.id);
	if (!existing) return res.status(404).json({ error: "Booking not found" });
	if (existing.status !== "booked")
		return res
			.status(409)
			.json({ error: "Only bookings awaiting check-in can be cancelled" });
	res.json(bookingRepo.update(existing.id, { status }));
}

module.exports = { getAll, create, updateStatus };
