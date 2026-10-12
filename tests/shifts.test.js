// ============================================================
// tests/shifts.test.js — Shift times on New Zealand time, and staff
// only checking guests in or out during their shift
// ============================================================

const { writeData } = require("./helpers/temp-data");
const { hotelTimeToMs } = require("../backend/config/hotel-time");
const shifts = require("../backend/services/shift.service");
const checkins = require("../backend/services/checkin.service");
const assistant = require("../backend/ai/assistant");

const mike = { id: "u002", name: "Mike Tane", role: "staff" };
const sarah = { id: "u003", name: "Sarah Kim", role: "manager" };
// Tuesday 13 October 2026 is during NZ daylight time (UTC+13)
const at = (time, date = "2026-10-13") => hotelTimeToMs(date, time);

beforeEach(() => {
	writeData("shifts.json", [
		{
			id: "sh001",
			staffId: "u002",
			days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
			shiftStart: "07:00",
			shiftEnd: "15:00",
			shiftType: "Morning",
		},
	]);
});
afterEach(() => jest.restoreAllMocks());

test("NZ time is converted correctly in summer and winter", () => {
	expect(new Date(at("07:00")).toISOString()).toBe("2026-10-12T18:00:00.000Z"); // NZDT
	expect(new Date(at("07:00", "2026-06-15")).toISOString()).toBe("2026-06-14T19:00:00.000Z"); // NZST
});

test("the shift runs from 7:00 am to 3:00 pm on weekdays", () => {
	expect(shifts.shiftStatus("u002", at("06:59")).state).toBe("before");
	expect(shifts.shiftStatus("u002", at("07:00")).state).toBe("on");
	expect(shifts.shiftStatus("u002", at("14:59")).state).toBe("on");
	expect(shifts.shiftStatus("u002", at("15:00")).state).toBe("after");
	expect(shifts.shiftStatus("u002", at("10:00", "2026-10-17")).state).toBe("none"); // Saturday

	const status = shifts.shiftStatus("u002", at("09:00"));
	expect(status).toMatchObject({ shiftType: "Morning", hours: "7:00 am - 3:00 pm" });
	expect(status.endsAt - at("09:00")).toBe(6 * 3600000); // 6 hours left
});

test("a night shift continues past midnight", () => {
	writeData("shifts.json", [
		{ id: "n", staffId: "u002", days: ["Tuesday"], shiftStart: "23:00", shiftEnd: "07:00", shiftType: "Night" },
	]);
	expect(shifts.shiftStatus("u002", at("23:30")).state).toBe("on");
	expect(shifts.shiftStatus("u002", at("06:30", "2026-10-14")).state).toBe("on");
	expect(shifts.shiftStatus("u002", at("07:00", "2026-10-14")).state).toBe("none");
});

test("staff can't check guests in or out outside their shift; managers can", () => {
	const after = () => shifts.assertCanHandleGuests(mike, at("15:00"));
	expect(after).toThrow(/your shift is finished.*Thank you for your hard work, we really appreciate it! :\)/);
	expect(() => shifts.assertCanHandleGuests(mike, at("06:00"))).toThrow(/begins at 7:00 am/);
	expect(() => shifts.assertCanHandleGuests(mike, at("10:00", "2026-10-17"))).toThrow(/not on shift today/);
	expect(() => shifts.assertCanHandleGuests(mike, at("10:00"))).not.toThrow();
	expect(() => shifts.assertCanHandleGuests(sarah, at("22:00"))).not.toThrow();

	let err;
	try {
		after();
	} catch (e) {
		err = e;
	}
	expect(err).toMatchObject({ status: 403, offShift: "after" });
});

test("the check-in service and Aria's greeting respect the shift", () => {
	const today = new Date().toLocaleDateString("en-CA");
	const d = new Date();
	d.setDate(d.getDate() + 2);
	writeData("bookings.json", [
		{ id: "bQ", userId: "u001", userName: "Jane Thompson", roomId: "203", roomType: "Deluxe Double", floor: 2, checkIn: today, checkOut: d.toLocaleDateString("en-CA"), nights: 2, total: 378, status: "booked" },
	]);
	writeData("shifts.json", []); // Mike has no shift at all
	expect(() => checkins.checkIn("bQ", mike)).toThrow(/not on shift today/);

	const greeting = assistant.greeting(mike);
	expect(greeting.text).toMatch(/check-ins are paused/);
	expect(greeting.actions).toEqual([]); // no one-click check-in cards
});
