const fs = require("fs");
const { dataFile } = require("../config/paths");

// Read-only data files that have no write paths in the app
function read(name) {
	return JSON.parse(fs.readFileSync(dataFile(name), "utf8"));
}

function getReviews() {
	return read("reviews.json");
}
function getAmenities(roomId) {
	const found = read("amenities.json").find((a) => a.roomId === roomId);
	return found ? found.amenities : [];
}
// Room content per floor (size, view, story, photos) plus the accessible
// room features - see data/tiers.json
function getTiers() {
	try {
		return read("tiers.json");
	} catch {
		return { floors: {}, accessibleFeatures: [] };
	}
}
function getShifts() {
	return read("shifts.json");
}

module.exports = { getReviews, getAmenities, getShifts, getTiers };
