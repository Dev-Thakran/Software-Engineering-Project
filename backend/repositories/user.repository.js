const fs = require("fs");
const { dataFile } = require("../config/paths");
const { dataChanged } = require("../services/events.service");
const FILE = dataFile("users.json");

function getAll() {
	return JSON.parse(fs.readFileSync(FILE, "utf8"));
}
function findByEmail(email) {
	return getAll().find((u) => u.email === email);
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

module.exports = { getAll, findByEmail, findById, save };
