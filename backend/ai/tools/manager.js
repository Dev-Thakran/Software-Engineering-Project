// Read-only tools for the manager: the same numbers as the dashboard
const bookingRepo = require("../../repositories/booking.repository");
const stats = require("../../services/stats.service");

const noInput = { type: "object", properties: {} };

module.exports = [
	{
		name: "get_overview",
		description:
			"Headline numbers: total revenue, occupancy today, average rating, review and booking counts. Cancelled bookings are excluded.",
		parameters: noInput,
		run: () => stats.getOverview(),
	},
	{
		name: "get_top_rooms",
		description: "Rooms with the most bookings, highest first.",
		parameters: noInput,
		run: () => stats.getTopRooms(),
	},
	{
		name: "get_booking_trend",
		description: "Bookings created per day over recent days (dates are MM-DD).",
		parameters: {
			type: "object",
			properties: { days: { type: "integer", description: "1-90, default 14" } },
		},
		run: (input) => stats.getTrend(Math.min(Math.max(Number(input.days) || 14, 1), 90)),
	},
	{
		name: "get_revenue_by_floor",
		description: "Booking revenue per floor (F1 Garden, F2 Classic, F3 Executive, F4 Penthouse).",
		parameters: noInput,
		run: () => stats.getRevenueByFloor(),
	},
	{
		name: "get_booking_mix",
		description: "Number of bookings per room type.",
		parameters: noInput,
		run: () => stats.getBookingMix(),
	},
	{
		name: "get_staff",
		description: "Each staff member's shift today, guests they're attending, and check-ins handled.",
		parameters: noInput,
		run: () => stats.getStaff(),
	},
	{
		name: "get_recent_reviews",
		description: "Most recent guest reviews, newest first.",
		parameters: {
			type: "object",
			properties: { limit: { type: "integer", description: "1-50, default 10" } },
		},
		run: (input) =>
			stats.getRecentReviews(Math.min(Math.max(Number(input.limit) || 10, 1), 50)),
	},
	{
		name: "list_bookings",
		description:
			"Individual bookings, optionally filtered by status and by check-in date range.",
		parameters: {
			type: "object",
			properties: {
				status: { type: "string", enum: ["booked", "staying", "completed", "cancelled"] },
				from: { type: "string", description: "Earliest check-in, YYYY-MM-DD" },
				to: { type: "string", description: "Latest check-in, YYYY-MM-DD" },
			},
		},
		run(input) {
			return bookingRepo
				.getAll()
				.filter((b) => !input.status || b.status === input.status)
				.filter((b) => !input.from || b.checkIn >= input.from)
				.filter((b) => !input.to || b.checkIn <= input.to)
				.slice(-100)
				.map((b) => ({
					bookingId: b.id,
					guest: b.userName,
					roomId: b.roomId,
					roomType: b.roomType,
					floor: b.floor,
					checkIn: b.checkIn,
					checkOut: b.checkOut,
					total: b.total,
					status: b.status,
					createdAt: b.createdAt,
				}));
		},
	},
];
