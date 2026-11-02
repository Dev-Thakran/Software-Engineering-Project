// ============================================================
// tests/period-stats.test.js — The manager dashboard's 7/30/90
// day figures: earned vs booked-ahead revenue and comparisons
// ============================================================

const { writeData } = require("./helpers/temp-data");
const stats = require("../backend/services/stats.service");

function inDays(days) {
	const d = new Date();
	d.setDate(d.getDate() + days);
	return d.toLocaleDateString("en-CA");
}

function booking(id, checkIn, checkOut, nights, total, status = "completed", createdDaysAgo = 1) {
	const created = new Date();
	created.setDate(created.getDate() - createdDaysAgo);
	return {
		id, userId: "u001", userName: "Test", roomId: "201", roomType: "Deluxe Double", floor: 2,
		checkIn, checkOut, nights, total, status, createdAt: created.toISOString(),
	};
}

beforeEach(() => {
	writeData("checkins.json", []);
	writeData("reviews.json", [
		{ id: "r1", guestName: "A", roomId: "201", roomType: "Deluxe Double", rating: 4, title: "", comment: "x", date: inDays(-2) },
		{ id: "r2", guestName: "B", roomId: "201", roomType: "Deluxe Double", rating: 2, title: "", comment: "x", date: inDays(-10) },
	]);
	writeData("bookings.json", [
		// 3 nights, two inside the last 7 days (days -2 and -1) and one before
		booking("b1", inDays(-8), inDays(-5), 3, 300),
		booking("b2", inDays(-2), inDays(0), 2, 200),
		// Straddles today: tonight is "ahead", last night was earned
		booking("b3", inDays(-1), inDays(2), 3, 600, "staying"),
		// Entirely in the future
		booking("b4", inDays(3), inDays(5), 2, 400, "booked", 0),
		// Cancelled bookings never count
		booking("b5", inDays(-3), inDays(-1), 2, 999, "cancelled"),
	]);
});

test("revenue is earned night by night inside the period", () => {
	const p = stats.getPeriod(7);
	// b1: nights -8,-7,-6 -> only -6 is in the last 7 days ($100)
	// b2: nights -2,-1 ($200); b3: nights -1 and 0 ($400); b3 night +1 is ahead
	expect(p.current.revenue).toBe(100 + 200 + 400);
	expect(p.current.nights).toBe(1 + 2 + 2);
	expect(p.current.avgNightlyRate).toBe(140);
});

test("booked-ahead revenue counts only future nights of live bookings", () => {
	const p = stats.getPeriod(7);
	// b3 night +1 ($200) and b4 nights +3,+4 ($400)
	expect(p.bookedAhead.revenue).toBe(600);
	expect(p.bookedAhead.nights).toBe(3);
});

test("the previous period is compared like for like", () => {
	const p = stats.getPeriod(7);
	// Previous 7 days are -13..-7: b1 nights -8 and -7
	expect(p.previous.revenue).toBe(200);
	expect(p.current.avgRating).toBe(4);
	expect(p.previous.avgRating).toBe(2);
});

test("breakdowns and the trend cover the period", () => {
	const p = stats.getPeriod(7);
	expect(p.trend).toHaveLength(7);
	expect(p.trend.at(-1).date).toBe(inDays(0));
	expect(p.trend.reduce((s, d) => s + d.revenue, 0)).toBe(p.current.revenue);
	expect(p.revenueByFloor.find((f) => f.floor === "F2").revenue).toBe(p.current.revenue);
	expect(p.topRooms[0]).toEqual({ roomId: "201", nights: 5 });
});
