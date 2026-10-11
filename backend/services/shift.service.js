const referenceRepo = require("../repositories/reference.repository");
const { today } = require("./availability.service");

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// shifts.json holds a weekly rota: each entry lists the days someone works,
// e.g. { staffId, days: ["Monday", "Tuesday"], shiftStart, shiftEnd, shiftType }.
// This turns it into dated shifts for the current week (Monday to Sunday),
// marked "completed", "active" (today) or "upcoming", so the data never
// goes out of date.
function getShifts() {
	const todayStr = today();
	const now = new Date();
	const monday = new Date(now);
	monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));

	return referenceRepo.getShifts().flatMap((entry) => {
		if (!entry.days) return [entry]; // a one-off shift with its own date
		return entry.days.map((day) => {
			const date = new Date(monday);
			date.setDate(monday.getDate() + ((WEEKDAYS.indexOf(day) + 6) % 7));
			const dateStr = date.toLocaleDateString("en-CA");
			const { days, ...shift } = entry;
			return {
				...shift,
				id: `${entry.id}-${dateStr}`,
				date: dateStr,
				status: dateStr < todayStr ? "completed" : dateStr === todayStr ? "active" : "upcoming",
			};
		});
	});
}

module.exports = { getShifts };
