// ============================================================
// tests/availability.test.js — Date-based room availability
// and the check-in / check-out service
// ============================================================

const { writeData, readData } = require("./helpers/temp-data");
const availability = require("../backend/services/availability.service");
const checkins = require("../backend/services/checkin.service");
const rooms = require("../backend/services/room.service");
const stats = require("../backend/services/stats.service");

// A date `days` from today in YYYY-MM-DD form
function inDays(days) {
	const d = new Date();
	d.setDate(d.getDate() + days);
	return d.toLocaleDateString("en-CA");
}

function booking(id, roomId, checkIn, checkOut, status = "booked") {
	return {
		id,
		userId: "u001",
		userName: "Jane Thompson",
		roomId,
		roomType: "Deluxe Double",
		floor: 2,
		checkIn,
		checkOut,
		nights: 2,
		total: 378,
		status,
		createdAt: new Date().toISOString(),
	};
}

beforeEach(() => {
	writeData("bookings.json", [booking("bA", "201", inDays(10), inDays(12))]);
	writeData("checkins.json", []);
});

test("overlapping stay is refused", () => {
	expect(availability.isRoomFree("201", inDays(11), inDays(13))).toBe(false);
});

test("stay inside an existing booking is refused", () => {
	expect(availability.isRoomFree("201", inDays(10), inDays(11))).toBe(false);
});

test("back-to-back stays are allowed", () => {
	expect(availability.isRoomFree("201", inDays(12), inDays(14))).toBe(true);
	expect(availability.isRoomFree("201", inDays(8), inDays(10))).toBe(true);
});

test("cancelled bookings don't block the room", () => {
	writeData("bookings.json", [
		booking("bA", "201", inDays(10), inDays(12), "cancelled"),
	]);
	expect(availability.isRoomFree("201", inDays(10), inDays(12))).toBe(true);
});

test("findAvailableRooms leaves out booked rooms and applies filters", () => {
	const rooms = availability.findAvailableRooms({
		checkIn: inDays(10),
		checkOut: inDays(12),
		maxPrice: 200,
	});
	const ids = rooms.map((r) => r.id);
	expect(ids).not.toContain("201");
	expect(ids).toContain("202");
	expect(rooms.every((r) => r.price <= 200)).toBe(true);
});

test("validateStay rejects past and reversed dates", () => {
	expect(availability.validateStay(inDays(-1), inDays(1))).toMatch(/past/);
	expect(availability.validateStay(inDays(3), inDays(2))).toMatch(/after/);
	expect(availability.validateStay("tomorrow", inDays(2))).toMatch(/YYYY/);
	expect(availability.validateStay(inDays(1), inDays(2))).toBeNull();
});

test("check-in marks the room occupied and check-out frees it", () => {
	writeData("bookings.json", [booking("bT", "203", inDays(0), inDays(2))]);
	expect(checkins.getQueue().map((b) => b.id)).toEqual(["bT"]);

	const staff = { id: "u002", name: "Mike Tane" };
	const ci = checkins.checkIn("bT", staff);
	expect(ci.status).toBe("staying");
	expect(rooms.getRoom("203").status).toBe("occupied");
	expect(() => checkins.checkIn("bT", staff)).toThrow(/not awaiting/);

	checkins.checkOut(ci.id);
	expect(rooms.getRoom("203").status).toBe("available");
	expect(readData("bookings.json")[0].status).toBe("completed");
	expect(() => checkins.checkOut(ci.id)).toThrow(/already checked out/);
});

test("room status comes from check-ins, not a stored field", () => {
	// A stale status saved in rooms.json is ignored
	const data = readData("rooms.json");
	data.find((r) => r.id === "205").status = "occupied";
	writeData("rooms.json", data);
	expect(rooms.getRoom("205").status).toBe("available");

	writeData("checkins.json", [
		{ id: "ciX", bookingId: "bX", roomId: "205", status: "staying", checkInTime: new Date().toISOString() },
	]);
	expect(rooms.getRoom("205").status).toBe("occupied");
	const overview = stats.getOverview();
	expect(overview.occupiedRooms).toBe(1);
	expect(overview.occupancyPct).toBe(Math.round((1 / overview.totalRooms) * 100));
});

test("late arrivals stay in the check-in queue until their stay ends", () => {
	writeData("bookings.json", [
		booking("bLate", "204", inDays(-1), inDays(2)),
		booking("bGone", "206", inDays(-3), inDays(0)),
	]);
	expect(checkins.getQueue().map((b) => b.id)).toEqual(["bLate"]);
	expect(stats.getOverview().noShows).toBe(1);
});

test("guests can only be checked in during their stay", () => {
	writeData("bookings.json", [
		booking("bPast", "204", inDays(-3), inDays(0)),
		booking("bSoon", "205", inDays(2), inDays(4)),
	]);
	const staff = { id: "u002", name: "Mike Tane" };
	expect(() => checkins.checkIn("bPast", staff)).toThrow(/already ended/);
	expect(() => checkins.checkIn("bSoon", staff)).toThrow(/isn't due until/);
});

test("the weekly rota becomes dated shifts for this week", () => {
	const todayName = new Date().toLocaleDateString("en-GB", { weekday: "long" });
	writeData("shifts.json", [
		{ id: "s1", staffId: "u002", days: [todayName], shiftStart: "07:00", shiftEnd: "15:00", shiftType: "Morning" },
		{ id: "s2", staffId: "u002", date: "2026-01-01", shiftStart: "09:00", shiftEnd: "17:00", shiftType: "Day", status: "completed" },
	]);
	const all = require("../backend/services/shift.service").getShifts();
	expect(all.find((s) => s.id.startsWith("s1"))).toMatchObject({ date: inDays(0), status: "active" });
	// One-off shifts with their own date are kept as they are
	expect(all.find((s) => s.id === "s2").date).toBe("2026-01-01");
	expect(stats.getStaff()[0].shift).toBe("Morning (07:00 - 15:00)");
});
