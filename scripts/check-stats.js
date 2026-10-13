// ============================================================
//  npm run check:stats - checks the manager dashboard's maths
//
//  Works out every dashboard number independently, straight from
//  the data files, and compares it with what the server reports.
//  Prints each check and exits with an error if any don't match.
// ============================================================

const fs = require("fs");
const { dataFile } = require("../backend/config/paths");
const stats = require("../backend/services/stats.service");

const read = (name) => JSON.parse(fs.readFileSync(dataFile(name), "utf8"));
const bookings = read("bookings.json");
const checkins = read("checkins.json");
const rooms = read("rooms.json");
const reviews = read("reviews.json");

// ---------- Independent calculations ----------
const counted = bookings.filter((b) => b.status !== "cancelled");
const occupiedRooms = new Set(checkins.filter((c) => c.status === "staying").map((c) => c.roomId)).size;
const localDate = (d) => d.toLocaleDateString("en-CA");
const today = localDate(new Date());

const sumBy = (list, key, value) =>
	list.reduce((m, x) => ((m[key(x)] = (m[key(x)] || 0) + value(x)), m), {});

const expected = {
	"Total revenue": counted.reduce((s, b) => s + b.total, 0),
	"Total bookings": counted.length,
	"Rooms occupied now": occupiedRooms,
	"Occupancy %": Math.round((occupiedRooms / rooms.length) * 100),
	"Average rating": (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1),
	"Review count": reviews.length,
	"No-shows": counted.filter((b) => b.status === "booked" && b.checkOut <= today).length,
	"Revenue by floor": sumBy(counted, (b) => "F" + b.floor, (b) => b.total),
	"Booking mix": sumBy(counted, (b) => b.roomType, () => 1),
	"Busiest room count": Math.max(...Object.values(sumBy(counted, (b) => b.roomId, () => 1))),
	"Bookings made in the last 14 days": counted.filter((b) => {
		const age = (new Date(today) - new Date(localDate(new Date(b.createdAt)))) / 86400000;
		return age >= 0 && age < 14;
	}).length,
};

// ---------- What the dashboard's server reports ----------
const overview = stats.getOverview();
const toMap = (list, key, value) => Object.fromEntries(list.map((x) => [x[key], x[value]]));
const reported = {
	"Total revenue": overview.totalRevenue,
	"Total bookings": overview.totalBookings,
	"Rooms occupied now": overview.occupiedRooms,
	"Occupancy %": overview.occupancyPct,
	"Average rating": overview.avgRating,
	"Review count": overview.totalReviews,
	"No-shows": overview.noShows,
	"Revenue by floor": toMap(stats.getRevenueByFloor(), "floor", "revenue"),
	"Booking mix": toMap(stats.getBookingMix(), "type", "count"),
	"Busiest room count": stats.getTopRooms()[0]?.count,
	"Bookings made in the last 14 days": stats.getTrend().reduce((s, d) => s + d.count, 0),
};

// ---------- Compare ----------
const same = (a, b) =>
	typeof a === "object"
		? JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort())
		: String(a) === String(b);
const show = (v) => (typeof v === "object" ? JSON.stringify(v) : String(v));

let failures = 0;
for (const [name, value] of Object.entries(expected)) {
	const ok = same(value, reported[name]);
	if (!ok) failures++;
	console.log(`${ok ? "OK      " : "MISMATCH"} ${name}: ${show(reported[name])}${ok ? "" : `  (expected ${show(value)})`}`);
}
console.log(failures ? `\n${failures} check(s) failed.` : "\nAll dashboard numbers match the data.");
process.exitCode = failures ? 1 : 0;
