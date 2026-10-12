const referenceRepo = require("../repositories/reference.repository");
const { hotelNow, hotelTimeToMs, addDays } = require("../config/hotel-time");
const ServiceError = require("./service-error");

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// shifts.json holds a weekly rota: each entry lists the days someone works,
// e.g. { staffId, days: ["Monday", "Tuesday"], shiftStart, shiftEnd, shiftType }.
// This turns it into dated shifts for the current week (Monday to Sunday,
// on New Zealand time), marked "completed", "active" (today) or "upcoming",
// so the data never goes out of date.
function getShifts(ms = Date.now()) {
	const { date: today, weekday } = hotelNow(ms);
	const monday = addDays(today, -WEEKDAYS.indexOf(weekday));

	return referenceRepo.getShifts().flatMap((entry) => {
		if (!entry.days) return [entry]; // a one-off shift with its own date
		return entry.days.map((day) => {
			const date = addDays(monday, WEEKDAYS.indexOf(day));
			const { days, ...shift } = entry;
			return {
				...shift,
				id: `${entry.id}-${date}`,
				date,
				status: date < today ? "completed" : date === today ? "active" : "upcoming",
			};
		});
	});
}

// When a dated shift starts and ends (ms). A shift ending earlier in the day
// than it starts runs past midnight.
function shiftTimes(shift) {
	const startsAt = hotelTimeToMs(shift.date, shift.shiftStart);
	const endDate = shift.shiftEnd <= shift.shiftStart ? addDays(shift.date, 1) : shift.date;
	return { startsAt, endsAt: hotelTimeToMs(endDate, shift.shiftEnd) };
}

// "07:00" -> "7:00 am"
function friendlyTime(time) {
	const [h, m] = time.split(":").map(Number);
	return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

const OFF_SHIFT_MESSAGES = {
	after:
		"Sorry, your shift is finished, so you can't check guests in or out right now. Thank you for your hard work, we really appreciate it! :)",
	before: (shift) =>
		`Your shift hasn't started yet - it begins at ${friendlyTime(shift.shiftStart)}. You can check guests in or out once it starts.`,
	none: "You're not on shift today, so you can't check guests in or out.",
};

// Where a staff member is in today's shift, on New Zealand time:
//   state: "on" | "before" | "after" | "none" (no shift today)
// plus the shift's times and, when off shift, the message to show.
function shiftStatus(staffId, ms = Date.now()) {
	const { date: today } = hotelNow(ms);
	const yesterday = addDays(today, -1);
	const mine = [...getShifts(ms), ...getShifts(ms - 7 * 86400000)].filter(
		(s) => s.staffId === staffId && (s.date === today || s.date === yesterday),
	);
	const withTimes = mine.map((s) => ({ ...s, ...shiftTimes(s) }));

	// On shift now (including a night shift that started yesterday)
	const current = withTimes.find((s) => s.startsAt <= ms && ms < s.endsAt);
	const todays = withTimes.find((s) => s.date === today);
	const shift = current || todays;
	if (!shift)
		return {
			state: "none",
			message: OFF_SHIFT_MESSAGES.none,
			messages: { none: OFF_SHIFT_MESSAGES.none },
		};

	const state = current ? "on" : ms < shift.startsAt ? "before" : "after";
	const message =
		state === "before" ? OFF_SHIFT_MESSAGES.before(shift) : OFF_SHIFT_MESSAGES[state];
	return {
		state,
		// What to tell staff in each off-shift situation (the page's clock can
		// move from one state to the next without asking the server again)
		messages: {
			before: OFF_SHIFT_MESSAGES.before(shift),
			after: OFF_SHIFT_MESSAGES.after,
			none: OFF_SHIFT_MESSAGES.none,
		},
		shiftType: shift.shiftType,
		hours: `${friendlyTime(shift.shiftStart)} - ${friendlyTime(shift.shiftEnd)}`,
		startsAt: shift.startsAt,
		endsAt: shift.endsAt,
		...(state !== "on" && { message }),
	};
}

// Staff can only check guests in or out during their shift. Managers don't
// work shifts and are never blocked.
function assertCanHandleGuests(user, ms = Date.now()) {
	if (!user || user.role !== "staff") return;
	const status = shiftStatus(user.id, ms);
	if (status.state === "on") return;
	const err = new ServiceError(403, status.message);
	err.offShift = status.state;
	throw err;
}

module.exports = { getShifts, shiftStatus, assertCanHandleGuests };
