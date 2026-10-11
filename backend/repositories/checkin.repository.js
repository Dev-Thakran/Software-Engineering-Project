const fs = require("fs");
const { dataFile } = require("../config/paths");
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
	return checkin;
}

function update(id, changes) {
	const checkins = getAll();
	const idx = checkins.findIndex((c) => c.id === id);
	if (idx === -1) return null;
	checkins[idx] = { ...checkins[idx], ...changes };
	fs.writeFileSync(FILE, JSON.stringify(checkins, null, 2));
	return checkins[idx];
}

module.exports = { getAll, findById, save, update };
