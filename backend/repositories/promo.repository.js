const fs = require("fs");
const { dataFile } = require("../config/paths");
const { today } = require("../services/availability.service");

// Promo codes live in promos.json - edit that file to add or end a code.
// Each: { code, percent, label, active, validFrom, validTo } (dates YYYY-MM-DD)
function getAll() {
	try {
		return JSON.parse(fs.readFileSync(dataFile("promos.json"), "utf8"));
	} catch {
		return [];
	}
}

// The promo for a code if it can be used today, otherwise null.
// Codes are matched without regard to letter case or spaces.
function findUsable(code) {
	const wanted = String(code ?? "").trim().toUpperCase();
	if (!wanted) return null;
	const date = today();
	const promo = getAll().find((p) => String(p.code).toUpperCase() === wanted);
	if (!promo || !promo.active) return null;
	if (promo.validFrom && date < promo.validFrom) return null;
	if (promo.validTo && date > promo.validTo) return null;
	const percent = Number(promo.percent);
	if (!(percent > 0 && percent < 100)) return null;
	return { code: String(promo.code).toUpperCase(), percent, label: promo.label || "" };
}

module.exports = { getAll, findUsable };
