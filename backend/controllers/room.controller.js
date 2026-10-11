const roomRepo = require("../repositories/room.repository");
const rooms = require("../services/room.service");

// Fields a manager or staff member may change on a room. Status is worked
// out from check-ins, and the id never changes.
const EDITABLE_FIELDS = ["type", "price", "description", "image"];

function getAll(req, res) {
	const { floor, type, status } = req.query;
	let list = rooms.getRooms();
	if (floor) list = list.filter((r) => r.floor == floor);
	if (type) list = list.filter((r) => r.type === type);
	if (status) list = list.filter((r) => r.status === status);
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
	if (roomRepo.findById(String(id)))
		return res.status(409).json({ error: "A room with that id already exists" });
	const room = {
		id: String(id),
		floor: Number(floor),
		type,
		price: Number(price),
		description: description || "",
		image: "",
	};
	roomRepo.add(room);
	res.status(201).json(rooms.withStatus(room));
}

function updateRoom(req, res) {
	const changes = {};
	for (const field of EDITABLE_FIELDS)
		if (req.body?.[field] !== undefined) changes[field] = req.body[field];
	if (changes.price !== undefined) {
		changes.price = Number(changes.price);
		if (!(changes.price > 0))
			return res.status(400).json({ error: "Price must be a positive number" });
	}
	if (!roomRepo.update(req.params.id, changes))
		return res.status(404).json({ error: "Room not found" });
	res.json(rooms.getRoom(req.params.id));
}

function deleteRoom(req, res) {
	if (!roomRepo.findById(req.params.id))
		return res.status(404).json({ error: "Room not found" });
	roomRepo.remove(req.params.id);
	res.json({ message: "Room deleted" });
}

module.exports = { getAll, getOne, addRoom, updateRoom, deleteRoom };
