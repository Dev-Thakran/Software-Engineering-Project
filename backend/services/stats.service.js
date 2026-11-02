const bookingRepo = require("../repositories/booking.repository");
const checkinRepo = require("../repositories/checkin.repository");
const rooms = require("./room.service");
const userRepo = require("../repositories/user.repository");
const referenceRepo = require("../repositories/reference.repository");
const { today } = require("./availability.service");
const shiftService = require("./shift.service");
const { addDays } = require("../config/hotel-time");

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

// ---------- One period (the last 7, 30 or 90 days) ----------
// Revenue is spread evenly across the nights of each stay, so a period
// "earns" only the nights that fall inside it. Nights still to come are
// "booked ahead".

// Each night of a booking as { date, revenue }
function nightsOf(b) {
	const nights = [];
	const perNight = b.nights ? (b.total || 0) / b.nights : 0;
	for (let d = b.checkIn; d < b.checkOut; d = addDays(d, 1)) nights.push({ date: d, revenue: perNight });
	return nights;
}

const round2 = (n) => Math.round(n * 100) / 100;

function summarise(from, to, bookings, roomCount, reviews) {
	const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
	let revenue = 0;
	let nights = 0;
	bookings.forEach((b) =>
		nightsOf(b).forEach((n) => {
			if (n.date >= from && n.date <= to) {
				revenue += n.revenue;
				nights++;
			}
		}),
	);
	const made = bookings.filter((b) => {
		const day = b.createdAt && new Date(b.createdAt).toLocaleDateString("en-CA");
		return day >= from && day <= to;
	}).length;
	const inPeriod = reviews.filter((r) => r.date >= from && r.date <= to);
	return {
		from,
		to,
		revenue: round2(revenue),
		nights,
		occupancyPct: roomCount ? Math.round((nights / (roomCount * days)) * 100) : 0,
		avgNightlyRate: nights ? Math.round(revenue / nights) : 0,
		bookingsMade: made,
		reviews: inPeriod.length,
		avgRating: inPeriod.length ? round2(inPeriod.reduce((s, r) => s + r.rating, 0) / inPeriod.length) : null,
	};
}

function getPeriod(days = 30) {
	const date = today();
	const from = addDays(date, -(days - 1));
	const bookings = countedBookings();
	const allRooms = rooms.getRooms();
	const reviews = referenceRepo.getReviews();

	const current = summarise(from, date, bookings, allRooms.length, reviews);
	const previous = summarise(addDays(from, -days), addDays(from, -1), bookings, allRooms.length, reviews);

	// Nights after today, over the same number of days ahead
	const aheadTo = addDays(date, days);
	let aheadRevenue = 0;
	let aheadNights = 0;
	bookings
		.filter((b) => b.status === "booked" || b.status === "staying")
		.forEach((b) =>
			nightsOf(b).forEach((n) => {
				if (n.date > date && n.date <= aheadTo) {
					aheadRevenue += n.revenue;
					aheadNights++;
				}
			}),
		);

	// Day-by-day and breakdowns for the charts
	const trend = [];
	for (let d = from; d <= date; d = addDays(d, 1)) trend.push({ date: d, bookings: 0, revenue: 0 });
	const byDay = Object.fromEntries(trend.map((t) => [t.date, t]));
	const byFloor = {};
	const byRoom = {};
	const byType = {};
	allRooms.forEach((r) => (byFloor["F" + r.floor] = 0));
	bookings.forEach((b) => {
		const madeOn = b.createdAt && new Date(b.createdAt).toLocaleDateString("en-CA");
		if (byDay[madeOn]) byDay[madeOn].bookings++;
		nightsOf(b).forEach((n) => {
			if (!byDay[n.date]) return;
			byDay[n.date].revenue += n.revenue;
			byFloor["F" + b.floor] = (byFloor["F" + b.floor] || 0) + n.revenue;
			byRoom[b.roomId] = (byRoom[b.roomId] || 0) + 1;
			byType[b.roomType] = (byType[b.roomType] || 0) + 1;
		});
	});
	trend.forEach((t) => (t.revenue = round2(t.revenue)));

	return {
		days,
		current,
		previous,
		occupancyNow: getOverview().occupancyPct,
		bookedAhead: { to: aheadTo, revenue: round2(aheadRevenue), nights: aheadNights },
		trend,
		revenueByFloor: Object.entries(byFloor)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([floor, revenue]) => ({ floor, revenue: round2(revenue) })),
		topRooms: Object.entries(byRoom)
			.map(([roomId, nights]) => ({ roomId, nights }))
			.sort((a, b) => b.nights - a.nights)
			.slice(0, 8),
		mix: Object.entries(byType).map(([type, nights]) => ({ type, nights })),
	};
}

module.exports = {
	getOverview,
	getTopRooms,
	getTrend,
	getRevenueByFloor,
	getBookingMix,
	getStaff,
	getRecentReviews,
	getPeriod,
};
