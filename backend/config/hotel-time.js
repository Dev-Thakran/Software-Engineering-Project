// The hotel is in Auckland, so shifts run on New Zealand time whatever time
// zone the server or the viewer's computer is set to. Daylight saving is
// handled by the built-in time zone data.
const TIME_ZONE = "Pacific/Auckland";

const parts = new Intl.DateTimeFormat("en-US", {
	timeZone: TIME_ZONE,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
	weekday: "long",
	hourCycle: "h23",
});

// The hotel's local date ("YYYY-MM-DD") and weekday at a moment in time
function hotelNow(ms = Date.now()) {
	const p = Object.fromEntries(parts.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
	return { date: `${p.year}-${p.month}-${p.day}`, weekday: p.weekday };
}

// Milliseconds between UTC and hotel time at a moment
function offsetMs(ms) {
	const p = Object.fromEntries(parts.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
	const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
	return asUtc - Math.floor(ms / 1000) * 1000;
}

// The moment (ms) when the hotel's clock shows `time` ("HH:MM") on `date`
function hotelTimeToMs(date, time) {
	const [y, m, d] = date.split("-").map(Number);
	const [h, min] = time.split(":").map(Number);
	const guess = Date.UTC(y, m - 1, d, h, min);
	const first = guess - offsetMs(guess);
	// A second pass corrects times near a daylight-saving change
	return guess - offsetMs(first);
}

// Adds whole days to a "YYYY-MM-DD" date
function addDays(date, days) {
	const [y, m, d] = date.split("-").map(Number);
	return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

module.exports = { TIME_ZONE, hotelNow, hotelTimeToMs, addDays };
