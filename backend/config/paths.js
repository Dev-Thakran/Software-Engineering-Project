const path = require("path");

// Folder holding the JSON datastore. Tests point DATA_DIR at a temporary
// copy so they never modify the real data files.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "../data");

function dataFile(name) {
	return path.join(DATA_DIR, name);
}

module.exports = { DATA_DIR, dataFile };
