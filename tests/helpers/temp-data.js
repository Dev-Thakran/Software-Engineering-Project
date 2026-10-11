// Points the backend at a fresh temporary copy of backend/data so tests
// never modify the real data files. Require this before any backend module.
const fs = require("fs");
const os = require("os");
const path = require("path");

const source = path.join(__dirname, "../../backend/data");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hotel-test-data-"));
fs.cpSync(source, dir, { recursive: true });
process.env.DATA_DIR = dir;

// Overwrites one data file in the temporary copy
function writeData(name, data) {
	fs.writeFileSync(path.join(dir, name), JSON.stringify(data, null, 2));
}

function readData(name) {
	return JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
}

module.exports = { dir, writeData, readData };
