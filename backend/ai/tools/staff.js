// Tools for front-desk staff: arrivals, residents, check-in / check-out
const bookingRepo = require("../../repositories/booking.repository");
const roomRepo = require("../../repositories/room.repository");
const availability = require("../../services/availability.service");
const checkins = require("../../services/checkin.service");
const {
	describeRoom,
	getRoomOrThrow,
	checkStay,
	checkinCard,
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
		name: "propose_checkin",
		description:
			"Show a card to check a guest in. Give the booking ID, or just the guest's name - you don't need to look up the ID first. Nothing happens until the staff member confirms.",
		parameters: {
			type: "object",
			properties: {
				booking: { type: "string", description: "Booking ID or guest name" },
			},
			required: ["booking"],
		},
		run(input, ctx) {
			const b = findOne(
				checkins.getQueue(),
				input.booking,
				(b) => [b.id, b.userName],
				"due to check in today",
			);
			ctx.propose("staff_checkin", { bookingId: b.id }, checkinCard(b));
			return "Check-in card shown. Waiting for the staff member to confirm.";
		},
	},
	{
		name: "propose_checkout",
		description:
			"Show a card to check a guest out. Give the guest's name, their room number, or the check-in ID. Nothing happens until the staff member confirms.",
		parameters: {
			type: "object",
			properties: {
				guest: { type: "string", description: "Guest name, room number or check-in ID" },
			},
			required: ["guest"],
		},
		run(input, ctx) {
			const c = findOne(
				checkins.getInResidence(),
				input.guest,
				(c) => [c.id, c.roomId, c.guestName],
				"currently staying",
			);
			const room = roomRepo.findById(c.roomId);
			ctx.propose(
				"staff_checkout",
				{ checkinId: c.id },
				{
					title: `Check out ${c.guestName}`,
					lines: [
						`Room ${c.roomId} · ${room ? room.type : c.roomType}`,
						`Booked until ${c.checkOutDate}`,
					],
					confirmLabel: "Check out",
				},
			);
			return "Check-out card shown. Waiting for the staff member to confirm.";
		},
	},
];
