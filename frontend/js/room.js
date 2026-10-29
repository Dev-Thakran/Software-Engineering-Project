// ============================================================
//  room.js - One room: gallery, availability calendar, live
//  price panel, amenities, reviews and similar rooms
//  URL: room.html?room=301[&checkIn=…&checkOut=…&guests=2]
// ============================================================

const FLOOR_NAMES = { 1: "Garden", 2: "Classic", 3: "Executive", 4: "Penthouse" };
const TAX = 30;
const ADVANCE_PERCENT = 10; // Advance purchase rate - matches backend/config/rate-plans.js

const $ = (id) => document.getElementById(id);
const { dates } = UI;

const state = {
	room: null,
	booked: [], // [{ checkIn, checkOut }]
	checkIn: "",
	checkOut: "",
	monthOffset: 0, // first month shown, counted from this month
};

document.addEventListener("DOMContentLoaded", async () => {
	const params = new URLSearchParams(location.search);
	const roomId = params.get("room") || params.get("roomId") || params.get("id");
	if (!roomId) {
		location.href = "./browserooms.html";
		return;
	}

	// Keep the visitor's search when they go back to the list
	const back = new URLSearchParams(location.search);
	back.delete("room");
	if (back.toString()) $("back-link").href = "./browserooms.html?" + back;

	try {
		const [roomRes, amenities, booked, reviews, rooms] = await Promise.all([
			fetch(`/rooms/${encodeURIComponent(roomId)}`),
			fetch(`/rooms/${encodeURIComponent(roomId)}/amenities`).then((r) => (r.ok ? r.json() : [])),
			fetch(`/rooms/${encodeURIComponent(roomId)}/booked`).then((r) => (r.ok ? r.json() : [])),
			fetch(`/reviews?roomId=${encodeURIComponent(roomId)}`).then((r) => (r.ok ? r.json() : [])),
			fetch("/rooms").then((r) => (r.ok ? r.json() : [])),
		]);
		if (!roomRes.ok) throw new Error("Room not found");
		state.room = await roomRes.json();
		state.booked = booked;

		renderDetails(state.room, amenities);
		renderGallery(state.room);
		renderReviews(reviews);
		renderSimilar(state.room, rooms);
		setUpPanel(params);
		setUpCalendar();
		$("room-content").removeAttribute("aria-busy");
	} catch (err) {
		console.error(err);
		$("room-content").outerHTML = `
			<div class="empty-state mt-8">
				<h3 class="font-serif">We couldn't find that room.</h3>
				<p>It may have been removed, or the link is incomplete.</p>
				<a href="./browserooms.html" class="btn-primary">See all rooms</a>
			</div>`;
	}
});

//  DETAILS
function renderDetails(room, amenities) {
	const tier = room.tier || {};
	document.title = `Room ${room.id} · ${room.type} – La Extravaganza`;
	$("room-floor-label").textContent = `Floor ${room.floor} · ${FLOOR_NAMES[room.floor] || ""}`;
	$("room-name").textContent = `Room ${room.id}`;
	$("room-type").textContent = room.type;
	$("room-meta").innerHTML = `
		${tier.bed ? `<span>${UI.icon("bed")}${UI.escape(tier.bed)}</span>` : ""}
		<span>${UI.icon("guests")}Up to ${room.maxGuests} ${room.maxGuests === 1 ? "guest" : "guests"}</span>
		${tier.sizeSqm ? `<span>${UI.icon("area")}${tier.sizeSqm} m²</span>` : ""}
		${tier.view ? `<span>${UI.icon("eye")}${UI.escape(tier.view)}</span>` : ""}
		${room.accessible ? `<span>${UI.icon("access")}Accessible room</span>` : ""}`;
	// The floor's story, then what makes this particular room different
	$("room-story").textContent = tier.story || "";
	$("room-description").textContent = room.description || "";
	$("room-highlights").innerHTML = (tier.highlights || []).map((h) => `<li>${UI.escape(h)}</li>`).join("");
	$("panel-price").textContent = UI.money(room.price);
	$("panel-advance").textContent = `or ${UI.money(Math.round(room.price * (1 - ADVANCE_PERCENT / 100)))}/night with Advance purchase (non-refundable)`;
	renderAccessibility(room);

	$("amenities-grid").innerHTML = amenities.length
		? amenities.map((a) => `<div class="amenity-item">${UI.icon("check")}<span>${UI.escape(a)}</span></div>`).join("")
		: `<p class="text-sm" style="color:var(--lux-text-muted)">Amenities for this room are being updated.</p>`;
}

//  GALLERY - the room's own photo first, then its floor's other photos
// Accessible rooms list their features; other rooms point to the accessible
// room on the same floor
async function renderAccessibility(room) {
	const box = $("room-access");
	if (room.accessible) {
		box.innerHTML = `
			<p class="kicker mb-2">Accessibility</p>
			<h2 class="font-serif text-3xl md:text-4xl mb-4" style="color: var(--lux-brown-800)">Designed for easy access</h2>
			<ul class="access-list">${(room.accessibleFeatures || []).map((f) => `<li>${UI.icon("check")}<span>${UI.escape(f)}</span></li>`).join("")}</ul>
			<p class="text-sm mt-4" style="color: var(--lux-text-muted)">More about access at the hotel in our <a href="/pages/accessibility.html" style="text-decoration:underline">accessibility statement</a>.</p>`;
		box.hidden = false;
		return;
	}
	const sameFloor = await fetch(`/rooms?floor=${room.floor}&accessible=1`).then((r) => (r.ok ? r.json() : [])).catch(() => []);
	if (!sameFloor.length) return;
	const params = new URLSearchParams(location.search);
	params.set("room", sameFloor[0].id);
	box.innerHTML = `<p class="access-note">${UI.icon("access")}<span>Need an accessible room? <a href="/pages/room.html?${params}">Room ${UI.escape(sameFloor[0].id)}</a> on this floor has a roll-in shower, grab rails and step-free access.</span></p>`;
	box.hidden = false;
}

function renderGallery(room) {
	const own = room.image ? room.image.trim().replace("../frontend/", "/") : "";
	const floorPhotos = room.tier?.photos || [];
	const photos = [...new Set([own, ...floorPhotos].filter(Boolean))];

	const main = $("room-image");
	const show = (index) => {
		main.style.opacity = "0";
		setTimeout(() => {
			main.src = photos[index];
			main.alt = `Room ${room.id}, photo ${index + 1} of ${photos.length}`;
			main.style.opacity = "1";
		}, 150);
		$("gallery-thumbs").querySelectorAll("button").forEach((b, i) => b.setAttribute("aria-current", String(i === index)));
	};

	main.onload = () => $("gallery-main").classList.remove("skeleton");
	main.src = photos[0];
	main.alt = `Room ${room.id}, photo 1 of ${photos.length}`;
	main.hidden = false;

	if (photos.length < 2) return;
	$("gallery-thumbs").innerHTML = photos
		.map((src, i) => `
			<button type="button" class="gallery-thumb" aria-label="Show photo ${i + 1}" aria-current="${i === 0}">
				<img src="${UI.escape(src)}" alt="" loading="lazy" onerror="this.closest('button').remove()" />
			</button>`)
		.join("");
	$("gallery-thumbs").querySelectorAll("button").forEach((b, i) => b.addEventListener("click", () => show(i)));
}

//  REVIEWS
function stars(rating) {
	return `<span class="stars" aria-label="${rating} out of 5 stars">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</span>`;
}

function renderReviews(reviews) {
	const list = [...reviews].sort((a, b) => b.date.localeCompare(a.date));
	if (!list.length) {
		$("panel-rating").textContent = "New to reviews - be one of the first guests to share your stay.";
		$("reviews-list").innerHTML = `
			<p class="font-serif italic" style="font-size:20px; color:var(--lux-text-muted)">
				No reviews yet for this room.
			</p>`;
		return;
	}
	const avg = list.reduce((s, r) => s + r.rating, 0) / list.length;
	const summary = `${avg.toFixed(1)} out of 5 · ${list.length} ${list.length === 1 ? "review" : "reviews"}`;
	$("panel-rating").innerHTML = `${stars(Math.round(avg))} &nbsp;${summary}`;
	$("reviews-summary").textContent = summary;
	$("reviews-list").innerHTML = list
		.map((r) => `
			<article class="review-item">
				<p class="mb-2">${stars(r.rating)}</p>
				${r.title ? `<h3 class="font-serif text-xl mb-2" style="color:var(--lux-brown-800)">${UI.escape(r.title)}</h3>` : ""}
				<p style="font-size:15px; color:var(--lux-brown-600); line-height:1.7; max-width:62ch">${UI.escape(r.comment)}</p>
				<p class="kicker mt-3" style="font-size:11px">${UI.escape(r.guestName)} · ${dates.pretty(r.date, true)}</p>
			</article>`)
		.join("");
}

//  SIMILAR ROOMS - same floor first, then the floors either side
function renderSimilar(room, rooms) {
	const others = rooms
		.filter((r) => r.id !== room.id)
		.sort((a, b) => Math.abs(a.floor - room.floor) - Math.abs(b.floor - room.floor) || a.price - b.price)
		.slice(0, 3);
	if (!others.length) return;
	$("similar-section").hidden = false;
	$("similar-rooms").innerHTML = others
		.map((r) => {
			const img = r.image ? r.image.replace("../frontend/", "/") : "";
			const params = new URLSearchParams({ room: r.id });
			if (state.checkIn) {
				params.set("checkIn", state.checkIn);
				params.set("checkOut", state.checkOut);
			}
			return `
				<a class="room-card" href="./room.html?${params}">
					<div class="room-card-photo">
						${img ? `<img src="${UI.escape(img)}" alt="" loading="lazy" />` : ""}
						<span class="room-card-tag left">Floor ${r.floor}</span>
					</div>
					<div class="room-card-body">
						<p class="kicker" style="font-size:11px">${FLOOR_NAMES[r.floor] || ""}</p>
						<h3 class="font-serif mt-1" style="font-size:24px; color:#2C241B">Room ${UI.escape(r.id)}</h3>
						<p class="mb-4" style="font-size:13px; color:var(--lux-text-muted)">${UI.escape(r.type)}</p>
						<div class="room-card-foot">
							<div><p class="price-big">${UI.money(r.price)}</p><p class="price-note">per night</p></div>
							<span class="room-card-cta">View room ${UI.icon("arrow")}</span>
						</div>
					</div>
				</a>`;
		})
		.join("");
}

//  BOOKING PANEL
function setUpPanel(params) {
	const room = state.room;
	const adults = $("adults");
	const children = $("children");
	const max = room.maxGuests;
	const wanted = UI.party.fromParams(params, { adults: Math.min(2, max), children: 0 });
	adults.innerHTML = Array.from({ length: max }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
	adults.value = String(Math.min(Math.max(wanted.adults, 1), max));
	// Children count toward the room's limit, so offer only what still fits
	const fillChildren = (keep) => {
		const space = max - Number(adults.value);
		children.innerHTML = Array.from({ length: space + 1 }, (_, i) => `<option value="${i}">${i}</option>`).join("");
		children.value = String(Math.min(keep, space));
		children.disabled = space === 0;
	};
	fillChildren(wanted.children);
	adults.addEventListener("change", () => fillChildren(Number(children.value)));
	const promo = /^[A-Za-z0-9]{1,20}$/.test(params.get("promo") || "") ? params.get("promo").toUpperCase() : "";

	const today = dates.today();
	$("checkIn").min = today;
	$("checkOut").min = dates.addDays(today, 1);

	if (dates.valid(params.get("checkIn")) && dates.valid(params.get("checkOut")) && params.get("checkIn") >= today) {
		setStay(params.get("checkIn"), params.get("checkOut"));
	}

	$("checkIn").addEventListener("change", () => {
		const from = $("checkIn").value;
		let to = $("checkOut").value;
		if (from && (!to || to <= from)) to = dates.addDays(from, 1);
		setStay(from, to);
	});
	$("checkOut").addEventListener("change", () => setStay($("checkIn").value, $("checkOut").value));

	$("book-form").addEventListener("submit", (e) => {
		e.preventDefault();
		const problem = stayProblem(state.checkIn, state.checkOut);
		if (!state.checkIn || problem) {
			showNote(problem || "Choose your dates to reserve - use the boxes above or the calendar.", "bad");
			(state.checkIn ? $("checkOut") : $("checkIn")).focus();
			return;
		}
		const next = new URLSearchParams({
			room: room.id,
			checkIn: state.checkIn,
			checkOut: state.checkOut,
		});
		UI.party.toParams(next, { adults: Number(adults.value), children: Number(children.value) });
		if (promo) next.set("promo", promo);
		location.href = `/pages/bookingform.html?${next}`;
	});
}

// Is any night of this stay already taken?
function nightTaken(day) {
	return state.booked.some((b) => b.checkIn <= day && day < b.checkOut);
}

function stayProblem(from, to) {
	if (!from || !to) return null;
	if (from < dates.today()) return "Check-in can't be in the past.";
	if (to <= from) return "Check-out needs to be after check-in.";
	for (let d = from; d < to; d = dates.addDays(d, 1)) {
		if (nightTaken(d)) return `Sorry - the night of ${dates.pretty(d)} is already booked. Try different dates.`;
	}
	return null;
}

function setStay(from, to) {
	state.checkIn = from || "";
	state.checkOut = to || "";
	$("checkIn").value = state.checkIn;
	$("checkOut").value = state.checkOut;
	if (state.checkIn) $("checkOut").min = dates.addDays(state.checkIn, 1);
	updatePrice();
	renderCalendar();
}

function showNote(message, kind) {
	const note = $("avail-note");
	note.hidden = !message;
	note.className = `avail-note ${kind || ""}`;
	note.innerHTML = message ? `${UI.icon(kind === "ok" ? "check" : "close")}<span>${UI.escape(message)}</span>` : "";
}

function updatePrice() {
	const { checkIn, checkOut, room } = state;
	const problem = stayProblem(checkIn, checkOut);
	const nights = checkIn && checkOut ? dates.nights(checkIn, checkOut) : 0;

	$("price-breakdown").hidden = !(nights > 0 && !problem);
	if (nights > 0 && !problem) {
		const sub = nights * room.price;
		$("pb-line").textContent = `${UI.money(room.price)} × ${nights} ${nights === 1 ? "night" : "nights"}`;
		$("pb-sub").textContent = UI.money(sub);
		$("pb-total").textContent = UI.money(sub + TAX);
		showNote(`Free for ${dates.pretty(checkIn)} to ${dates.pretty(checkOut)}`, "ok");
	} else {
		showNote(problem, "bad");
	}
	$("reserve-btn").textContent = nights > 0 && !problem ? `Reserve · ${UI.money(nights * room.price + TAX)}` : "Reserve this room";
}

//  CALENDAR - two months at a time; tap arrival then departure
function setUpCalendar() {
	$("cal-prev").addEventListener("click", () => {
		state.monthOffset = Math.max(0, state.monthOffset - 1);
		renderCalendar();
	});
	$("cal-next").addEventListener("click", () => {
		state.monthOffset = Math.min(10, state.monthOffset + 1);
		renderCalendar();
	});
	$("calendar").addEventListener("click", (e) => {
		const day = e.target.closest("[data-day]")?.dataset.day;
		if (day) pickDay(day);
	});
	// If a stay was passed in, open the calendar on its month
	if (state.checkIn) {
		const now = new Date();
		const start = new Date(state.checkIn + "T12:00:00");
		state.monthOffset = Math.max(0, (start.getFullYear() - now.getFullYear()) * 12 + start.getMonth() - now.getMonth());
	}
	renderCalendar();
}

function pickDay(day) {
	const { checkIn, checkOut } = state;
	// Start a new stay, unless this completes one that has only an arrival day
	if (!checkIn || checkOut || day <= checkIn) {
		if (nightTaken(day)) return;
		state.checkIn = day;
		state.checkOut = "";
		$("checkIn").value = day;
		$("checkOut").value = "";
		$("cal-status").textContent = `Arriving ${dates.pretty(day)} - now pick your departure day`;
		$("price-breakdown").hidden = true;
		showNote("", "");
		renderCalendar();
		return;
	}
	setStay(checkIn, day);
	$("cal-status").textContent = `${dates.pretty(checkIn)} to ${dates.pretty(day)}`;
}

function renderCalendar() {
	const cal = $("calendar");
	if (!cal || !state.room) return;
	const now = new Date();
	const today = dates.today();
	const html = [0, 1].map((i) => {
		const first = new Date(now.getFullYear(), now.getMonth() + state.monthOffset + i, 1, 12);
		const title = first.toLocaleDateString("en-NZ", { month: "long", year: "numeric" });
		const lead = (first.getDay() + 6) % 7; // weeks start on Monday
		const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
		const cells = [];
		for (let k = 0; k < lead; k++) cells.push("<span></span>");
		for (let d = 1; d <= daysInMonth; d++) {
			const ymd = new Date(first.getFullYear(), first.getMonth(), d, 12).toLocaleDateString("en-CA");
			const past = ymd < today;
			const taken = nightTaken(ymd);
			// A taken night can still be a departure day for a stay that ends there
			const canDepart = state.checkIn && !state.checkOut && ymd > state.checkIn && !stayProblem(state.checkIn, ymd);
			const disabled = past || (taken && !canDepart);
			const selected = ymd === state.checkIn || ymd === state.checkOut;
			const inRange = state.checkIn && state.checkOut && ymd > state.checkIn && ymd < state.checkOut;
			const cls = ["cal-day", taken ? "booked" : "", selected ? "selected" : "", inRange ? "in-range" : ""].join(" ");
			const label = `${dates.pretty(ymd, true)}${taken ? ", booked" : ""}${selected ? ", selected" : ""}`;
			cells.push(`<button type="button" class="${cls}" data-day="${ymd}" ${disabled ? "disabled" : ""} aria-label="${label}" aria-pressed="${selected}">${d}</button>`);
		}
		return `
			<div>
				<p class="font-serif text-xl mb-3" style="color:var(--lux-brown-800)">${title}</p>
				<div class="cal-grid">
					${["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => `<span class="cal-dow" aria-hidden="true">${d}</span>`).join("")}
					${cells.join("")}
				</div>
			</div>`;
	});
	cal.innerHTML = html.join("");
	$("cal-prev").disabled = state.monthOffset === 0;
	$("cal-next").disabled = state.monthOffset >= 10;
	if (!state.checkIn) $("cal-status").textContent = "Tap your arrival day";
}
