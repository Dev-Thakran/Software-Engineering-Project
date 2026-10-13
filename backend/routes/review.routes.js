const express = require("express");
const reviewRepo = require("../repositories/review.repository");
const bookingRepo = require("../repositories/booking.repository");
const { authenticate, requireRole } = require("../middleware/auth.middleware");
const router = express.Router();

// Public list of reviews, optionally for one room (?roomId=301)
router.get("/", (req, res) => {
	let reviews = reviewRepo.getAll();
	if (req.query.roomId) reviews = reviews.filter((r) => r.roomId === req.query.roomId);
	res.json(reviews);
});

// A guest reviews one of their own finished stays, once
router.post("/", authenticate, requireRole("customer"), (req, res) => {
	const { bookingId, title, comment } = req.body || {};
	const rating = Number(req.body?.rating);
	if (!Number.isInteger(rating) || rating < 1 || rating > 5)
		return res.status(400).json({ error: "Rating must be 1 to 5 stars" });
	if (!String(comment || "").trim())
		return res.status(400).json({ error: "Please write a few words about your stay" });

	const booking = bookingRepo.findById(bookingId);
	if (!booking || booking.userId !== req.user.id)
		return res.status(404).json({ error: "Booking not found" });
	if (booking.status !== "completed")
		return res.status(409).json({ error: "You can review a stay once you have checked out" });
	if (booking.reviewed || reviewRepo.getAll().some((r) => r.bookingId === booking.id))
		return res.status(409).json({ error: "You have already reviewed this stay" });

	const review = reviewRepo.add({
		id: "r" + Date.now(),
		bookingId: booking.id,
		guestName: req.user.name,
		roomId: booking.roomId,
		roomType: booking.roomType,
		rating,
		title: String(title || "").trim().slice(0, 80),
		comment: String(comment).trim().slice(0, 1000),
		date: new Date().toLocaleDateString("en-CA"),
	});
	bookingRepo.update(booking.id, { reviewed: true });
	res.status(201).json(review);
});

module.exports = router;
