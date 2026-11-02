const bookingRepo = require("../repositories/booking.repository");
const checkinRepo = require("../repositories/checkin.repository");
const roomRepo = require("../repositories/room.repository");
const { today } = require("./availability.service");
const ServiceError = require("./service-error");
const { assertCanHandleGuests } = require("./shift.service");
const { hotelNow } = require("../config/hotel-time");

// Guests due to be in the hotel today who haven't checked in yet. Includes
// late arrivals whose stay started earlier but hasn't ended. Each one says
// whether the room is ready, so staff see a problem before they try.
function getQueue() {
	const date = today();
	const residents = getInResidence();
	return bookingRepo
		.getAll()
		.filter(
			(b) => b.status === "booked" && b.checkIn <= date && date < b.checkOut,
		)
		.map((b) => {
			const notReady = roomNotReady(b.roomId, residents);
			return { ...b, roomReady: !notReady, ...(notReady ? { roomNotReady: notReady } : {}) };
		});
}

// Housekeeping: a room needs cleaning after every check-out, and nobody can
// be checked in to it until staff mark it clean. Rooms start out clean.
const needsCleaning = (room) => room?.housekeeping === "dirty";

// Why a guest can't be checked in to this room yet, or "" when it's ready
function roomNotReady(roomId, residents = getInResidence()) {
	const current = residents.find((c) => c.roomId === roomId);
	if (current) {
		const day = new Date(current.checkOutDate + "T12:00:00Z").toLocaleDateString("en-NZ", { day: "numeric", month: "short", timeZone: "UTC" });
		const due = current.checkOutDate < today() ? `was due out ${day}` : `due out ${day}`;
		return `Room ${roomId} still has a guest staying (${current.guestName}, ${due}). Check them out first.`;
	}
	if (needsCleaning(roomRepo.findById(roomId)))
		return `Room ${roomId} needs cleaning first. Mark it clean under Housekeeping.`;
	return "";
}

// Rooms waiting for housekeeping, longest-waiting first
function getHousekeeping() {
	return roomRepo
		.getAll()
		.filter(needsCleaning)
		.map((r) => ({ id: r.id, floor: r.floor, type: r.type, since: r.housekeepingSince || null }))
		.sort((a, b) => String(a.since).localeCompare(String(b.since)));
}

function markClean(roomId, user) {
	assertCanHandleGuests(user);
	const room = roomRepo.findById(roomId);
	if (!room) throw new ServiceError(404, "Room not found");
	if (!needsCleaning(room)) throw new ServiceError(409, `Room ${roomId} is already clean`);
	return roomRepo.update(roomId, {
		housekeeping: "clean",
		housekeepingSince: new Date().toISOString(),
		cleanedBy: user.name,
	});
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
	const notReady = roomNotReady(booking.roomId);
	if (notReady) throw new ServiceError(409, notReady);

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

	// Remember the room's housekeeping state so an undo can put it back
	const room = roomRepo.findById(checkin.roomId);
	checkinRepo.update(checkin.id, {
		status: "completed",
		checkOutTime: new Date().toISOString(),
		checkedOutBy: user?.name || "",
		roomWas: room?.housekeeping || "clean",
	});
	if (bookingRepo.findById(checkin.bookingId))
		bookingRepo.update(checkin.bookingId, { status: "completed" });
	if (room)
		roomRepo.update(room.id, { housekeeping: "dirty", housekeepingSince: new Date().toISOString() });

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
	const { roomWas } = checkin;
	checkinRepo.update(checkin.id, { status: "staying", checkOutTime: undefined, checkedOutBy: undefined, roomWas: undefined });
	if (bookingRepo.findById(checkin.bookingId))
		bookingRepo.update(checkin.bookingId, { status: "staying" });
	if (roomRepo.findById(checkin.roomId))
		roomRepo.update(checkin.roomId, { housekeeping: roomWas || "clean" });
	return checkinRepo.findById(checkin.id);
}

module.exports = {
	getHousekeeping,
	markClean,
	roomNotReady,
	undoCheckIn,
	undoCheckOut,
	getQueue,
	getInResidence,
	getTodaysCheckins,
	checkIn,
	checkOut,
};
