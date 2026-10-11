// Fills the home page's figures from live data: room and floor counts,
// average review score, each floor's cheapest price, and a real review
document.addEventListener("DOMContentLoaded", async function () {
	try {
		const [rooms, reviews] = await Promise.all([
			fetch("/rooms").then((r) => r.json()),
			fetch("/reviews").then((r) => r.json()),
		]);

		document.getElementById("home-rooms").textContent = rooms.length;
		document.getElementById("home-floors").textContent = new Set(
			rooms.map((r) => r.floor),
		).size;

		if (reviews.length) {
			const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
			document.getElementById("home-rating").textContent = avg.toFixed(1);
		}

		document.querySelectorAll("[data-floor-price]").forEach((el) => {
			const prices = rooms
				.filter((r) => r.floor === Number(el.dataset.floorPrice))
				.map((r) => r.price);
			if (prices.length) el.textContent = "$" + Math.min(...prices).toLocaleString();
		});

		// Feature the newest of the highest-rated reviews
		const best = Math.max(...reviews.map((r) => r.rating));
		const review = reviews.filter((r) => r.rating === best).at(-1);
		if (review) {
			const room = rooms.find((r) => r.id === review.roomId);
			const month = new Date(review.date).toLocaleDateString("en-NZ", { month: "long" });
			document.getElementById("home-review-stars").textContent =
				"★".repeat(review.rating) + "☆".repeat(5 - review.rating);
			document.getElementById("home-review-text").textContent = `"${review.comment}"`;
			document.getElementById("home-review-author").textContent =
				`- ${review.guestName}, ${room ? "Floor " + room.floor : "Room " + review.roomId}, ${month}`;
		}
	} catch (err) {
		console.error("Could not load home page figures:", err);
	}
});
