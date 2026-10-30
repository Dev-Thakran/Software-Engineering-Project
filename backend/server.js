// Entry point for the Express server
const express = require("express");
const path = require("path");
const compression = require("compression");

const authRoutes = require("./routes/auth.routes");
const roomRoutes = require("./routes/room.routes");
const bookingRoutes = require("./routes/booking.routes");
const paymentRoutes = require("./routes/payment.routes");
const shiftRoutes = require("./routes/shift.routes");
const checkinRoutes = require("./routes/checkin.routes");
const managerRoutes = require("./routes/manager.routes");
const aiRoutes = require("./routes/ai.routes");
const reviewRoutes = require("./routes/review.routes");
const promoRoutes = require("./routes/promo.routes");

const app = express();
const PORT = process.env.PORT || 3000;

// Gzip responses (pages, CSS, JS and JSON shrink to about a quarter).
// The manager's live-update stream is left alone, or updates would be held back.
app.use(
	compression({
		filter: (req, res) =>
			!String(res.getHeader("Content-Type") || req.headers.accept || "").includes("text/event-stream") &&
			compression.filter(req, res),
	}),
);

// Parse incoming JSON request bodies
app.use(express.json());

// - API routes — must come before express.static --------
app.use("/auth", authRoutes);
app.use("/rooms", roomRoutes);
app.use("/bookings", bookingRoutes);
app.use("/payment", paymentRoutes);
app.use("/shifts", shiftRoutes);
app.use("/checkins", checkinRoutes);
app.use("/manager", managerRoutes);
app.use("/ai", aiRoutes);
app.use("/reviews", reviewRoutes); // public list, customers post their own
app.use("/promos", promoRoutes); // public promo-code check

// - Static files — serves frontend HTML/CSS/JS --------
// Photos and fonts rarely change, so browsers keep them for a week. Pages,
// CSS and JS are re-checked every time (a quick 304 when unchanged), so
// edits show up straight away.
const LONG_CACHE = /\.(webp|jpe?g|png|svg|ico|woff2?)$/i;
app.use(
	express.static(path.join(__dirname, "../frontend"), {
		setHeaders(res, file) {
			res.setHeader("Cache-Control", LONG_CACHE.test(file) ? "public, max-age=604800" : "no-cache");
		},
	}),
);
// Chart.js for the manager dashboard, served locally so it loads fast and offline
app.use("/vendor/chart.js", express.static(path.join(__dirname, "../node_modules/chart.js/dist")));

// - Home page at the site root, a friendly 404 page for anything else -----
app.get("/", (req, res) => {
	res.sendFile(path.join(__dirname, "../frontend/pages/index.html"));
});
app.use((req, res) => {
	res.status(404).sendFile(path.join(__dirname, "../frontend/pages/404.html"));
});

// Only start listening when this file is run directly (npm run dev)
// When imported by tests, the test creates its own server on a random port
if (require.main === module) {
	app.listen(PORT, () => {
		console.log(`La Extravaganza server running on http://localhost:${PORT}`);
	});
}

module.exports = app;
