// ============================================================
//  booking.js - Booking form logic
//  Handles: room data loading, date/guest inputs, step switching,
//           card display, payment submission, booking creation
// ============================================================

//  Room metadata (matches browserooms.js)
const FLOOR_NAMES = {
	1: "Garden",
	2: "Classic",
	3: "Executive",
	4: "Penthouse",
};
const ROOM_META = {
	"Standard Single": { guests: 1 },
	"Deluxe Double": { guests: 2 },
	"Executive Double": { guests: 2 },
	"Penthouse Suite": { guests: 4 },
};
const TAX = 30; // Fixed tax amount

let room = null; // Loaded room object from backend
let nights = 0; // Calculated nights
let total = 0; // Total amount including tax

//  On page load -
document.addEventListener("DOMContentLoaded", async function () {
	// Redirect to login if not logged in - booking requires auth
	const token = localStorage.getItem("token");
	if (!token) {
		window.location.href = `/pages/Login.html?redirect=${encodeURIComponent(window.location.href)}`;
		return;
	}

	// Only customers can book - redirect staff/manager to their dashboards
	const role = localStorage.getItem("role");
	if (role === "staff") {
		window.location.href = "/pages/staff.html";
		return;
	}
	if (role === "manager") {
		window.location.href = "/pages/manager.html";
		return;
	}

	// Get room ID from URL - supports ?room=101 or ?roomId=101
	const params = new URLSearchParams(window.location.search);
	const roomId = params.get("room") || params.get("roomId");

	if (!roomId) {
		window.location.href = "/pages/browserooms.html";
		return;
	}

	// Fetch room data from backend
	try {
		const res = await fetch(`/rooms/${roomId}`);
		if (!res.ok) throw new Error("Room not found");
		room = await res.json();
	} catch (err) {
		window.location.href = "/pages/browserooms.html";
		return;
	}

	// Block if room is not available
	if (room.status !== "available") {
		alert(`Room ${room.id} is currently ${room.status}. Redirecting to rooms.`);
		window.location.href = "/pages/browserooms.html";
		return;
	}

	// Populate summary panel with room data
	populateSummary();

	// Pre-fill dates if passed from the browse/floor map page
	const checkIn = params.get("checkIn");
	const checkOut = params.get("checkOut");
	if (checkIn) {
		document.getElementById("checkin").value = checkIn;
	}
	if (checkOut) {
		document.getElementById("checkout").value = checkOut;
	}
	if (checkIn && checkOut) calculateNights();

	// Set minimum date on check-in to today
	const today = new Date().toLocaleDateString("en-CA");
	document.getElementById("checkin").setAttribute("min", today);

	// Wire up date and guest input events
	document
		.getElementById("checkin")
		.addEventListener("change", onCheckinChange);
	document
		.getElementById("checkout")
		.addEventListener("change", onCheckoutChange);
	document
		.getElementById("guestinput")
		.addEventListener("input", onGuestChange);

	// Wire up card field live preview events
	document
		.getElementById("cardname")
		.addEventListener("input", updateCardDisplay);
	document
		.getElementById("cardno")
		.addEventListener("input", onCardNumberInput);
	document.getElementById("cardexp").addEventListener("input", onCardExpInput);
});

//  Summary panel population -
function populateSummary() {
	if (!room) return;

	const imgPath = room.image
		? room.image.trim().replace("../frontend/", "/")
		: "";

	const img = document.getElementById("summary-img");
	img.src = imgPath;
	img.alt = `Room ${room.id}`;
	img.style.display = "block";

	// Hide the placeholder - it sits right after the img element
	const placeholder = img.nextElementSibling;
	if (placeholder) placeholder.style.display = "none";
	// Tier and room name - shown twice as per the design
	const tier = `Floor ${room.floor} - ${FLOOR_NAMES[room.floor] || "Floor " + room.floor}`;
	const name = `Room ${room.id}`;
	document.getElementById("summary-tier").textContent = tier;
	document.getElementById("summary-room-name-2").textContent = name;
	document.getElementById("summary-tier-2").textContent = tier;
	document.getElementById("summary-room-name").textContent = name;

	// Max guests from room type metadata
	const meta = ROOM_META[room.type] || { guests: 2 };
	document.getElementById("max-guests-label").textContent = meta.guests;
	document.getElementById("guestinput").max = meta.guests;

	// Update price line
	updateSummaryPricing();
}

//  Update summary pricing rows -
function updateSummaryPricing() {
	if (!room) return;

	const checkin = document.getElementById("checkin").value;
	const checkout = document.getElementById("checkout").value;
	const guests = document.getElementById("guestinput").value || 1;

	document.getElementById("s-checkin").textContent = checkin || "-";
	document.getElementById("s-checkout").textContent = checkout || "-";
	document.getElementById("s-guests").textContent = guests;

	if (nights > 0) {
		const subtotal = room.price * nights;
		total = subtotal + TAX;

		document.getElementById("s-nights").textContent = nights;
		document.getElementById("s-price-line").textContent =
			`$${room.price} × ${nights} nights`;
		document.getElementById("s-subtotal").textContent = `$${subtotal}`;
		document.getElementById("s-total").textContent = `$${total}`;
		document.getElementById("pay-btn-total").textContent = `$${total}`;
	} else {
		document.getElementById("s-nights").textContent = "-";
		document.getElementById("s-price-line").textContent =
			`$${room.price} × - nights`;
		document.getElementById("s-subtotal").textContent = "$-";
		document.getElementById("s-total").textContent = "-";
		document.getElementById("pay-btn-total").textContent = "-";
	}
}

//  Date change handlers
function onCheckinChange() {
	const val = document.getElementById("checkin").value;
	// Checkout must be after check-in
	document.getElementById("checkout").min = val;
	// Clear checkout if it's now before check-in
	const checkout = document.getElementById("checkout").value;
	if (checkout && checkout <= val) {
		document.getElementById("checkout").value = "";
		nights = 0;
	}
	calculateNights();
}

function onCheckoutChange() {
	calculateNights();
}

function calculateNights() {
	const checkin = document.getElementById("checkin").value;
	const checkout = document.getElementById("checkout").value;

	if (checkin && checkout && checkout > checkin) {
		const diff = new Date(checkout) - new Date(checkin);
		nights = Math.round(diff / (1000 * 60 * 60 * 24));
	} else {
		nights = 0;
	}
	updateSummaryPricing();
}

//  Guest change handler
function onGuestChange() {
	const meta = ROOM_META[room?.type] || { guests: 2 };
	const val = parseInt(document.getElementById("guestinput").value);
	const err = document.getElementById("guest-error");

	if (isNaN(val) || val < 1 || val > meta.guests) {
		err.style.display = "block";
	} else {
		err.style.display = "none";
	}
	updateSummaryPricing();
}

//  Card field live display -
function updateCardDisplay() {
	const name = document.getElementById("cardname").value.toUpperCase();
	document.getElementById("card-display-name").textContent =
		name || "NAME ON CARD";
}

function onCardNumberInput() {
	// Auto-format card number with spaces every 4 digits
	let val = document
		.getElementById("cardno")
		.value.replace(/\D/g, "")
		.slice(0, 16);
	const formatted = val.replace(/(.{4})/g, "$1 ").trim();
	document.getElementById("cardno").value = formatted;

	// Update mock card display - mask all but last 4
	const display =
		val.length > 0
			? "•••• &nbsp;•••• &nbsp;•••• &nbsp;" + (val.slice(-4) || "••••")
			: "•••• &nbsp;•••• &nbsp;•••• &nbsp;••••";
	document.getElementById("card-display-number").innerHTML = display;
}

function onCardExpInput() {
	// Auto-format MM/YY
	let val = document
		.getElementById("cardexp")
		.value.replace(/\D/g, "")
		.slice(0, 4);
	if (val.length >= 3) val = val.slice(0, 2) + "/" + val.slice(2);
	document.getElementById("cardexp").value = val;
	document.getElementById("card-display-exp").textContent = val || "MM/YY";
}

//  Step switching
function goToStep(step) {
	if (step === 2) {
		// Validate dates before allowing payment step
		const checkin = document.getElementById("checkin").value;
		const checkout = document.getElementById("checkout").value;
		const err = document.getElementById("dates-error");

		if (!checkin || !checkout || nights < 1) {
			err.style.display = "block";
			return;
		}
		err.style.display = "none";
	}

	const dateStep = document.getElementById("step-dates");
	const payStep = document.getElementById("step-payment");
	const tabDates = document.getElementById("tab-dates");
	const tabPayment = document.getElementById("tab-payment");

	if (step === 1) {
		dateStep.classList.remove("slide-hidden");
		payStep.classList.add("slide-hidden");
		tabDates.classList.add("active");
		tabPayment.classList.remove("active");
	} else {
		dateStep.classList.add("slide-hidden");
		payStep.classList.remove("slide-hidden");
		tabDates.classList.remove("active");
		tabPayment.classList.add("active");
		// Update pay button total when switching to payment step
		document.getElementById("pay-btn-total").textContent =
			total > 0 ? `$${total}` : "-";
	}
}

//  Payment submission
async function submitPayment() {
	const token = localStorage.getItem("token");
	const errEl = document.getElementById("pay-error");
	const sucEl = document.getElementById("pay-success");
	const payBtn = document.getElementById("pay-btn");

	errEl.style.display = "none";
	sucEl.style.display = "none";

	// Collect values
	const cardName = document.getElementById("cardname").value.trim();
	const cardNo = document.getElementById("cardno").value.replace(/\s/g, "");
	const cardExp = document.getElementById("cardexp").value.trim();
	const cardCvv = document.getElementById("cardcvv").value.trim();

	// Client-side validation
	if (!cardName) {
		showPayError("Please enter the cardholder name.");
		return;
	}
	if (!/^\d{16}$/.test(cardNo)) {
		showPayError("Card number must be 16 digits.");
		return;
	}
	if (!/^\d{2}\/\d{2}$/.test(cardExp)) {
		showPayError("Expiry must be in MM/YY format.");
		return;
	}
	if (!/^\d{3,4}$/.test(cardCvv)) {
		showPayError("CVV must be 3 or 4 digits.");
		return;
	}
	if (nights < 1 || total < 1) {
		showPayError("Please go back and select valid dates.");
		return;
	}

	// Disable button while processing
	payBtn.disabled = true;
	payBtn.textContent = "Processing…";

	try {
		// Step 1 - Process mock payment
		const payRes = await fetch("/payment/process", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: "Bearer " + token,
			},
			body: JSON.stringify({
				cardNumber: cardNo,
				expiry: cardExp,
				cvv: cardCvv,
				amount: total,
			}),
		});

		const payData = await payRes.json();

		if (!payRes.ok) {
			showPayError(
				payData.error || "Payment failed. Please check your card details.",
			);
			payBtn.disabled = false;
			payBtn.textContent = `Pay $${total}`;
			return;
		}

		// Step 2 - Create booking
		const checkin = document.getElementById("checkin").value;
		const checkout = document.getElementById("checkout").value;
		const guests = parseInt(document.getElementById("guestinput").value) || 1;

		const bookRes = await fetch("/bookings", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: "Bearer " + token,
			},
			body: JSON.stringify({
				roomId: room.id,
				checkIn: checkin,
				checkOut: checkout,
				guests: guests,
			}),
		});

		const bookData = await bookRes.json();

		if (!bookRes.ok) {
			showPayError(
				bookData.error || "Booking could not be created. Please try again.",
			);
			payBtn.disabled = false;
			payBtn.textContent = `Pay $${total}`;
			return;
		}

		// Step 3 - Success - redirect to my bookings
		sucEl.textContent = `Booking confirmed! Reference: ${bookData.id}. Redirecting…`;
		sucEl.style.display = "block";
		payBtn.textContent = "Booking confirmed ✓";

		setTimeout(() => {
			window.location.href = "/pages/mybooking.html";
		}, 2000);
	} catch (err) {
		showPayError("Network error. Is the server running?");
		payBtn.disabled = false;
		payBtn.textContent = `Pay $${total}`;
	}
}

function showPayError(msg) {
	const el = document.getElementById("pay-error");
	el.textContent = msg;
	el.style.display = "block";
}

function onCardExpInput() {
	let val = document
		.getElementById("cardexp")
		.value.replace(/\D/g, "")
		.slice(0, 4);

	if (val.length >= 2 && parseInt(val.slice(0, 2)) > 12) {
		val = "12" + val.slice(2);
	}

	if (val.length === 4 && parseInt(val.slice(2)) < 26) {
		val = val.slice(0, 2) + "26";
	}

	if (val.length >= 3) val = val.slice(0, 2) + "/" + val.slice(2);

	document.getElementById("cardexp").value = val;
	document.getElementById("card-display-exp").textContent = val || "MM/YY";
}
