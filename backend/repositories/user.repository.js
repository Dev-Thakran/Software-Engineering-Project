const fs = require("fs");
const { dataFile } = require("../config/paths");
const { dataChanged } = require("../services/events.service");
const FILE = dataFile("users.json");

function getAll() {
	return JSON.parse(fs.readFileSync(FILE, "utf8"));
}
// Emails are matched without regard to letter case or surrounding spaces
const normalise = (email) => String(email ?? "").trim().toLowerCase();
function findByEmail(email) {
	const wanted = normalise(email);
	return getAll().find((u) => normalise(u.email) === wanted);
}
function findById(id) {
	return getAll().find((u) => u.id === id);
}

function save(user) {
	const users = getAll();
	users.push(user);
	fs.writeFileSync(FILE, JSON.stringify(users, null, 2));
	dataChanged("users");
}

function update(id, changes) {
	const users = getAll();
	const idx = users.findIndex((u) => u.id === id);
	if (idx === -1) return null;
	users[idx] = { ...users[idx], ...changes };
	fs.writeFileSync(FILE, JSON.stringify(users, null, 2));
	dataChanged("users");
	return users[idx];
}

module.exports = { getAll, findByEmail, findById, save, update };
