const express = require("express");
const stats = require("../services/stats.service");
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

module.exports = router;
