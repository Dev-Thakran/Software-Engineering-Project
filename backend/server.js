// Entry point for the Express server
const express = require("express");
const path = require("path");

const authRoutes = require("./routes/auth.routes");
const roomRoutes = require("./routes/room.routes");
const bookingRoutes = require("./routes/booking.routes");
const paymentRoutes = require("./routes/payment.routes");
const shiftRoutes = require("./routes/shift.routes");
const checkinRoutes = require("./routes/checkin.routes");
const managerRoutes = require("./routes/manager.routes");
const aiRoutes = require("./routes/ai.routes");
const reviewRoutes = require("./routes/review.routes");

const app = express();
const PORT = process.env.PORT || 3000;

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

// - Static files — serves frontend HTML/CSS/JS --------
app.use(express.static(path.join(__dirname, "../frontend")));
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
