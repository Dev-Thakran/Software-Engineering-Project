// Escapes user-supplied text before it is inserted with innerHTML
function escapeHtml(value) {
	return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		"\"": "&quot;",
		"'": "&#39;",
	})[ch]);
}

document.addEventListener("DOMContentLoaded", function () {
	const token = localStorage.getItem("token");
	const staffName = localStorage.getItem("name") || "Staff";

	// Staff name
	document.getElementById("staff-name").textContent = staffName.split(" ")[0];

	// Greeting based on time
	const hour = new Date().getHours();
	const greeting = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
	document.getElementById("greeting-time").textContent = greeting;

	// Date display
	const now = new Date();
	const dateOptions = { weekday: "long", day: "numeric", month: "short" };
	const formatter = new Intl.DateTimeFormat("en-GB", dateOptions);
	const parts = formatter.formatToParts(now);
	const weekday = parts.find((p) => p.type === "weekday").value;
	const day = parts.find((p) => p.type === "day").value;
	const month = parts.find((p) => p.type === "month").value;
	document.getElementById("date-display").textContent =
		`${weekday}, ${day} ${month}`;

	// Live clock
	function updateClock() {
		const timeOptions = { hour: "numeric", minute: "2-digit", hour12: true };
		document.getElementById("time-display").textContent = new Date()
			.toLocaleTimeString("en-US", timeOptions)
			.toLowerCase();
	}
	updateClock();
	setInterval(updateClock, 1000);

	// Shift clock - runs on New Zealand time. The server sends the exact
	// start and end of today's shift, so the countdown is right whatever time
	// zone this computer is set to.
	let shift = { state: "none", messages: {} };
	let clockOffset = 0; // server clock minus this computer's clock
	let shiftTimer = null;
	const isManager = localStorage.getItem("role") === "manager";

	const pad = (n) => String(n).padStart(2, "0");
	function formatDuration(ms) {
		const total = Math.max(0, Math.floor(ms / 1000));
		return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
	}

	async function loadShift() {
		if (!token) return;
		try {
			const res = await fetch("/shifts/status", {
				headers: { Authorization: "Bearer " + token },
			});
			if (!res.ok) throw new Error();
			shift = await res.json();
			clockOffset = shift.serverNow - Date.now();
			clearInterval(shiftTimer);
			renderShift();
			shiftTimer = setInterval(renderShift, 1000);
		} catch {
			document.getElementById("shift-type").textContent = "Could not load shift";
		}
	}

	// Where we are in the shift right now. Worked out every second, so the
	// clock moves from "starts in" to "remaining" to "finished" by itself.
	function shiftState() {
		if (shift.state === "none") return "none";
		const now = Date.now() + clockOffset;
		if (now < shift.startsAt) return "before";
		if (now < shift.endsAt) return "on";
		return "after";
	}

	function renderShift() {
		const typeEl = document.getElementById("shift-type");
		const hoursEl = document.getElementById("shift-hours");
		const countdownEl = document.getElementById("shift-countdown");
		const labelEl = document.getElementById("shift-label");
		const noteEl = document.getElementById("shift-status");
		const now = Date.now() + clockOffset;
		const state = shiftState();
		countdownEl.style.color = "";
		noteEl.textContent = "";

		if (state === "none") {
			typeEl.textContent = "No shift today";
			hoursEl.textContent = "";
			countdownEl.textContent = "--:--:--";
			labelEl.textContent = "Day off";
			return;
		}
		typeEl.textContent = shift.shiftType;
		hoursEl.textContent = ` (${shift.hours})`;
		if (state === "before") {
			countdownEl.textContent = formatDuration(shift.startsAt - now);
			labelEl.textContent = "Until your shift starts";
			noteEl.textContent = `Starts at ${shift.hours.split(" - ")[0]}`;
		} else if (state === "on") {
			const left = shift.endsAt - now;
			countdownEl.textContent = formatDuration(left);
			labelEl.textContent = "Remaining";
			if (left < 1800000) {
				countdownEl.style.color = "#9A826A";
				noteEl.textContent = "Shift ending soon";
			}
		} else {
			countdownEl.textContent = "00:00:00";
			labelEl.textContent = "Shift finished";
			noteEl.textContent = "Thanks for today!";
		}
	}

	// ---------- Off-shift popup ----------
	const POPUP_TITLES = {
		after: "Shift finished",
		before: "Shift not started",
		none: "No shift today",
	};

	function showShiftPopup(state, message) {
		document.querySelector(".shift-popup")?.remove();
		const overlay = document.createElement("div");
		overlay.className = "shift-popup";
		overlay.innerHTML = `
			<div class="shift-popup-card" role="alertdialog" aria-modal="true"
			     aria-labelledby="shift-popup-title" aria-describedby="shift-popup-text">
				<p class="kicker">Staff console</p>
				<h2 id="shift-popup-title" class="font-serif"></h2>
				<p id="shift-popup-text"></p>
				<button type="button" class="btn-primary">OK</button>
			</div>`;
		overlay.querySelector("h2").textContent = POPUP_TITLES[state] || "Off shift";
		overlay.querySelector("#shift-popup-text").textContent = message;

		const close = () => {
			overlay.classList.add("closing");
			document.removeEventListener("keydown", onKey);
			setTimeout(() => overlay.remove(), 180);
		};
		const onKey = (e) => {
			if (e.key === "Escape") close();
		};
		overlay.addEventListener("click", (e) => {
			if (e.target === overlay) close();
		});
		overlay.querySelector("button").addEventListener("click", close);
		document.addEventListener("keydown", onKey);
		document.body.appendChild(overlay);
		overlay.querySelector("button").focus();
	}

	// Staff can only check guests in or out during their shift (managers
	// don't work shifts). The server enforces this too.
	function blockedByShift() {
		if (isManager) return false;
		const state = shiftState();
		if (state === "on") return false;
		showShiftPopup(state, shift.messages[state]);
		return true;
	}

	// Check-ins count
	async function loadCheckIns() {
		if (!token) return;
		try {
			const res = await fetch("/checkins/today", {
				headers: { Authorization: "Bearer " + token },
			});
			const data = await res.json();
			document.getElementById("checkins-today").textContent = data.count;
		} catch {
			document.getElementById("checkins-today").textContent = "-";
		}
	}

	// Queue - guests awaiting check-in
	async function loadQueue() {
		if (!token) return;
		try {
			const res = await fetch("/checkins/queue", {
				headers: { Authorization: "Bearer " + token },
			});
			const data = await res.json();
			document.getElementById("queue-count").textContent = data.count;

			const list = document.getElementById("queue-list");
			if (data.bookings.length === 0) {
				list.innerHTML = `<p class="text-sm" style="color:#8B7355;">No guests awaiting check-in.</p>`;
				return;
			}

			list.innerHTML = data.bookings
				.map(
					(b) => `
            <div class="guest-row">
                <div>
                    <p class="meta-label">${escapeHtml(b.id)} · ${escapeHtml(b.userName)}</p>
                    <p class="font-serif text-xl" style="color:var(--lux-brown-800);">${escapeHtml(b.userName)}</p>
                </div>
                <div>
                    <p class="meta-label">Room</p>
                    <p class="meta-value">Room ${b.roomId} · Floor ${b.floor}</p>
                    <p class="meta-label mt-2">Stay</p>
                    <p class="meta-value">${escapeHtml(b.checkIn)} - ${escapeHtml(b.checkOut)}</p>
                    <p class="meta-label mt-2">Paid</p>
                    <p class="meta-value">$${b.total} ✓</p>
                </div>
                <div class="text-right">
                    <button onclick="checkIn('${b.id}')" class="btn-primary" style="padding:10px 20px; font-size:10px;">
                        Check In
                    </button>
                </div>
            </div>
        `,
				)
				.join("");
		} catch {
			document.getElementById("queue-list").innerHTML =
				`<p class="text-sm" style="color:#8B7355;">Could not load queue.</p>`;
		}
	}

	// Currently in residence
	async function loadResidence() {
		if (!token) return;
		try {
			const res = await fetch("/checkins/residence", {
				headers: { Authorization: "Bearer " + token },
			});
			const checkins = await res.json();
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
                    <p class="meta-label">Room ${escapeHtml(c.roomId)} · ${escapeHtml(c.roomType)}</p>
                    <p class="font-serif text-xl" style="color:var(--lux-brown-800);">${escapeHtml(c.guestName)}</p>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <p class="meta-label">Checked in</p>
                        <p class="meta-value">${c.checkInTime.split("T")[0]}</p>
                    </div>
                    <div>
                        <p class="meta-label">Depart</p>
                        <p class="meta-value">${escapeHtml(c.checkOutDate)}</p>
                    </div>
                    <div>
                        <p class="meta-label">Attending</p>
                        <p class="meta-value">${escapeHtml(c.attendingStaff || "-")}</p>
                    </div>
                </div>
                <div class="text-right">
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

	// Check in and check out action
	async function checkIn(bookingId) {
		if (blockedByShift()) return;
		if (!confirm("Confirm check-in for this guest?")) return;
		try {
			const res = await fetch(`/checkins/checkin/${bookingId}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer " + token,
				},
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				if (data.offShift) return showShiftPopup(data.offShift, data.error);
				throw new Error();
			}
			loadQueue();
			loadCheckIns();
			loadResidence();
		} catch {
			alert("Could not complete check-in.");
		}
	}

	async function checkOut(checkinId) {
		if (blockedByShift()) return;
		if (!confirm("Confirm check-out for this guest?")) return;
		try {
			const res = await fetch(`/checkins/checkout/${checkinId}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer " + token,
				},
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				if (data.offShift) return showShiftPopup(data.offShift, data.error);
				throw new Error();
			}
			loadResidence();
		} catch {
			alert("Could not complete check-out.");
		}
	}

	// Make functions global for onclick handlers
	window.checkIn = checkIn;
	window.checkOut = checkOut;

	// Load everything
	loadShift();
	loadCheckIns();
	loadQueue();
	loadResidence();

	// Refresh the lists when a check-in or check-out is confirmed in the chat
	window.addEventListener("ai:data-changed", () => {
		loadCheckIns();
		loadQueue();
		loadResidence();
	});
});
