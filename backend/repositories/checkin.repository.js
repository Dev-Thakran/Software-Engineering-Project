const fs = require("fs");
const { dataFile } = require("../config/paths");
const { dataChanged } = require("../services/events.service");
const FILE = dataFile("checkins.json");

function getAll() {
	return JSON.parse(fs.readFileSync(FILE, "utf8"));
}
function findById(id) {
	return getAll().find((c) => c.id === id);
}

function save(checkin) {
	const checkins = getAll();
	checkins.push(checkin);
	fs.writeFileSync(FILE, JSON.stringify(checkins, null, 2));
	dataChanged("checkins");
	return checkin;
}

function update(id, changes) {
	const checkins = getAll();
	const idx = checkins.findIndex((c) => c.id === id);
	if (idx === -1) return null;
	checkins[idx] = { ...checkins[idx], ...changes };
	fs.writeFileSync(FILE, JSON.stringify(checkins, null, 2));
	dataChanged("checkins");
	return checkins[idx];
}

function remove(id) {
	const checkins = getAll().filter((c) => c.id !== id);
	fs.writeFileSync(FILE, JSON.stringify(checkins, null, 2));
	dataChanged("checkins");
}

module.exports = { getAll, findById, save, update, remove };
