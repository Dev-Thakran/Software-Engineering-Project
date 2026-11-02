const fs = require("fs");
const { dataFile } = require("../config/paths");
const { dataChanged } = require("../services/events.service");
const FILE = dataFile("rooms.json");

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
	dataChanged("rooms");
	return rooms[idx];
}

// Applies the same changes to every room that matches, in one save
function updateMany(matches, changes) {
	const rooms = getAll();
	const updated = [];
	rooms.forEach((room, i) => {
		if (!matches(room)) return;
		rooms[i] = { ...room, ...changes };
		updated.push(rooms[i]);
	});
	if (updated.length) {
		fs.writeFileSync(FILE, JSON.stringify(rooms, null, 2));
		dataChanged("rooms");
	}
	return updated;
}

function add(room) {
	const rooms = getAll();
	rooms.push(room);
	fs.writeFileSync(FILE, JSON.stringify(rooms, null, 2));
	dataChanged("rooms");
	return room;
}

function remove(id) {
	const rooms = getAll().filter((r) => r.id !== id);
	fs.writeFileSync(FILE, JSON.stringify(rooms, null, 2));
	dataChanged("rooms");
}

module.exports = { getAll, findById, update, updateMany, add, remove };
