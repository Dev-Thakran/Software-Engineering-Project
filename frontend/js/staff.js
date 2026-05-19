document.addEventListener("DOMContentLoaded", function () {
	// Wait for the full HTML page to load before running any JavaScript
	// The header is loaded dynamically so elements like date-display
	// won't exist until the DOM is fully built

	const token = localStorage.getItem("token");
	// Retrieve the JWT token saved to localStorage when the user logged in
	// This is sent with every fetch request to prove the user is authenticated

	const staffName = localStorage.getItem("name") || "Staff";
	// Get the staff member's full name from localStorage
	// Falls back to "Staff" if name was never saved

	// ── Staff name and greeting ────────────────────────────────
	document.getElementById("staff-name").textContent = staffName.split(" ")[0];
	// Show only the first name e.g. "Mike Tane" → "Mike"
	// split(" ")[0] splits by space and takes the first part

	const hour = new Date().getHours();
	// Get the current hour as a number 0-23

	// Choose the correct greeting based on time of day
	const greeting = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
	document.getElementById("greeting-time").textContent = greeting;
	// Updates the span inside "Good [morning/afternoon/evening], Mike."

	// ── Date display ───────────────────────────────────────────
	const now = new Date();
	const dateOptions = { weekday: "long", day: "numeric", month: "short" };
	// Format options — produces e.g. "Saturday, 18 May"

	const formatter = new Intl.DateTimeFormat("en-GB", dateOptions);
	// en-GB locale puts day before month which is correct for NZ

	const parts = formatter.formatToParts(now);
	// Break the date into named parts so we can access each piece individually

	const weekday = parts.find((p) => p.type === "weekday").value; // "Saturday"
	const day = parts.find((p) => p.type === "day").value; // "18"
	const month = parts.find((p) => p.type === "month").value; // "May"

	document.getElementById("date-display").textContent =
		`${weekday}, ${day} ${month}`;
	// Displays "Saturday, 18 May" in the top right corner

	// ── Live clock ─────────────────────────────────────────────
	function updateClock() {
		const timeOptions = { hour: "numeric", minute: "2-digit", hour12: true };
		// 12-hour format with AM/PM e.g. "11:46 am"
		document.getElementById("time-display").textContent = new Date()
			.toLocaleTimeString("en-US", timeOptions)
			.toLowerCase();
		// toLowerCase converts "AM"/"PM" to "am"/"pm" to match the design
	}
	updateClock(); // Run immediately when page loads
	setInterval(updateClock, 1000); // Then update every 1000ms (1 second)

	// ── Shift countdown ────────────────────────────────────────
	async function loadShift() {
		if (!token) return;
		// Don't attempt the fetch if there is no token

		try {
			const res = await fetch("/shifts/mine", {
				headers: { Authorization: "Bearer " + token },
				// Send JWT token so the backend knows who is asking
			});
			const shifts = await res.json();
			// Returns all shifts belonging to the logged-in staff member

			const today = new Date().toLocaleDateString("en-CA");
			// en-CA locale produces YYYY-MM-DD format e.g. "2026-05-18"
			// This is used instead of toISOString() because ISO uses UTC time
			// which can return yesterday's date for NZ users (UTC+12)

			const active = shifts.find(
				(s) => s.date === today && s.status === "active",
			);
			// Find the shift that matches today's date and is currently active

			if (!active) {
				// No active shift found — show a message and stop
				document.getElementById("shift-type").textContent = "No active shift";
				document.getElementById("shift-countdown").textContent = "--:--:--";
				return;
			}

			// Display shift type e.g. "Morning"
			document.getElementById("shift-type").textContent = active.shiftType;
			// Display shift hours e.g. "(07:00 — 15:00)"
			document.getElementById("shift-hours").textContent =
				" (" + active.shiftStart + " — " + active.shiftEnd + ")";

			// Parse the shift end time into hours and minutes
			const [endHour, endMin] = active.shiftEnd.split(":").map(Number);

			// Create a Date object for today at the shift end time
			const shiftEnd = new Date();
			shiftEnd.setHours(endHour, endMin, 0, 0);

			// Handle night shifts that end after midnight
			// If end hour is less than start hour it crosses midnight
			// so we add one day to the end time
			const [startHour] = active.shiftStart.split(":").map(Number);
			if (endHour < startHour) shiftEnd.setDate(shiftEnd.getDate() + 1);

			// ── Countdown timer ────────────────────────────────
			function updateCountdown() {
				const remaining = shiftEnd - new Date();
				// Subtract current time from shift end time
				// Result is in milliseconds

				if (remaining <= 0) {
					// Shift has ended — show zeros and a completion message
					document.getElementById("shift-countdown").textContent = "00:00:00";
					document.getElementById("shift-status").textContent =
						"Shift complete";
					return;
				}

				// Convert milliseconds into hours, minutes, seconds
				const h = Math.floor(remaining / 3600000); // 1 hour = 3,600,000ms
				const m = Math.floor((remaining % 3600000) / 60000); // remainder after hours → minutes
				const s = Math.floor((remaining % 60000) / 1000); // remainder after minutes → seconds

				// Pad single digits with a leading zero e.g. 9 → "09"
				const pad = (n) => String(n).padStart(2, "0");

				document.getElementById("shift-countdown").textContent =
					`${pad(h)}:${pad(m)}:${pad(s)}`;

				// Turn the countdown gold when less than 30 minutes remain
				// 30 minutes = 1,800,000 milliseconds
				if (remaining < 1800000) {
					document.getElementById("shift-countdown").style.color = "#9A826A";
					document.getElementById("shift-status").textContent =
						"Shift ending soon";
				}
			}

			updateCountdown(); // Run immediately
			setInterval(updateCountdown, 1000); // Then update every second
		} catch (err) {
			// If the fetch fails, show an error message instead of crashing
			document.getElementById("shift-type").textContent =
				"Could not load shift";
		}
	}

	// ── Check-ins count ────────────────────────────────────────
	async function loadCheckIns() {
		if (!token) return;
		try {
			const res = await fetch("/checkins/today", {
				headers: { Authorization: "Bearer " + token },
			});
			const data = await res.json();
			// Backend returns { count: N, checkins: [...] }
			// We only need the count for the stat card
			document.getElementById("checkins-today").textContent = data.count;
		} catch {
			// Show a dash if the request fails
			document.getElementById("checkins-today").textContent = "—";
		}
	}

	// ── Queue — guests awaiting check-in ───────────────────────
	async function loadQueue() {
		if (!token) return;
		try {
			const res = await fetch("/checkins/queue", {
				headers: { Authorization: "Bearer " + token },
			});
			const data = await res.json();
			// Backend returns pending bookings where checkIn date is today

			// Update the queue count in the stat card
			document.getElementById("queue-count").textContent = data.count;

			const list = document.getElementById("queue-list");

			if (data.bookings.length === 0) {
				list.innerHTML = `<p class="text-sm" style="color:#8B7355;">No guests awaiting check-in.</p>`;
				return;
			}

			// Build a row for each pending booking using template literals
			list.innerHTML = data.bookings
				.map(
					(b) => `
                <div class="guest-row">
                    <div>
                        <!-- Booking ID and guest name as kicker above the main name -->
                        <p class="meta-label">${b.id} · ${b.userName}</p>
                        <p class="font-serif text-xl" style="color:#2C241B;">${b.userName}</p>
                    </div>
                    <div>
                        <!-- Room details -->
                        <p class="meta-label">Room</p>
                        <p class="meta-value">Room ${b.roomId} · Floor ${b.floor}</p>
                        <!-- Stay dates -->
                        <p class="meta-label mt-2">Stay</p>
                        <p class="meta-value">${b.checkIn} — ${b.checkOut}</p>
                        <!-- Amount paid with tick to confirm payment received -->
                        <p class="meta-label mt-2">Paid</p>
                        <p class="meta-value">$${b.total} ✓</p>
                    </div>
                    <div class="text-right">
                        <!-- Check In button calls the checkIn function with this booking's id -->
                        <button onclick="checkIn('${b.id}')" class="btn-primary" style="padding:10px 20px; font-size:10px;">
                            Check In
                        </button>
                    </div>
                </div>
            `,
				)
				.join(""); // Join array of HTML strings into one block
		} catch {
			document.getElementById("queue-list").innerHTML =
				`<p class="text-sm" style="color:#8B7355;">Could not load queue.</p>`;
		}
	}

	// ── Currently in residence ─────────────────────────────────
	async function loadResidence() {
		if (!token) return;
		try {
			const res = await fetch("/checkins/residence", {
				headers: { Authorization: "Bearer " + token },
			});
			const checkins = await res.json();
			// Backend returns all checkins with status "checked-in"
			// These are guests currently staying in the hotel

			const list = document.getElementById("residence-list");

			if (checkins.length === 0) {
				list.innerHTML = `<p class="text-sm" style="color:#8B7355;">No guests currently in residence.</p>`;
				return;
			}

			list.innerHTML = checkins
				.map(
					(c) => `
                <div class="residence-row">
                    <div>
                        <!-- Room number and type as kicker above guest name -->
                        <p class="meta-label">Room ${c.roomId} · ${c.roomType}</p>
                        <p class="font-serif text-xl" style="color:#2C241B;">${c.guestName}</p>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <p class="meta-label">Checked in</p>
                            <!-- Split on "T" to get just the date part from ISO timestamp -->
                            <p class="meta-value">${c.checkInTime.split("T")[0]}</p>
                        </div>
                        <div>
                            <p class="meta-label">Depart</p>
                            <p class="meta-value">${c.checkOutDate}</p>
                        </div>
                        <div>
                            <p class="meta-label">Attending</p>
                            <!-- Show attending staff name or dash if unassigned -->
                            <p class="meta-value">${c.attendingStaff || "—"}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <!-- Check Out button calls checkOut with this checkin's id -->
                        <button onclick="checkOut('${c.id}')" class="btn-secondary" style="padding:10px 20px; font-size:10px;">
                            Check Out
                        </button>
                    </div>
                </div>
            `,
				)
				.join("");
		} catch {
			document.getElementById("residence-list").innerHTML =
				`<p class="text-sm" style="color:#8B7355;">Could not load residence.</p>`;
		}
	}

	// ── Check In action ────────────────────────────────────────
	async function checkIn(bookingId) {
		// Called when staff clicks the Check In button on a pending booking
		if (!confirm("Confirm check-in for this guest?")) return;
		// Show a confirmation dialog — if staff clicks Cancel, do nothing

		try {
			await fetch(`/bookings/${bookingId}`, {
				method: "PATCH",
				// PATCH updates only the fields we specify, not the whole record
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer " + token,
				},
				body: JSON.stringify({ status: "confirmed" }),
				// Update this booking's status to confirmed in bookings.json
			});

			// Reload the queue and check-in count so the UI updates immediately
			// without needing a full page refresh
			loadQueue();
			loadCheckIns();
		} catch {
			alert("Could not complete check-in.");
		}
	}

	// ── Check Out action ───────────────────────────────────────
	async function checkOut(checkinId) {
		// Called when staff clicks the Check Out button on a resident guest
		if (!confirm("Confirm check-out for this guest?")) return;

		try {
			await fetch(`/bookings/${checkinId}`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer " + token,
				},
				body: JSON.stringify({ status: "checked-out" }),
				// The backend will also set the room status back to available
				// when it sees the checked-out status
			});

			// Reload the residence list so the checked-out guest disappears
			loadResidence();
		} catch {
			alert("Could not complete check-out.");
		}
	}

	// ── Make action functions globally accessible ──────────────
	// The checkIn and checkOut functions are defined inside DOMContentLoaded
	// which means they are scoped to that function and not accessible globally
	// onclick="checkIn(...)" in the HTML needs them on the window object
	window.checkIn = checkIn;
	window.checkOut = checkOut;

	// ── Load everything on page open ───────────────────────────
	// All four functions run simultaneously when the page loads
	// They are independent of each other so there is no need to wait
	// for one to finish before starting the next
	loadShift();
	loadCheckIns();
	loadQueue();
	loadResidence();
});
