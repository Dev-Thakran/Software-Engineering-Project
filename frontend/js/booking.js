// ============================================================
//  booking.js - Booking form logic
//  Step 1 dates and guests, step 2 mock payment, step 3 a
//  confirmation with the booking reference and "add to calendar"
// ============================================================

const FLOOR_NAMES = { 1: "Garden", 2: "Classic", 3: "Executive", 4: "Penthouse" };
const TAX = 30; // Fixed tax amount
const HOTEL = {
	address: "La Extravaganza, 42 Harbour Avenue, Auckland Central 1010, New Zealand",
	phone: "+64 9 123 4567",
	checkInTime: "15:00",
	checkOutTime: "11:00",
};

let room = null; // Loaded room object from the server
let nights = 0;
let total = 0; // Total amount including tax
let promo = null; // { code, percent, label } once a promo code is applied

const $ = (id) => document.getElementById(id);
const party = () => ({ adults: Number($("adultsinput").value) || 1, children: Number($("childreninput").value) || 0 });
// Same rounding as the server: the promo comes off the room price, never the $30 fee
const ADVANCE_PERCENT = 10; // matches backend/config/rate-plans.js
const ratePlan = () => document.querySelector('input[name="rate"]:checked')?.value || "flexible";
// Same order and rounding as the server: the rate discount comes off first,
// then any promo off what's left; the $30 fee is never discounted
function priceFor(subtotal, plan = ratePlan()) {
	const rateDiscount = plan === "advance" ? Math.round((subtotal * ADVANCE_PERCENT) / 100) : 0;
	const afterRate = subtotal - rateDiscount;
	const discount = promo ? Math.round((afterRate * promo.percent) / 100) : 0;
	return { rateDiscount, discount, room: afterRate - discount };
}

document.addEventListener("DOMContentLoaded", async function () {
	// Booking needs an account - come back here after signing in
	const token = localStorage.getItem("token");
	if (!token) {
		location.href = `/pages/Login.html?redirect=${encodeURIComponent(location.pathname + location.search)}`;
		return;
	}

	// Only customers can book - staff and managers go to their dashboards
	const role = localStorage.getItem("role");
	if (role === "staff" || role === "manager") {
		location.href = `/pages/${role}.html`;
		return;
	}

	const params = new URLSearchParams(location.search);
	const roomId = params.get("room") || params.get("roomId");
	if (!roomId) {
		location.href = "/pages/browserooms.html";
		return;
	}

	try {
		const res = await fetch(`/rooms/${encodeURIComponent(roomId)}`);
		if (!res.ok) throw new Error("Room not found");
		room = await res.json();
	} catch {
		location.href = "/pages/browserooms.html";
		return;
	}

	populateSummary();

	// Dates and guests passed from the room page
	const today = UI.dates.today();
	$("checkin").min = today;
	$("checkout").min = UI.dates.addDays(today, 1);
	if (UI.dates.valid(params.get("checkIn")) && params.get("checkIn") >= today) $("checkin").value = params.get("checkIn");
	if (UI.dates.valid(params.get("checkOut"))) $("checkout").value = params.get("checkOut");
	setParty(UI.party.fromParams(params, { adults: Math.min(2, room.maxGuests), children: 0 }));
	calculateNights();

	$("checkin").addEventListener("change", onCheckinChange);
	$("checkout").addEventListener("change", calculateNights);
	$("adultsinput").addEventListener("change", () => setParty(party()));
	$("childreninput").addEventListener("change", updateSummaryPricing);

	// Promo code: apply/remove, and pick up one carried from the search
	$("promo-apply").addEventListener("click", () => (promo ? removePromo() : applyPromo($("promoinput").value)));
	$("promoinput").addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			applyPromo($("promoinput").value);
		}
	});
	if (/^[A-Za-z0-9]{1,20}$/.test(params.get("promo") || "")) {
		$("promoinput").value = params.get("promo").toUpperCase();
		applyPromo(params.get("promo"));
	}

	// Rate plan: carried in the URL as ?rate=advance
	if (params.get("rate") === "advance") document.querySelector('input[name="rate"][value="advance"]').checked = true;
	document.querySelectorAll('input[name="rate"]').forEach((r) => r.addEventListener("change", updateSummaryPricing));
	updateSummaryPricing();
	$("step-dates").addEventListener("submit", (e) => {
		e.preventDefault();
		goToStep(2);
	});
	$("back-to-dates").addEventListener("click", () => goToStep(1));
	$("step-payment").addEventListener("submit", (e) => {
		e.preventDefault();
		submitPayment();
	});

	// Live card preview and formatting
	$("cardname").addEventListener("input", updateCardDisplay);
	$("cardno").addEventListener("input", onCardNumberInput);
	$("cardexp").addEventListener("input", onCardExpInput);
	$("cardcvv").addEventListener("input", (e) => (e.target.value = e.target.value.replace(/\D/g, "")));
	// Check each card field when the guest leaves it
	["cardname", "cardno", "cardexp", "cardcvv"].forEach((id) => {
		$(id).addEventListener("blur", () => {
			if ($(id).value) validateField(id);
		});
	});
});

//  Summary panel
function populateSummary() {
	const img = $("summary-img");
	img.src = room.image ? room.image.trim().replace("../frontend/", "/") : "";
	img.hidden = !room.image;
	img.alt = `Room ${room.id}`;
	$("summary-tier").textContent = `Floor ${room.floor} · ${FLOOR_NAMES[room.floor] || ""}`;
	$("summary-room-name").textContent = `Room ${room.id}`;

	$("max-guests-label").textContent = room.maxGuests;
	updateSummaryPricing();
}

// Adults 1..capacity; children only up to the space left (everyone counts)
function setParty(p) {
	const max = room.maxGuests;
	const adults = Math.min(Math.max(p.adults, 1), max);
	$("adultsinput").innerHTML = Array.from({ length: max }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
	$("adultsinput").value = String(adults);
	const space = max - adults;
	$("childreninput").innerHTML = Array.from({ length: space + 1 }, (_, i) => `<option value="${i}">${i}</option>`).join("");
	$("childreninput").value = String(Math.min(p.children, space));
	$("childreninput").disabled = space === 0;
	updateSummaryPricing();
}

async function applyPromo(code) {
	const msg = $("promo-msg");
	const clean = String(code || "").trim();
	if (!clean) {
		msg.textContent = "Enter a promo code first.";
		return;
	}
	try {
		const res = await fetch(`/promos/${encodeURIComponent(clean)}`);
		const data = await res.json();
		if (!res.ok) throw new Error(data.error || "That code isn't valid or has expired");
		promo = data;
		$("promoinput").value = data.code;
		$("promoinput").readOnly = true;
		$("promo-apply").textContent = "Remove";
		msg.style.color = "var(--lux-success)";
		msg.textContent = `${data.code} applied - ${data.percent}% off the room price${data.label ? ` (${data.label})` : ""}.`;
	} catch (err) {
		promo = null;
		msg.style.color = "var(--lux-danger)";
		msg.textContent = err.message === "Failed to fetch" ? "We couldn't check that code. Please try again." : err.message;
	}
	updateSummaryPricing();
}

function removePromo() {
	promo = null;
	$("promoinput").readOnly = false;
	$("promoinput").value = "";
	$("promo-apply").textContent = "Apply";
	$("promo-msg").textContent = "";
	updateSummaryPricing();
}

function updateSummaryPricing() {
	const checkin = $("checkin").value;
	const checkout = $("checkout").value;
	$("s-checkin").textContent = checkin ? UI.dates.pretty(checkin, true) : "-";
	$("s-checkout").textContent = checkout ? UI.dates.pretty(checkout, true) : "-";
	$("s-guests").textContent = UI.party.label(party());
	$("s-policy").textContent =
		ratePlan() === "advance" ? "Non-refundable - changes only through reception" : "Free cancellation until 23:59 the day before arrival";

	if (nights > 0) {
		const subtotal = room.price * nights;
		const { rateDiscount, discount, room: roomTotal } = priceFor(subtotal);
		total = roomTotal + TAX;
		// Prices on the two rate cards (room only, before any promo)
		$("rate-flexible-price").textContent = UI.money(subtotal);
		$("rate-advance-price").textContent = UI.money(subtotal - priceFor(subtotal, "advance").rateDiscount);
		$("rate-advance-save").textContent = `Save ${UI.money(priceFor(subtotal, "advance").rateDiscount)}`;
		$("rate-advance-save").hidden = false;
		$("s-rate-row").hidden = !rateDiscount;
		$("s-rate").textContent = `−${UI.money(rateDiscount)}`;
		$("s-nights").textContent = nights;
		$("s-price-line").textContent = `${UI.money(room.price)} × ${nights} ${nights === 1 ? "night" : "nights"}`;
		$("s-subtotal").textContent = UI.money(subtotal);
		$("s-promo-row").hidden = !discount;
		$("s-promo-label").textContent = promo ? `Promo ${promo.code}` : "Promo";
		$("s-promo").textContent = `−${UI.money(discount)}`;
		$("s-total").textContent = UI.money(total);
		$("pay-btn-total").textContent = UI.money(total);
	} else {
		total = 0;
		$("s-nights").textContent = "-";
		$("s-price-line").textContent = `${UI.money(room.price)} a night`;
		$("s-subtotal").textContent = "-";
		$("s-promo-row").hidden = true;
		$("s-rate-row").hidden = true;
		$("rate-flexible-price").textContent = "";
		$("rate-advance-price").textContent = "";
		$("rate-advance-save").hidden = true;
		$("s-total").textContent = "-";
		$("pay-btn-total").textContent = "";
	}
}

function onCheckinChange() {
	const checkin = $("checkin").value;
	if (checkin) {
		const earliest = UI.dates.addDays(checkin, 1);
		$("checkout").min = earliest;
		if (!$("checkout").value || $("checkout").value < earliest) $("checkout").value = earliest;
	}
	calculateNights();
}

function calculateNights() {
	const checkin = $("checkin").value;
	const checkout = $("checkout").value;
	nights = checkin && checkout && checkout > checkin ? UI.dates.nights(checkin, checkout) : 0;
	setDatesError("");
	updateSummaryPricing();
}

function setDatesError(message) {
	$("dates-error").textContent = message;
	$("checkin").setAttribute("aria-invalid", String(Boolean(message)));
	$("checkout").setAttribute("aria-invalid", String(Boolean(message)));
}

//  Steps
async function goToStep(step) {
	if (step === 2) {
		const checkin = $("checkin").value;
		const checkout = $("checkout").value;
		if (!checkin || !checkout) return setDatesError("Choose both a check-in and a check-out date.");
		if (checkin < UI.dates.today()) return setDatesError("Check-in can't be in the past.");
		if (nights < 1) return setDatesError("Check-out needs to be at least one night after check-in.");

		// Make sure nobody else has the room for these dates
		const btn = $("continuepaybtn");
		btn.disabled = true;
		btn.textContent = "Checking availability…";
		try {
			const res = await fetch(`/rooms/${room.id}/availability?checkIn=${checkin}&checkOut=${checkout}`);
			const data = await res.json();
			if (!res.ok || !data.available) {
				return setDatesError(res.ok ? "Sorry - this room is already booked for some of those nights. Try other dates." : data.error);
			}
		} catch {
			return setDatesError("We couldn't check availability. Check your connection and try again.");
		} finally {
			btn.disabled = false;
			btn.textContent = "Continue to payment";
		}
	}

	$("step-dates").hidden = step !== 1;
	$("step-payment").hidden = step !== 2;
	$("step-label-1").classList.toggle("done", step > 1);
	[1, 2].forEach((n) => {
		if (n === step) $(`step-label-${n}`).setAttribute("aria-current", "step");
		else $(`step-label-${n}`).removeAttribute("aria-current");
	});
	(step === 2 ? $("cardname") : $("checkin")).focus();
}

//  Card fields
function updateCardDisplay() {
	$("card-display-name").textContent = $("cardname").value.toUpperCase() || "NAME ON CARD";
}

function onCardNumberInput() {
	const digits = $("cardno").value.replace(/\D/g, "").slice(0, 16);
	$("cardno").value = digits.replace(/(.{4})/g, "$1 ").trim();
	$("card-display-number").textContent = digits
		? "•••• •••• •••• " + digits.slice(-4).padStart(4, "•")
		: "•••• •••• •••• ••••";
}

function onCardExpInput(e) {
	let val = $("cardexp").value.replace(/\D/g, "").slice(0, 4);
	// "4" becomes "04" so the month is clear as soon as it's typed
	if (val.length === 1 && Number(val) > 1) val = "0" + val;
	if (val.length >= 3) val = val.slice(0, 2) + "/" + val.slice(2);
	// Let backspace remove the slash
	if (e?.inputType === "deleteContentBackward" && val.length === 3) val = val.slice(0, 2);
	$("cardexp").value = val;
	$("card-display-exp").textContent = val || "MM/YY";
}

function expiryProblem(value) {
	if (!/^\d{2}\/\d{2}$/.test(value)) return "Enter the expiry as MM/YY.";
	const [month, year] = value.split("/").map(Number);
	if (month < 1 || month > 12) return "The month should be between 01 and 12.";
	const now = new Date();
	const thisYear = now.getFullYear() % 100;
	if (year < thisYear || (year === thisYear && month < now.getMonth() + 1)) return "This card has expired.";
	return "";
}

const CARD_RULES = {
	cardname: (v) => (v.trim().length >= 2 ? "" : "Enter the name as it appears on the card."),
	cardno: (v) => (/^\d{16}$/.test(v.replace(/\s/g, "")) ? "" : "The card number should be 16 digits."),
	cardexp: (v) => expiryProblem(v.trim()),
	cardcvv: (v) => (/^\d{3,4}$/.test(v.trim()) ? "" : "The security code is the 3 or 4 digits on the back."),
};

function validateField(id) {
	const problem = CARD_RULES[id]($(id).value);
	$(`${id}-error`).textContent = problem;
	$(id).setAttribute("aria-invalid", String(Boolean(problem)));
	return !problem;
}

//  Payment and booking
async function submitPayment() {
	const token = localStorage.getItem("token");
	const payBtn = $("pay-btn");
	$("pay-error").hidden = true;

	const fields = Object.keys(CARD_RULES);
	const results = fields.map(validateField);
	const firstBad = fields[results.indexOf(false)];
	if (firstBad) {
		$(firstBad).focus();
		return;
	}
	if (nights < 1 || total < 1) return showPayError("Go back and choose your dates first.");

	payBtn.disabled = true;
	payBtn.textContent = "Processing…";
	const resetButton = () => {
		payBtn.disabled = false;
		payBtn.innerHTML = `Pay <span id="pay-btn-total">${UI.money(total)}</span>`;
	};

	try {
		const payRes = await fetch("/payment/process", {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
			body: JSON.stringify({
				cardNumber: $("cardno").value.replace(/\s/g, ""),
				expiry: $("cardexp").value.trim(),
				cvv: $("cardcvv").value.trim(),
				amount: total,
			}),
		});
		const payData = await payRes.json();
		if (!payRes.ok) {
			resetButton();
			return showPayError(payData.error || "The payment didn't go through. Check the card details.");
		}

		const { adults, children } = party();
		const bookRes = await fetch("/bookings", {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
			body: JSON.stringify({
				roomId: room.id,
				checkIn: $("checkin").value,
				checkOut: $("checkout").value,
				adults,
				children,
				ratePlan: ratePlan(),
				...(promo ? { promoCode: promo.code } : {}),
			}),
		});
		const booking = await bookRes.json();
		if (bookRes.status === 401) {
			localStorage.clear();
			location.href = `/pages/Login.html?redirect=${encodeURIComponent(location.pathname + location.search)}`;
			return;
		}
		if (!bookRes.ok) {
			resetButton();
			return showPayError(booking.error || "We couldn't complete the booking. Please try again.");
		}

		showConfirmation(booking);
	} catch {
		resetButton();
		showPayError("Connection problem - nothing was booked. Please try again.");
	}
}

function showPayError(msg) {
	$("pay-error").textContent = msg;
	$("pay-error").hidden = false;
}

//  Confirmation
function showConfirmation(booking) {
	const paid = booking.total + TAX;
	const guests = UI.party.label({ adults: booking.adults || 1, children: booking.children || 0 });
	const promoNote = booking.promoCode ? ` (${UI.escape(booking.promoCode)} saved ${UI.money(booking.discount)})` : "";
	const planNote = booking.ratePlan === "advance"
		? `Advance purchase - non-refundable (saved ${UI.money(booking.rateDiscount)})`
		: "Flexible - free cancellation until 23:59 the day before";
	const section = $("confirmation");
	section.innerHTML = `
		<div class="confirm-badge">${UI.icon("check")}</div>
		<p class="kicker mb-2">Booking confirmed</p>
		<h1 id="confirm-title" class="font-serif mb-3" style="font-size:clamp(32px,5vw,44px); color:var(--lux-brown-800); line-height:1.1">
			You're staying with us, ${UI.escape((localStorage.getItem("name") || "").split(" ")[0] || "friend")}.
		</h1>
		<p class="mb-8" style="color:var(--lux-text-muted)">
			Your reference is <strong style="color:var(--lux-brown-800)">${UI.escape(booking.id)}</strong>. It's saved in My Stays.
		</p>

		<div class="confirm-grid py-6 mb-8" style="border-top:1px solid var(--lux-brown-100); border-bottom:1px solid var(--lux-brown-100)">
			<div><p class="meta-label mb-1">Room</p><p class="meta-value" style="font-size:15px">Room ${UI.escape(booking.roomId)} · ${UI.escape(booking.roomType)}</p></div>
			<div><p class="meta-label mb-1">Guests</p><p class="meta-value" style="font-size:15px">${guests}</p></div>
			<div><p class="meta-label mb-1">Arrive</p><p class="meta-value" style="font-size:15px">${UI.dates.pretty(booking.checkIn, true)} · from 3pm</p></div>
			<div><p class="meta-label mb-1">Depart</p><p class="meta-value" style="font-size:15px">${UI.dates.pretty(booking.checkOut, true)} · by 11am</p></div>
			<div><p class="meta-label mb-1">Paid</p><p class="meta-value" style="font-size:15px">${UI.money(paid)} for ${booking.nights} ${booking.nights === 1 ? "night" : "nights"}, incl. $30 taxes${promoNote}</p></div>
			<div><p class="meta-label mb-1">Rate</p><p class="meta-value" style="font-size:15px">${planNote}</p></div>
			<div><p class="meta-label mb-1">Find us</p><p class="meta-value" style="font-size:15px">42 Harbour Avenue · ${HOTEL.phone}</p></div>
		</div>

		<div class="flex flex-col sm:flex-row gap-3">
			<a href="/pages/mybooking.html" class="btn-primary text-center">View my stays</a>
			<button type="button" class="btn-secondary inline-flex items-center justify-center gap-2" id="add-calendar">${UI.icon("calendar")} Add to calendar</button>
			<a href="/pages/browserooms.html" class="btn-ghost self-center py-3">Keep browsing</a>
		</div>`;

	$("booking-flow").hidden = true;
	section.hidden = false;
	section.focus();
	window.scrollTo({ top: 0, behavior: "smooth" });
	$("add-calendar").addEventListener("click", () => UI.downloadStay(booking));
	UI.toast("Booking confirmed");
}
