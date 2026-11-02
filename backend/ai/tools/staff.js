// Tools for front-desk staff: arrivals, residents, check-in / check-out
const bookingRepo = require("../../repositories/booking.repository");
const roomRepo = require("../../repositories/room.repository");
const availability = require("../../services/availability.service");
const checkins = require("../../services/checkin.service");
const {
	describeRoom,
	getRoomOrThrow,
	checkStay,
	dateParam,
} = require("./shared");

function describeBooking(b) {
	return {
		bookingId: b.id,
		guest: b.userName,
		roomId: b.roomId,
		roomType: b.roomType,
		checkIn: b.checkIn,
		checkOut: b.checkOut,
		total: b.total,
		status: b.status,
		...(b.arrivalTime ? { arrivalTime: b.arrivalTime } : {}),
		...(b.requests ? { requests: b.requests } : {}),
		...(b.roomNotReady ? { roomNotReady: b.roomNotReady } : {}),
	};
}

// Finds exactly one record matching an ID, room number or (part of) a name.
// Errors tell the model how to recover, since small models often guess.
function findOne(records, query, fields, state) {
	const q = String(query || "").trim().toLowerCase();
	if (!q) throw new Error("Say which guest or booking.");
	const exact = records.filter((r) => fields(r).some((f) => String(f).toLowerCase() === q));
	const matches = exact.length
		? exact
		: records.filter((r) => fields(r).some((f) => String(f).toLowerCase().includes(q)));
	if (matches.length === 1) return matches[0];
	if (!matches.length)
		throw new Error(
			`No guest ${state} matches "${query}". Guests ${state}: ${
				records.map((r) => fields(r).join(" / ")).join("; ") || "none"
			}.`,
		);
	throw new Error(
		`"${query}" matches several guests ${state}: ${matches
			.map((r) => fields(r).join(" / "))
			.join("; ")}. Ask the staff member which one.`,
	);
}

module.exports = [
	{
		name: "get_checkin_queue",
		description: "Guests arriving today who haven't checked in yet.",
		parameters: { type: "object", properties: {} },
		run: () => checkins.getQueue().map(describeBooking),
	},
	{
		name: "get_in_residence",
		description: "Guests currently staying, with their check-in IDs.",
		parameters: { type: "object", properties: {} },
		run: () =>
			checkins.getInResidence().map((c) => ({
				checkinId: c.id,
				guest: c.guestName,
				roomId: c.roomId,
				roomType: c.roomType,
				checkedIn: c.checkInTime.split("T")[0],
				departs: c.checkOutDate,
				attendingStaff: c.attendingStaff,
			})),
	},
	{
		name: "find_bookings",
		description:
			"Search bookings by guest name, booking ID or room number. Returns active bookings unless includePast is true.",
		parameters: {
			type: "object",
			properties: {
				query: { type: "string" },
				includePast: { type: "boolean" },
			},
			required: ["query"],
		},
		run(input) {
			const q = String(input.query || "").toLowerCase().trim();
			if (!q) throw new Error("Give a name, booking ID or room number.");
			return bookingRepo
				.getAll()
				.filter(
					(b) =>
						input.includePast ||
						availability.ACTIVE_STATUSES.includes(b.status),
				)
				.filter(
					(b) =>
						b.id.toLowerCase() === q ||
						b.roomId === q ||
						(b.userName || "").toLowerCase().includes(q),
				)
				.slice(0, 20)
				.map(describeBooking);
		},
	},
	{
		name: "check_room_availability",
		description:
			"Whether rooms are free for given dates. Give roomId for one room, or leave it out to list every free room.",
		parameters: {
			type: "object",
			properties: {
				roomId: { type: "string" },
				checkIn: dateParam("Check-in"),
				checkOut: dateParam("Check-out"),
			},
			required: ["checkIn", "checkOut"],
		},
		run(input) {
			checkStay(input.checkIn, input.checkOut);
			if (input.roomId) {
				const room = getRoomOrThrow(input.roomId);
				return {
					...describeRoom(room),
					free: availability.isRoomFree(room.id, input.checkIn, input.checkOut),
				};
			}
			return availability
				.findAvailableRooms({ checkIn: input.checkIn, checkOut: input.checkOut })
				.map(describeRoom);
		},
	},
	{
		name: "check_in_guest",
		description:
			"Check a guest in right away. Use it when the staff member asks you to check someone in. Give the booking ID, or just the guest's name or room number - you don't need to look up the ID first. If the name matches more than one guest, ask which one.",
		parameters: {
			type: "object",
			properties: {
				booking: { type: "string", description: "Booking ID, guest name or room number" },
			},
			required: ["booking"],
		},
		run(input, ctx) {
			ctx.oneChangePerMessage();
			const b = findOne(
				checkins.getQueue(),
				input.booking,
				(b) => [b.id, b.roomId, b.userName],
				"due to check in today",
			);
			const ci = checkins.checkIn(b.id, ctx.user);
			ctx.performed("undo_checkin", { checkinId: ci.id }, {
				title: `Checked in ${ci.guestName}`,
				lines: [`Room ${ci.roomId} · ${ci.roomType}`, `Staying until ${ci.checkOutDate}`],
				confirmLabel: "Undo",
				done: true,
			});
			return `Done: ${ci.guestName} is checked in to room ${ci.roomId}.`;
		},
	},
	{
		name: "check_out_guest",
		description:
			"Check a guest out right away. Use it when the staff member asks you to check someone out. Give the guest's name, their room number, or the check-in ID. If it matches more than one guest, ask which one.",
		parameters: {
			type: "object",
			properties: {
				guest: { type: "string", description: "Guest name, room number or check-in ID" },
			},
			required: ["guest"],
		},
		run(input, ctx) {
			ctx.oneChangePerMessage();
			const c = findOne(
				checkins.getInResidence(),
				input.guest,
				(c) => [c.id, c.roomId, c.guestName],
				"currently staying",
			);
			const done = checkins.checkOut(c.id, ctx.user);
			const room = roomRepo.findById(done.roomId);
			ctx.performed("undo_checkout", { checkinId: done.id }, {
				title: `Checked out ${done.guestName}`,
				lines: [`Room ${done.roomId} · ${room ? room.type : done.roomType}`, "The room is free again"],
				confirmLabel: "Undo",
				done: true,
			});
			return `Done: ${done.guestName} is checked out of room ${done.roomId}.`;
		},
	},
];
