const bookingRepo = require("../repositories/booking.repository");
const roomRepo = require("../repositories/room.repository");

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
	const room = roomRepo.findById(roomId);
	if (!room) return res.status(404).json({ error: "Room not found" });
	if (room.status !== "available")
		return res.status(409).json({ error: "Room is not available" });
	const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / 86400000);
	if (nights < 1)
		return res.status(400).json({ error: "Check-out must be after check-in" });
	const booking = {
		id: "b" + Date.now(),
		userId: req.user.id,
		userName: req.user.name,
		roomId,
		roomType: room.type,
		floor: room.floor,
		checkIn,
		checkOut,
		nights,
		total: nights * room.price,
		status: "pending",
		createdAt: new Date().toISOString(),
	};
	bookingRepo.save(booking);
	roomRepo.update(roomId, { status: "occupied" });
	res.status(201).json(booking);
}

function updateStatus(req, res) {
	const { status } = req.body;
	const allowed = ["pending", "confirmed", "cancelled", "checked-out"];
	if (!allowed.includes(status))
		return res.status(400).json({ error: "Invalid status" });
	const booking = bookingRepo.update(req.params.id, { status });
	if (!booking) return res.status(404).json({ error: "Booking not found" });
	if (status === "cancelled" || status === "checked-out")
		roomRepo.update(booking.roomId, { status: "available" });
	res.json(booking);
}

module.exports = { getAll, create, updateStatus };
