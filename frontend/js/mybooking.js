// ============================================================
//  mybooking.js - My Stays: the next stay with a countdown,
//  other upcoming stays, past stays with reviews, and cancelling
// ============================================================

const FLOOR_NAMES = { 1: "Garden", 2: "Classic", 3: "Executive", 4: "Penthouse" };
const $ = (id) => document.getElementById(id);
const { dates } = UI;

let bookings = [];
let roomsById = {};

document.addEventListener("DOMContentLoaded", async () => {
	const token = localStorage.getItem("token");
	const role = localStorage.getItem("role");
	if (!token) {
		location.href = `/pages/Login.html?redirect=${encodeURIComponent(location.pathname)}`;
		return;
	}
	if (role === "staff" || role === "manager") {
		location.href = `/pages/${role}.html`;
		return;
	}
	const firstName = (localStorage.getItem("name") || "").split(" ")[0];
	if (firstName) $("welcome-kicker").textContent = `Welcome back, ${firstName}`;
	load();
});

async function load() {
	try {
		const [res, rooms] = await Promise.all([
			fetch("/bookings", { headers: { Authorization: "Bearer " + localStorage.getItem("token") } }),
			fetch("/rooms").then((r) => (r.ok ? r.json() : [])),
		]);
		if (res.status === 401) {
			localStorage.clear();
			location.href = `/pages/Login.html?redirect=${encodeURIComponent(location.pathname)}`;
			return;
		}
		if (!res.ok) throw new Error("Could not load your bookings");
		bookings = await res.json();
		roomsById = Object.fromEntries(rooms.map((r) => [r.id, r]));
		render();
	} catch (err) {
		console.error(err);
		$("next-stay").removeAttribute("aria-busy");
		$("next-stay").innerHTML = `
			<div class="empty-state">
				<h3 class="font-serif">We couldn't load your stays.</h3>
				<p>Check your connection and try again.</p>
				<button type="button" class="btn-secondary" onclick="load()">Try again</button>
			</div>`;
		$("past-grid").innerHTML = "";
	}
}

//  Grouping
function isUpcoming(b) {
	return b.status === "staying" || (b.status === "booked" && b.checkOut > dates.today());
}

function render() {
	const upcoming = bookings.filter(isUpcoming).sort((a, b) => a.checkIn.localeCompare(b.checkIn));
	const past = bookings
		.filter((b) => !isUpcoming(b) && b.status !== "cancelled")
		.sort((a, b) => b.checkOut.localeCompare(a.checkOut));
	const cancelled = bookings.filter((b) => b.status === "cancelled").sort((a, b) => b.checkIn.localeCompare(a.checkIn));

	// The stay happening now (or the soonest one) gets the big card
	const next = upcoming.find((b) => b.status === "staying") || upcoming[0];
	$("next-stay").removeAttribute("aria-busy");
	$("next-stay").innerHTML = next ? nextStayHtml(next) : noUpcomingHtml(past.length > 0);

	const others = upcoming.filter((b) => b !== next);
	$("upcoming-section").hidden = others.length === 0;
	$("upcoming-grid").innerHTML = others.map(cardHtml).join("");

	$("past-grid").innerHTML = past.length
		? past.map(cardHtml).join("")
		: `<p class="font-serif italic md:col-span-2" style="font-size:20px; color:var(--lux-text-muted)">Your past stays will appear here.</p>`;

	$("cancelled-section").hidden = cancelled.length === 0;
	$("cancelled-count").textContent = cancelled.length;
	$("cancelled-grid").innerHTML = cancelled.map(cardHtml).join("");
}

//  Status and wording
function status(b) {
	const today = dates.today();
	if (b.status === "staying") return { label: "Staying now", cls: "staying" };
	if (b.status === "completed") return { label: "Completed", cls: "done" };
	if (b.status === "cancelled") return { label: "Cancelled", cls: "cancelled" };
	if (b.checkOut <= today) return { label: "Missed", cls: "cancelled" }; // never checked in
	if (b.checkIn === today) return { label: "Arriving today", cls: "today" };
	return { label: "Confirmed", cls: "booked" };
}

function countdown(b) {
	const today = dates.today();
	if (b.status === "staying") {
		const left = dates.nights(today, b.checkOut);
		return left <= 0 ? "<strong>Checking out</strong> today by 11am" : `<strong>${left}</strong> ${left === 1 ? "night" : "nights"} left`;
	}
	const days = dates.nights(today, b.checkIn);
	if (days === 0) return "<strong>Today</strong> check in from 3pm";
	if (days === 1) return "<strong>Tomorrow</strong> check in from 3pm";
	return `<strong>${days}</strong> days to go`;
}

const isAdvance = (b) => b.ratePlan === "advance";
// Advance purchase is non-refundable: only reception can change or cancel it
const canCancel = (b) => b.status === "booked" && b.checkIn > dates.today() && !isAdvance(b);
const canReview = (b) => b.status === "completed" && !b.reviewed;

function photo(b) {
	const img = roomsById[b.roomId]?.image;
	return img ? img.replace("../frontend/", "/") : "";
}

function actionsHtml(b) {
	const actions = [];
	if (isUpcoming(b)) {
		actions.push(`<button type="button" class="text-action" onclick="addToCalendar('${b.id}')">${UI.icon("calendar")} Add to calendar</button>`);
	}
	if (canReview(b)) actions.push(`<button type="button" class="text-action" onclick="openReview('${b.id}')">${UI.icon("star")} Review your stay</button>`);
	if (b.reviewed) actions.push(`<span class="text-action" style="cursor:default; color:var(--lux-success)">${UI.icon("check")} Reviewed - thank you</span>`);
	if (!isUpcoming(b)) actions.push(`<a class="text-action" href="./room.html?room=${encodeURIComponent(b.roomId)}">${UI.icon("arrow")} Book again</a>`);
	if (canCancel(b)) actions.push(`<button type="button" class="text-action" onclick="changeDates('${b.id}')">${UI.icon("calendar")} Change dates</button>`);
	if (canCancel(b)) actions.push(`<button type="button" class="text-action danger" onclick="cancelBooking('${b.id}')">${UI.icon("close")} Cancel</button>`);
	if (isAdvance(b) && b.status === "booked") actions.push(`<a class="text-action" href="tel:+6491234567">${UI.icon("phone")} Need to change? Call reception</a>`);
	return actions.join("");
}

//  Cards
function nextStayHtml(b) {
	const s = status(b);
	const img = photo(b);
	return `
		<article class="stay-hero">
			<div class="stay-hero-photo">
				${img ? `<img src="${UI.escape(img)}" alt="" />` : ""}
				<p class="countdown">${countdown(b)}</p>
			</div>
			<div class="p-6 md:p-8 flex flex-col">
				<div class="flex items-start justify-between gap-3 mb-1">
					<p class="kicker" style="font-size:11px">${b.status === "staying" ? "Your current stay" : "Your next stay"}</p>
					<span class="flex gap-2 flex-wrap justify-end">${isAdvance(b) ? '<span class="status-badge nonref">Non-refundable</span>' : ""}<span class="status-badge ${s.cls}">${s.label}</span></span>
				</div>
				<h2 class="font-serif mb-1" style="font-size:44px; color:var(--lux-brown-800); line-height:1.05">Room ${UI.escape(b.roomId)}</h2>
				<p class="mb-5" style="color:var(--lux-text-muted)">Floor ${b.floor} · ${FLOOR_NAMES[b.floor] || ""} · ${UI.escape(b.roomType)}</p>
				<div class="booking-row"><span>Arrive</span><span>${dates.pretty(b.checkIn, true)} · from 3pm</span></div>
				<div class="booking-row"><span>Depart</span><span>${dates.pretty(b.checkOut, true)} · by 11am</span></div>
				<div class="booking-row"><span>Reference</span><span>${UI.escape(b.id)}</span></div>
				${partyText(b) ? `<div class="booking-row"><span>Guests</span><span>${partyText(b)}</span></div>` : ""}
				<div class="booking-row"><span>Room total</span><span>${UI.money(b.total)} · ${b.nights} ${b.nights === 1 ? "night" : "nights"}${promoText(b)}</span></div>
				<p class="text-sm mt-4 flex items-center gap-2" style="color:var(--lux-text-muted)">${UI.icon("pin")} 42 Harbour Avenue, Auckland · reception open 24 hours · +64 9 123 4567</p>
				<div class="card-actions">${actionsHtml(b)}</div>
			</div>
		</article>`;
}

function noUpcomingHtml(hasPast) {
	return `
		<div class="empty-state" style="text-align:left; padding:40px">
			<p class="kicker mb-2">Nothing booked yet</p>
			<h3 class="font-serif" style="font-size:32px">${hasPast ? "Ready for your next stay?" : "Your first stay starts here."}</h3>
			<p>Pick your dates and we'll show you every room that's free.</p>
			<a href="./browserooms.html" class="btn-primary">Find a room</a>
		</div>`;
}

function cardHtml(b) {
	const s = status(b);
	return `
		<article class="booking-card">
			<div class="booking-card-body">
				<div class="flex items-start justify-between gap-3 mb-1">
					<p class="kicker" style="font-size:11px">Floor ${b.floor} · ${FLOOR_NAMES[b.floor] || ""}</p>
					<span class="flex gap-2 flex-wrap justify-end">${isAdvance(b) ? '<span class="status-badge nonref">Non-refundable</span>' : ""}<span class="status-badge ${s.cls}">${s.label}</span></span>
				</div>
				<h3 class="font-serif mb-4" style="font-size:32px; color:var(--lux-brown-800); line-height:1.1">Room ${UI.escape(b.roomId)}</h3>
				<div class="booking-row"><span>Dates</span><span>${dates.pretty(b.checkIn)} – ${dates.pretty(b.checkOut, true)}</span></div>
				<div class="booking-row"><span>Room total</span><span>${UI.money(b.total)}${promoText(b)}</span></div>
				<div class="booking-row"><span>Reference</span><span style="font-size:12px">${UI.escape(b.id)}</span></div>
				<div class="card-actions">${actionsHtml(b)}</div>
			</div>
		</article>`;
}

//  Actions
function addToCalendar(id) {
	const b = bookings.find((x) => x.id === id);
	if (b) UI.downloadStay(b);
}

// "2 adults, 1 child" (older bookings only have a guest count, or nothing)
function partyText(b) {
	if (b.adults) return UI.party.label({ adults: b.adults, children: b.children || 0 });
	return b.guests ? `${b.guests} ${b.guests === 1 ? "guest" : "guests"}` : "";
}

function promoText(b) {
	return b.promoCode ? ` <span class="promo-tag">${UI.escape(b.promoCode)} −${UI.money(b.discount)}</span>` : "";
}

// Move an upcoming stay to new dates. The price is worked out again at the
// room's current rate (keeping any promo); the difference is settled at reception.
async function changeDates(id) {
	const b = bookings.find((x) => x.id === id);
	if (!b) return;
	const room = roomsById[b.roomId];
	const tomorrow = dates.addDays(dates.today(), 1);
	const result = await UI.dialog({
		title: `Change your dates for Room ${b.roomId}`,
		body: `
			<p class="text-sm mb-4" style="color:var(--lux-text-muted)">Now: ${dates.pretty(b.checkIn, true)} – ${dates.pretty(b.checkOut, true)} · ${UI.money(b.total)}</p>
			<div class="grid grid-cols-2 gap-4 mb-3">
				<label class="meta-label">New check in<input type="date" id="cd-in" min="${tomorrow}" value="${b.checkIn}" style="display:block;width:100%;margin-top:6px;border:1px solid var(--lux-brown-200);padding:9px 10px;font-size:15px;background:#fff" /></label>
				<label class="meta-label">New check out<input type="date" id="cd-out" min="${dates.addDays(tomorrow, 1)}" value="${b.checkOut}" style="display:block;width:100%;margin-top:6px;border:1px solid var(--lux-brown-200);padding:9px 10px;font-size:15px;background:#fff" /></label>
			</div>
			<p id="cd-preview" class="text-sm" style="color:var(--lux-brown-600)" aria-live="polite"></p>
			<p class="text-xs mt-3" style="color:var(--lux-text-muted)">Any price difference is paid or refunded at reception. <a href="/pages/terms.html#changes" target="_blank" rel="noopener" style="text-decoration:underline">Terms</a></p>`,
		confirmLabel: "Change dates",
		cancelLabel: "Keep my dates",
		onConfirm: async (card) => {
			const checkIn = card.querySelector("#cd-in").value;
			const checkOut = card.querySelector("#cd-out").value;
			const res = await fetch(`/bookings/${encodeURIComponent(id)}/dates`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("token") },
				body: JSON.stringify({ checkIn, checkOut }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "We couldn't change your dates.");
			return data;
		},
		onOpen: (card) => {
			const inEl = card.querySelector("#cd-in");
			const outEl = card.querySelector("#cd-out");
			const preview = () => {
				const nights = inEl.value && outEl.value ? dates.nights(inEl.value, outEl.value) : 0;
				const el = card.querySelector("#cd-preview");
				if (nights < 1 || !room) return (el.textContent = nights < 1 && inEl.value && outEl.value ? "Check-out needs to be after check-in." : "");
				const full = nights * room.price;
				const total = full - (b.promoPercent ? Math.round((full * b.promoPercent) / 100) : 0);
				const diff = total - b.total;
				el.innerHTML = `New stay: ${nights} ${nights === 1 ? "night" : "nights"} · <strong>${UI.money(total)}</strong> - ${
					diff > 0 ? `${UI.money(diff)} more, payable at check-in` : diff < 0 ? `${UI.money(-diff)} refunded at check-in` : "same price"
				}`;
			};
			inEl.addEventListener("change", () => {
				if (inEl.value && (!outEl.value || outEl.value <= inEl.value)) outEl.value = dates.addDays(inEl.value, 1);
				outEl.min = dates.addDays(inEl.value || tomorrow, 1);
				preview();
			});
			outEl.addEventListener("change", preview);
			preview();
		},
	});
	if (!result) return;
	Object.assign(b, result.booking);
	render();
	const d = result.difference;
	UI.toast(`Dates changed${d > 0 ? ` · ${UI.money(d)} more, payable at check-in` : d < 0 ? ` · ${UI.money(-d)} refunded at check-in` : ""}`);
}

async function cancelBooking(id) {
	const b = bookings.find((x) => x.id === id);
	if (!b) return;
	const result = await UI.dialog({
		title: "Cancel this booking?",
		body: `<p style="color:var(--lux-brown-600); line-height:1.7">
			Room ${UI.escape(b.roomId)}, ${dates.pretty(b.checkIn, true)} to ${dates.pretty(b.checkOut, true)}.
			The room will be released for other guests. This can't be undone.</p>`,
		confirmLabel: "Cancel booking",
		cancelLabel: "Keep it",
		danger: true,
		onConfirm: async () => {
			const res = await fetch(`/bookings/${encodeURIComponent(id)}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("token") },
				body: JSON.stringify({ status: "cancelled" }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "We couldn't cancel this booking.");
			return data;
		},
	});
	if (!result) return;
	Object.assign(b, result);
	render();
	UI.toast("Booking cancelled");
}

async function openReview(id) {
	const b = bookings.find((x) => x.id === id);
	if (!b) return;
	const starInputs = [1, 2, 3, 4, 5]
		.map((n) => `<input type="radio" name="rating" id="star-${n}" value="${n}" /><label for="star-${n}" data-star="${n}" aria-label="${n} ${n === 1 ? "star" : "stars"}">★</label>`)
		.join("");
	const result = await UI.dialog({
		title: `How was Room ${b.roomId}?`,
		body: `
			<p class="text-sm mb-4" style="color:var(--lux-text-muted)">${dates.pretty(b.checkIn, true)} – ${dates.pretty(b.checkOut, true)}</p>
			<fieldset class="mb-4"><legend class="meta-label mb-2">Your rating</legend><div class="star-picker">${starInputs}</div></fieldset>
			<label class="meta-label block mb-2" for="review-title">Headline <span style="text-transform:none; letter-spacing:0">(optional)</span></label>
			<input type="text" id="review-title" maxlength="80" class="mb-4" placeholder="e.g. A quiet weekend away" />
			<label class="meta-label block mb-2" for="review-comment">Your review</label>
			<textarea id="review-comment" maxlength="1000" placeholder="What stood out? What could be better?"></textarea>`,
		confirmLabel: "Post review",
		onConfirm: async (card) => {
			const rating = Number(card.querySelector("input[name=rating]:checked")?.value);
			const comment = card.querySelector("#review-comment").value.trim();
			if (!rating) throw new Error("Choose a star rating.");
			if (!comment) throw new Error("Write a few words about your stay.");
			const res = await fetch("/reviews", {
				method: "POST",
				headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("token") },
				body: JSON.stringify({ bookingId: b.id, rating, title: card.querySelector("#review-title").value, comment }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "We couldn't post your review.");
			return data;
		},
	});
	if (!result) return;
	b.reviewed = true;
	render();
	UI.toast("Thank you - your review is live");
}

// Light up the stars up to the one hovered or chosen
document.addEventListener("mouseover", (e) => {
	const star = e.target.closest(".star-picker label");
	if (star) lightStars(star.closest(".star-picker"), Number(star.dataset.star));
});
document.addEventListener("mouseout", (e) => {
	const picker = e.target.closest(".star-picker");
	if (picker) lightStars(picker, Number(picker.querySelector("input:checked")?.value || 0));
});
document.addEventListener("change", (e) => {
	if (e.target.name === "rating") lightStars(e.target.closest(".star-picker"), Number(e.target.value));
});
function lightStars(picker, upTo) {
	picker.querySelectorAll("label").forEach((l) => l.classList.toggle("lit", Number(l.dataset.star) <= upTo));
}
