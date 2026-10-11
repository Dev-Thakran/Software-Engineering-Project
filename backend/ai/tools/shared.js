// Helpers shared by the assistant's tools
const rooms = require("../../services/room.service");
const referenceRepo = require("../../repositories/reference.repository");
const availability = require("../../services/availability.service");

const FLOOR_NAMES = { 1: "Garden", 2: "Classic", 3: "Executive", 4: "Penthouse" };
const TAX = 30; // matches the booking form

// The room fields worth showing the model
function describeRoom(room) {
	const { status } = rooms.withStatus(room);
	return {
		roomId: room.id,
		floor: room.floor,
		tier: FLOOR_NAMES[room.floor] || `Floor ${room.floor}`,
		type: room.type,
		pricePerNight: room.price,
		maxGuests: availability.MAX_GUESTS[room.type] || 2,
		occupiedToday: status === "occupied",
	};
}

function getRoomOrThrow(roomId) {
	const room = rooms.getRoom(String(roomId || ""));
	if (!room) throw new Error(`There is no room ${roomId}.`);
	return room;
}

// Throws a readable error when the stay dates are invalid
function checkStay(checkIn, checkOut) {
	const problem = availability.validateStay(checkIn, checkOut);
	if (problem) throw new Error(problem);
}

function roomDetails(roomId) {
	const room = getRoomOrThrow(roomId);
	const reviews = referenceRepo.getReviews().filter((r) => r.roomId === room.id);
	return {
		...describeRoom(room),
		description: room.description,
		amenities: referenceRepo.getAmenities(room.id),
		reviewCount: reviews.length,
		averageRating: reviews.length
			? +(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
			: null,
	};
}

// The card shown for checking a booking in; also used by the chat greeting
function checkinCard(b) {
	return {
		title: `Check in ${b.userName}`,
		lines: [
			`Room ${b.roomId} · ${b.roomType}`,
			`${b.checkIn} → ${b.checkOut}`,
			`$${b.total} paid`,
		],
		confirmLabel: "Check in",
	};
}

const dateParam = (what) => ({
	type: "string",
	description: `${what} date, YYYY-MM-DD`,
});

module.exports = {
	FLOOR_NAMES,
	TAX,
	describeRoom,
	getRoomOrThrow,
	checkStay,
	roomDetails,
	checkinCard,
	dateParam,
};
