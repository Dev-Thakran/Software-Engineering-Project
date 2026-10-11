// Tools for guests: find rooms, look up bookings, propose a booking
const bookingRepo = require("../../repositories/booking.repository");
const availability = require("../../services/availability.service");
const {
	TAX,
	describeRoom,
	getRoomOrThrow,
	checkStay,
	roomDetails,
	dateParam,
} = require("./shared");

module.exports = [
	{
		name: "search_available_rooms",
		description:
			"Find rooms that are free for the whole stay. Optional filters narrow the results.",
		parameters: {
			type: "object",
			properties: {
				checkIn: dateParam("Check-in"),
				checkOut: dateParam("Check-out"),
				roomType: {
					type: "string",
					enum: [
						"Standard Single",
						"Deluxe Double",
						"Executive Double",
						"Penthouse Suite",
					],
				},
				floor: { type: "integer", description: "Floor 1-4" },
				maxPrice: { type: "number", description: "Max price per night" },
				guests: { type: "integer", description: "Number of guests" },
			},
			required: ["checkIn", "checkOut"],
		},
		run(input) {
			checkStay(input.checkIn, input.checkOut);
			const nights = availability.nightsBetween(input.checkIn, input.checkOut);
			const rooms = availability.findAvailableRooms({
				checkIn: input.checkIn,
				checkOut: input.checkOut,
				type: input.roomType,
				floor: input.floor,
				maxPrice: input.maxPrice,
				guests: input.guests,
			});
			return {
				nights,
				count: rooms.length,
				rooms: rooms.map((r) => ({
					...describeRoom(r),
					stayTotalBeforeTax: r.price * nights,
				})),
			};
		},
	},
	{
		name: "get_room_details",
		description: "Amenities, description and guest rating for one room.",
		parameters: {
			type: "object",
			properties: { roomId: { type: "string", description: "e.g. 201" } },
			required: ["roomId"],
		},
		run: (input) => roomDetails(input.roomId),
	},
	{
		name: "get_my_bookings",
		description: "The signed-in guest's own bookings, past and upcoming.",
		parameters: { type: "object", properties: {} },
		run(input, ctx) {
			return bookingRepo.findByUser(ctx.user.id).map((b) => ({
				bookingId: b.id,
				roomId: b.roomId,
				roomType: b.roomType,
				checkIn: b.checkIn,
				checkOut: b.checkOut,
				total: b.total,
				status: b.status,
			}));
		},
	},
	{
		name: "propose_booking",
		description:
			"Show the guest a booking card with a button to continue to payment. Nothing is booked until they confirm and pay. Check availability first.",
		parameters: {
			type: "object",
			properties: {
				roomId: { type: "string" },
				checkIn: dateParam("Check-in"),
				checkOut: dateParam("Check-out"),
				guests: { type: "integer" },
			},
			required: ["roomId", "checkIn", "checkOut", "guests"],
		},
		run(input, ctx) {
			const room = getRoomOrThrow(input.roomId);
			checkStay(input.checkIn, input.checkOut);
			const maxGuests = availability.MAX_GUESTS[room.type] || 2;
			const guests = Number(input.guests) || 1;
			if (guests < 1 || guests > maxGuests)
				throw new Error(`Room ${room.id} takes at most ${maxGuests} guest(s).`);
			if (!availability.isRoomFree(room.id, input.checkIn, input.checkOut))
				throw new Error(`Room ${room.id} is already booked for those dates.`);

			const nights = availability.nightsBetween(input.checkIn, input.checkOut);
			const subtotal = room.price * nights;
			ctx.propose(
				"customer_booking",
				{ roomId: room.id, checkIn: input.checkIn, checkOut: input.checkOut, guests },
				{
					title: `Room ${room.id} · ${room.type}`,
					lines: [
						`${input.checkIn} → ${input.checkOut} (${nights} night${nights > 1 ? "s" : ""})`,
						`${guests} guest${guests > 1 ? "s" : ""}`,
						`$${subtotal} + $${TAX} tax = $${subtotal + TAX}`,
					],
					confirmLabel: "Continue to payment",
				},
			);
			return "Booking card shown. Nothing is booked yet - the guest continues to the payment page by clicking the button.";
		},
	},
];
