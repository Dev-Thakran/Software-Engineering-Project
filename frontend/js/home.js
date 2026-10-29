// Fills the home page's figures from live data: room and floor counts,
// average review score, each floor's cheapest price and recent reviews.
// Also runs the hero's date search.
document.addEventListener("DOMContentLoaded", async function () {
	setUpHeroSearch();

	try {
		const [rooms, reviews] = await Promise.all([
			fetch("/rooms").then((r) => r.json()),
			fetch("/reviews").then((r) => r.json()),
		]);

		document.getElementById("home-rooms").textContent = rooms.length;
		document.getElementById("home-floors").textContent = new Set(rooms.map((r) => r.floor)).size;

		if (reviews.length) {
			const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
			document.getElementById("home-rating").textContent = avg.toFixed(1);
		}

		document.querySelectorAll("[data-floor-price]").forEach((el) => {
			const prices = rooms.filter((r) => r.floor === Number(el.dataset.floorPrice)).map((r) => r.price);
			if (prices.length) el.textContent = UI.money(Math.min(...prices));
		});

		rotateReviews(reviews, rooms);
	} catch (err) {
		console.error("Could not load home page figures:", err);
	}
});

//  Hero search: dates + guests -> the rooms page showing what's free
function setUpHeroSearch() {
	const form = document.getElementById("hero-search");
	if (!form) return;
	const checkIn = document.getElementById("hero-checkin");
	const checkOut = document.getElementById("hero-checkout");
	const error = document.getElementById("hero-error");
	const today = UI.dates.today();
	checkIn.min = today;
	checkOut.min = UI.dates.addDays(today, 1);

	const adults = document.getElementById("hero-adults");
	const children = document.getElementById("hero-children");
	UI.party.fillSelects(adults, children, { adults: 2, children: 0 });

	checkIn.addEventListener("change", () => {
		if (!checkIn.value) return;
		const earliest = UI.dates.addDays(checkIn.value, 1);
		checkOut.min = earliest;
		if (!checkOut.value || checkOut.value < earliest) checkOut.value = earliest;
	});

	// "Have a promo code?" reveals a small field; the code travels with the search
	const toggle = document.getElementById("promo-toggle");
	const box = document.getElementById("promo-box");
	const promoInput = document.getElementById("hero-promo");
	toggle.addEventListener("click", () => {
		box.hidden = !box.hidden;
		toggle.setAttribute("aria-expanded", String(!box.hidden));
		if (!box.hidden) promoInput.focus();
	});

	form.addEventListener("submit", async (e) => {
		e.preventDefault();
		const party = { adults: Number(adults.value), children: Number(children.value) };
		let problem = "";
		let badField = checkIn;
		if (!checkIn.value || !checkOut.value) {
			problem = "Choose your check-in and check-out dates.";
			badField = checkIn.value ? checkOut : checkIn;
		} else if (checkIn.value < today) problem = "Check-in can't be in the past.";
		else if (checkOut.value <= checkIn.value) {
			problem = "Check-out needs to be after check-in.";
			badField = checkOut;
		} else if (UI.party.total(party) > 4) {
			problem = "Our largest suites sleep 4 - children count too.";
			badField = children;
		}
		error.textContent = problem;
		error.hidden = !problem;
		[checkIn, checkOut, children].forEach((el) => el.setAttribute("aria-invalid", String(el === badField && !!problem)));
		if (problem) return badField.focus();

		const params = new URLSearchParams({ checkIn: checkIn.value, checkOut: checkOut.value });
		UI.party.toParams(params, party);
		const code = promoInput.value.trim();
		if (code) {
			const res = await fetch(`/promos/${encodeURIComponent(code)}`).catch(() => null);
			if (!res || !res.ok) {
				document.getElementById("promo-note").textContent = "That code isn't valid or has expired.";
				return promoInput.focus();
			}
			params.set("promo", (await res.json()).code);
		}
		location.href = `/pages/browserooms.html?${params}`;
	});
}

//  Reviews: the newest well-rated ones, one at a time
function rotateReviews(reviews, rooms) {
	const picks = reviews
		.filter((r) => r.rating >= 4 && r.comment)
		.sort((a, b) => b.date.localeCompare(a.date))
		.slice(0, 5);
	if (!picks.length) return;

	const stars = document.getElementById("home-review-stars");
	const text = document.getElementById("home-review-text");
	const author = document.getElementById("home-review-author");
	const dots = document.getElementById("home-review-dots");
	document.getElementById("home-review-count").textContent = `From ${reviews.length} guest reviews`;

	let current = 0;
	let timer = null;
	const show = (i) => {
		current = i;
		const review = picks[i];
		const room = rooms.find((r) => r.id === review.roomId);
		const month = new Date(review.date + "T12:00:00").toLocaleDateString("en-NZ", { month: "long" });
		[stars, text, author].forEach((el) => (el.style.opacity = "0"));
		setTimeout(() => {
			stars.textContent = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
			stars.setAttribute("aria-label", `${review.rating} out of 5 stars`);
			text.textContent = `"${review.comment}"`;
			author.textContent = `- ${review.guestName}, ${room ? "Floor " + room.floor : "Room " + review.roomId}, ${month}`;
			[stars, text, author].forEach((el) => (el.style.opacity = "1"));
		}, 250);
		dots.querySelectorAll("button").forEach((d, n) => d.setAttribute("aria-current", String(n === i)));
	};

	[stars, text, author].forEach((el) => (el.style.transition = "opacity 0.25s"));
	if (picks.length > 1) {
		dots.innerHTML = picks
			.map((_, i) => `<button type="button" aria-label="Show review ${i + 1} of ${picks.length}" style="width:28px;height:28px;display:grid;place-items:center;background:none;border:none;cursor:pointer"><span style="width:8px;height:8px;border-radius:50%;background:currentColor;color:#c9a961;opacity:.9"></span></button>`)
			.join("");
		const style = document.createElement("style");
		style.textContent = `#home-review-dots button[aria-current="false"] span { opacity: .3 !important; }`;
		document.head.appendChild(style);
		dots.querySelectorAll("button").forEach((d, i) =>
			d.addEventListener("click", () => {
				clearInterval(timer); // the visitor has taken over - stop auto-advancing
				show(i);
			}),
		);
		const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (!reduceMotion) timer = setInterval(() => show((current + 1) % picks.length), 8000);
	}
	show(0);
}
