const fs = require("fs");
const { dataFile } = require("../config/paths");
const { dataChanged } = require("../services/events.service");
const FILE = dataFile("reviews.json");

function getAll() {
	return JSON.parse(fs.readFileSync(FILE, "utf8"));
}

function add(review) {
	const reviews = getAll();
	reviews.push(review);
	fs.writeFileSync(FILE, JSON.stringify(reviews, null, 2));
	dataChanged("reviews");
	return review;
}

module.exports = { getAll, add };
