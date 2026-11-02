const roomRepo = require("../repositories/room.repository");
const rooms = require("../services/room.service");
const availability = require("../services/availability.service");

// Fields a manager or staff member may change on a room. Status is worked
// out from check-ins, and the id never changes.
const EDITABLE_FIELDS = ["type", "price", "description", "image"];

// Optional filters: floor, type, status, guests. With checkIn and checkOut
// (YYYY-MM-DD) every room also says whether it is free for that whole stay
// and what the stay would cost.
function getAll(req, res) {
	const { floor, type, status, guests, checkIn, checkOut, accessible } = req.query;
	let list = rooms.getRooms();
	if (floor) list = list.filter((r) => r.floor == floor);
	if (type) list = list.filter((r) => r.type === type);
	if (status) list = list.filter((r) => r.status === status);
	if (guests) list = list.filter((r) => r.maxGuests >= Number(guests));
	if (accessible === "1" || accessible === "true") list = list.filter((r) => r.accessible);

	if (checkIn || checkOut) {
		const invalid = availability.validateStay(checkIn, checkOut);
		if (invalid) return res.status(400).json({ error: invalid });
		const free = new Set(
			availability.findAvailableRooms({ checkIn, checkOut }).map((r) => r.id),
		);
		const nights = availability.nightsBetween(checkIn, checkOut);
		list = list.map((r) => ({
			...r,
			freeForStay: free.has(r.id),
			nights,
			stayTotal: nights * r.price,
		}));
	}
	res.json(list);
}

function getOne(req, res) {
	const room = rooms.getRoom(req.params.id);
	if (!room) return res.status(404).json({ error: "Room not found" });
	res.json(room);
}

function addRoom(req, res) {
	const { id, floor, type, price, description } = req.body;
	if (!id || !floor || !type || !price)
		return res
			.status(400)
			.json({ error: "id, floor, type, and price are required" });
	if (parsePrice(price) === null) return res.status(400).json({ error: PRICE_ERROR });
	if (roomRepo.findById(String(id)))
		return res.status(409).json({ error: "A room with that id already exists" });
	const room = {
		id: String(id),
		floor: Number(floor),
		type,
		price: parsePrice(price),
		description: description || "",
		image: "",
	};
	roomRepo.add(room);
	res.status(201).json(rooms.withStatus(room));
}

// Nightly prices are whole dollars from $1 to $10,000. Returns the price as a
// number, or null when it isn't valid.
const PRICE_ERROR = "Price must be a whole number of dollars between $1 and $10,000";
function parsePrice(value) {
	const n =
		typeof value === "number" ? value
		: typeof value === "string" && value.trim() !== "" ? Number(value)
		: NaN;
	return Number.isInteger(n) && n >= 1 && n <= 10000 ? n : null;
}

function updateRoom(req, res) {
	const changes = {};
	for (const field of EDITABLE_FIELDS)
		if (req.body?.[field] !== undefined) changes[field] = req.body[field];
	if (changes.price !== undefined) {
		changes.price = parsePrice(changes.price);
		if (changes.price === null) return res.status(400).json({ error: PRICE_ERROR });
	}
	if (!roomRepo.update(req.params.id, changes))
		return res.status(404).json({ error: "Room not found" });
	res.json(rooms.getRoom(req.params.id));
}

// Sets one price for every room on a floor
function updateFloorPrice(req, res) {
	const price = parsePrice(req.body?.price);
	if (price === null) return res.status(400).json({ error: PRICE_ERROR });
	const floor = Number(req.params.floor);
	const updated = roomRepo.updateMany((r) => r.floor === floor, { price });
	if (!updated.length)
		return res.status(404).json({ error: "No rooms on that floor" });
	res.json(updated.map((r) => rooms.getRoom(r.id)));
}

function deleteRoom(req, res) {
	if (!roomRepo.findById(req.params.id))
		return res.status(404).json({ error: "Room not found" });
	roomRepo.remove(req.params.id);
	res.json({ message: "Room deleted" });
}

module.exports = { getAll, getOne, addRoom, updateRoom, updateFloorPrice, deleteRoom };
