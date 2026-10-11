const bookingRepo = require("../repositories/booking.repository");
const checkinRepo = require("../repositories/checkin.repository");
const rooms = require("./room.service");
const userRepo = require("../repositories/user.repository");
const referenceRepo = require("../repositories/reference.repository");
const { today } = require("./availability.service");
const shiftService = require("./shift.service");

// Bookings that count towards revenue and booking counts
function countedBookings() {
	return bookingRepo.getAll().filter((b) => b.status !== "cancelled");
}

function getOverview() {
	const bookings = countedBookings();
	const allRooms = rooms.getRooms();
	const reviews = referenceRepo.getReviews();

	const totalRevenue = bookings.reduce((sum, b) => sum + (b.total || 0), 0);
	const occupiedRooms = allRooms.filter((r) => r.status === "occupied").length;
	const occupancyPct = allRooms.length
		? Math.round((occupiedRooms / allRooms.length) * 100)
		: 0;
	const avgRating = reviews.length
		? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
		: 0;

	return {
		totalRevenue,
		occupancyPct,
		occupiedRooms,
		totalRooms: allRooms.length,
		avgRating,
		totalReviews: reviews.length,
		totalBookings: bookings.length,
		// Stays that ended without the guest ever checking in
		noShows: bookings.filter((b) => b.status === "booked" && b.checkOut <= today())
			.length,
	};
}

// Most-booked rooms, highest first
function getTopRooms(limit = 8) {
	const counts = {};
	countedBookings().forEach((b) => {
		counts[b.roomId] = (counts[b.roomId] || 0) + 1;
	});
	return Object.entries(counts)
		.map(([roomId, count]) => ({ roomId, count }))
		.sort((a, b) => b.count - a.count)
		.slice(0, limit);
}

// Bookings created per day over the last `days` days
function getTrend(days = 14) {
	const bookings = countedBookings();
	const trend = [];
	for (let i = days - 1; i >= 0; i--) {
		const d = new Date();
		d.setDate(d.getDate() - i);
		const date = d.toLocaleDateString("en-CA");
		const count = bookings.filter(
			(b) =>
				b.createdAt &&
				new Date(b.createdAt).toLocaleDateString("en-CA") === date,
		).length;
		trend.push({ date: date.slice(5), count });
	}
	return trend;
}

function getRevenueByFloor() {
	const floors = {};
	rooms.getRooms().forEach((r) => (floors[r.floor] = 0));
	countedBookings().forEach((b) => {
		if (floors[b.floor] !== undefined) floors[b.floor] += b.total || 0;
	});
	return Object.entries(floors).map(([floor, revenue]) => ({
		floor: "F" + floor,
		revenue,
	}));
}

function getBookingMix() {
	const mix = {};
	countedBookings().forEach((b) => {
		mix[b.roomType] = (mix[b.roomType] || 0) + 1;
	});
	return Object.entries(mix).map(([type, count]) => ({ type, count }));
}

// Each staff member's shift today and the guests they've handled
function getStaff() {
	const shifts = shiftService.getShifts();
	const checkins = checkinRepo.getAll();
	const date = today();

	return userRepo
		.getAll()
		.filter((u) => u.role === "staff")
		.map((u) => {
			const todayShift = shifts.find(
				(s) => s.staffId === u.id && s.date === date,
			);
			const handled = checkins.filter((c) => c.handledBy === u.id);
			const attending = handled.filter((c) => c.status === "staying");
			return {
				id: u.id,
				name: u.name,
				email: u.email,
				shift: todayShift
					? `${todayShift.shiftType} (${todayShift.shiftStart} - ${todayShift.shiftEnd})`
					: "No shift today",
				attending: attending.map((c) => `${c.guestName} · Room ${c.roomId}`),
				completed: handled.length - attending.length,
				total: handled.length,
			};
		});
}

// Newest reviews first
function getRecentReviews(limit = 6) {
	return referenceRepo.getReviews().slice(-limit).reverse();
}

module.exports = {
	getOverview,
	getTopRooms,
	getTrend,
	getRevenueByFloor,
	getBookingMix,
	getStaff,
	getRecentReviews,
};
