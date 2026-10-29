const bookingRepo = require("../repositories/booking.repository");
const roomRepo = require("../repositories/room.repository");

// Bookings in these states hold their room for their dates
const ACTIVE_STATUSES = ["booked", "staying"];

// Maximum guests per room type
const MAX_GUESTS = {
	"Standard Single": 1,
	"Deluxe Double": 2,
	"Executive Double": 2,
	"Penthouse Suite": 4,
};

// Accepts only real calendar dates in YYYY-MM-DD form
function isValidDate(value) {
	return (
		typeof value === "string" &&
		/^\d{4}-\d{2}-\d{2}$/.test(value) &&
		!isNaN(new Date(value))
	);
}

function today() {
	return new Date().toLocaleDateString("en-CA");
}

function nightsBetween(checkIn, checkOut) {
	return Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);
}

// Stays overlap when each starts before the other ends. Checking out on the
// day someone else checks in is not an overlap. YYYY-MM-DD strings compare
// correctly as plain strings.
function overlaps(aIn, aOut, bIn, bOut) {
	return aIn < bOut && bIn < aOut;
}

// Returns an error message for an invalid date range, or null when valid
function validateStay(checkIn, checkOut) {
	if (!isValidDate(checkIn) || !isValidDate(checkOut))
		return "Dates must be YYYY-MM-DD";
	if (checkIn < today()) return "Check-in can't be in the past";
	if (nightsBetween(checkIn, checkOut) < 1)
		return "Check-out must be after check-in";
	return null;
}

// excludeBookingId lets a booking move its own dates without clashing with itself
function isRoomFree(roomId, checkIn, checkOut, excludeBookingId) {
	return !bookingRepo
		.getAll()
		.some(
			(b) =>
				b.roomId === roomId &&
				b.id !== excludeBookingId &&
				ACTIVE_STATUSES.includes(b.status) &&
				overlaps(checkIn, checkOut, b.checkIn, b.checkOut),
		);
}

// Rooms free for the whole stay, optionally filtered
function findAvailableRooms({ checkIn, checkOut, type, floor, maxPrice, guests }) {
	const bookings = bookingRepo
		.getAll()
		.filter(
			(b) =>
				ACTIVE_STATUSES.includes(b.status) &&
				overlaps(checkIn, checkOut, b.checkIn, b.checkOut),
		);
	const taken = new Set(bookings.map((b) => b.roomId));
	return roomRepo
		.getAll()
		.filter((r) => !taken.has(r.id))
		.filter((r) => !type || r.type === type)
		.filter((r) => !floor || r.floor === Number(floor))
		.filter((r) => !maxPrice || r.price <= Number(maxPrice))
		.filter((r) => !guests || (MAX_GUESTS[r.type] || 2) >= Number(guests));
}

module.exports = {
	ACTIVE_STATUSES,
	MAX_GUESTS,
	isValidDate,
	today,
	nightsBetween,
	overlaps,
	validateStay,
	isRoomFree,
	findAvailableRooms,
};
