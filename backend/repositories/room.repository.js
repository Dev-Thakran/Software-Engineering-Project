const fs = require("fs");
const path = require("path");
const FILE = path.join(__dirname, "../data/rooms.json");

function getAll() {
	return JSON.parse(fs.readFileSync(FILE, "utf8"));
}
function findById(id) {
	return getAll().find((r) => r.id === id);
}

function update(id, changes) {
	const rooms = getAll();
	const idx = rooms.findIndex((r) => r.id === id);
	if (idx === -1) return null;
	rooms[idx] = { ...rooms[idx], ...changes };
	fs.writeFileSync(FILE, JSON.stringify(rooms, null, 2));
	return rooms[idx];
}

function add(room) {
	const rooms = getAll();
	rooms.push(room);
	fs.writeFileSync(FILE, JSON.stringify(rooms, null, 2));
	return room;
}

function remove(id) {
	const rooms = getAll().filter((r) => r.id !== id);
	fs.writeFileSync(FILE, JSON.stringify(rooms, null, 2));
}

module.exports = { getAll, findById, update, add, remove };
