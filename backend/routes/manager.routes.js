const express = require("express");
const stats = require("../services/stats.service");
const events = require("../services/events.service");
const { authenticate, requireRole } = require("../middleware/auth.middleware");
const router = express.Router();

// Every manager route needs a manager login
router.use(authenticate, requireRole("manager"));

router.get("/stats", (req, res) => res.json(stats.getOverview()));
router.get("/top-rooms", (req, res) => res.json(stats.getTopRooms()));
router.get("/trend", (req, res) => res.json(stats.getTrend()));
router.get("/revenue-by-floor", (req, res) =>
	res.json(stats.getRevenueByFloor()),
);
router.get("/booking-mix", (req, res) => res.json(stats.getBookingMix()));
router.get("/staff", (req, res) => res.json(stats.getStaff()));
router.get("/reviews", (req, res) => res.json(stats.getRecentReviews()));

// Figures for the last 7, 30 or 90 days, compared with the period before
router.get("/period", (req, res) => {
	const days = Number(req.query.days) || 30;
	if (![7, 30, 90].includes(days))
		return res.status(400).json({ error: "days must be 7, 30 or 90" });
	res.json(stats.getPeriod(days));
});

// Live updates: the dashboard keeps this connection open and gets a
// "change" message whenever hotel data changes, then re-fetches its numbers.
// Several saves in quick succession (e.g. a check-in) are sent as one.
router.get("/live", (req, res) => {
	res.writeHead(200, {
		"Content-Type": "text/event-stream",
		"Cache-Control": "no-cache",
		Connection: "keep-alive",
	});
	res.write("event: ready\ndata: {}\n\n");

	let pending = null;
	const stop = events.onChange(() => {
		clearTimeout(pending);
		pending = setTimeout(() => res.write(`event: change\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`), 300);
	});
	// A comment line every 25s keeps proxies and browsers from closing it
	const keepAlive = setInterval(() => res.write(": keep-alive\n\n"), 25000);

	req.on("close", () => {
		stop();
		clearTimeout(pending);
		clearInterval(keepAlive);
	});
});

module.exports = router;
