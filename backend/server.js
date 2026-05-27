// Entry point for the Express server
const express = require("express");
const path = require("path");
const fs = require("fs");

const authRoutes = require("./routes/auth.routes");
const roomRoutes = require("./routes/room.routes");
const bookingRoutes = require("./routes/booking.routes");
const paymentRoutes = require("./routes/payment.routes");
const shiftRoutes = require("./routes/shift.routes");
const checkinRoutes = require("./routes/checkin.routes");
const managerRoutes = require("./routes/manager.routes");

const app = express();
const PORT = process.env.PORT || 3000;

// Parse incoming JSON request bodies
app.use(express.json());

// ── API routes - must come before express.static ──────────────
app.use("/auth", authRoutes);
app.use("/rooms", roomRoutes);
app.use("/bookings", bookingRoutes);
app.use("/payment", paymentRoutes);
app.use("/shifts", shiftRoutes);
app.use("/checkins", checkinRoutes);
app.use("/manager", managerRoutes);

// Public reviews endpoint - before static so it isn't intercepted
app.get("/reviews", (req, res) => {
	const reviews = JSON.parse(
		fs.readFileSync(path.join(__dirname, "data/reviews.json"), "utf8"),
	);
	res.json(reviews);
});

// ── Static files - serves frontend HTML/CSS/JS ────────────────
app.use(express.static(path.join(__dirname, "../frontend")));

// ── Fallback - any unmatched route serves index.html ──────────
app.get("/{*path}", (req, res) => {
	res.sendFile(path.join(__dirname, "../frontend/pages/index.html"));
});

app.listen(PORT, () => {
	console.log(`La Extravaganza server running on http://localhost:${PORT}`);
});

module.exports = app;
