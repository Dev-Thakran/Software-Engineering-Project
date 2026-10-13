const bookingRepo = require("../repositories/booking.repository");
const checkinRepo = require("../repositories/checkin.repository");
const { today } = require("./availability.service");
const ServiceError = require("./service-error");
const { assertCanHandleGuests } = require("./shift.service");
const { hotelNow } = require("../config/hotel-time");

// Guests due to be in the hotel today who haven't checked in yet. Includes
// late arrivals whose stay started earlier but hasn't ended.
function getQueue() {
	const date = today();
	return bookingRepo
		.getAll()
		.filter(
			(b) => b.status === "booked" && b.checkIn <= date && date < b.checkOut,
		);
}

// Guests currently staying in the hotel
function getInResidence() {
	return checkinRepo.getAll().filter((c) => c.status === "staying");
}

// Check-ins completed today. Check-in times are stored in UTC, so both
// sides are compared as New Zealand dates.
function getTodaysCheckins() {
	const date = hotelNow().date;
	return checkinRepo
		.getAll()
		.filter((c) => hotelNow(Date.parse(c.checkInTime)).date === date);
}

// Marks a booking as staying and records the check-in, which makes the room
// show as occupied
function checkIn(bookingId, staff) {
	assertCanHandleGuests(staff);
	const booking = bookingRepo.findById(bookingId);
	if (!booking) throw new ServiceError(404, "Booking not found");
	if (booking.status !== "booked")
		throw new ServiceError(409, "Booking is not awaiting check-in");
	const date = today();
	if (booking.checkOut <= date)
		throw new ServiceError(409, "This stay has already ended");
	if (booking.checkIn > date)
		throw new ServiceError(409, `This guest isn't due until ${booking.checkIn}`);

	bookingRepo.update(booking.id, { status: "staying" });

	return checkinRepo.save({
		id: "ci" + Date.now(),
		bookingId: booking.id,
		userId: booking.userId,
		guestName: booking.userName,
		guestEmail: booking.guestEmail || "",
		roomId: booking.roomId,
		roomType: booking.roomType,
		floor: booking.floor,
		checkInTime: new Date().toISOString(),
		checkOutDate: booking.checkOut,
		total: booking.total,
		status: "staying",
		attendingStaff: staff.name,
		handledBy: staff.id,
	});
}

// Completes a stay; the room shows as available again automatically
function checkOut(checkinId, user) {
	assertCanHandleGuests(user);
	const checkin = checkinRepo.findById(checkinId);
	if (!checkin) throw new ServiceError(404, "Checkin not found");
	if (checkin.status !== "staying")
		throw new ServiceError(409, "Guest is already checked out");

	checkinRepo.update(checkin.id, { status: "completed" });
	if (bookingRepo.findById(checkin.bookingId))
		bookingRepo.update(checkin.bookingId, { status: "completed" });

	return checkinRepo.findById(checkin.id);
}

// Reverses a check-in made by mistake: the guest goes back to the queue
function undoCheckIn(checkinId, user) {
	assertCanHandleGuests(user);
	const checkin = checkinRepo.findById(checkinId);
	if (!checkin || checkin.status !== "staying")
		throw new ServiceError(409, "That check-in can't be undone any more");
	checkinRepo.remove(checkin.id);
	if (bookingRepo.findById(checkin.bookingId))
		bookingRepo.update(checkin.bookingId, { status: "booked" });
	return checkin;
}

// Reverses a check-out made by mistake: the guest is staying again, as long
// as nobody else has checked in to the room since
function undoCheckOut(checkinId, user) {
	assertCanHandleGuests(user);
	const checkin = checkinRepo.findById(checkinId);
	if (!checkin || checkin.status !== "completed")
		throw new ServiceError(409, "That check-out can't be undone any more");
	if (getInResidence().some((c) => c.roomId === checkin.roomId))
		throw new ServiceError(409, `Someone else is now staying in room ${checkin.roomId}`);
	checkinRepo.update(checkin.id, { status: "staying" });
	if (bookingRepo.findById(checkin.bookingId))
		bookingRepo.update(checkin.bookingId, { status: "staying" });
	return checkinRepo.findById(checkin.id);
}

module.exports = {
	undoCheckIn,
	undoCheckOut,
	getQueue,
	getInResidence,
	getTodaysCheckins,
	checkIn,
	checkOut,
};
