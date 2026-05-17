// Entry point for the Express server
// We use Express because it simplifies routing and middleware compared to raw Node http module
const express = require("express");
const path = require("path");

const authRoutes = require("./routes/auth.routes");
const roomRoutes = require("./routes/room.routes");
const bookingRoutes = require("./routes/booking.routes");
const paymentRoutes = require("./routes/payment.routes");

const app = express();
const PORT = process.env.PORT || 3000;
const shiftRoutes = require("./routes/shift.routes");
const checkinRoutes = require('./routes/checkin.routes')
app.use('/checkins', checkinRoutes)
app.use("/shifts", shiftRoutes);
// Parse incoming JSON request bodies
app.use(express.json());

// Serve all frontend files as static assets
// This means typing localhost:3000 loads frontend/pages/index.html
app.use(express.static(path.join(__dirname, "../frontend")));

// Mount all route groups under their base paths
app.use("/auth", authRoutes);
app.use("/rooms", roomRoutes);
app.use("/bookings", bookingRoutes);
app.use("/payment", paymentRoutes);

// Fallback — serve index.html for any unmatched route
app.get("/{*path}", (req, res) => {
	res.sendFile(path.join(__dirname, "../frontend/pages/index.html"));
});

app.listen(PORT, () => {
	console.log(`The Grand Auckland server running on http://localhost:${PORT}`);
});

module.exports = app;
