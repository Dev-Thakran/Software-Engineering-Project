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
	// Staff only - everyone else goes back to the main site
	if (!token) {
		window.location.href = `/pages/Login.html?redirect=${encodeURIComponent(location.pathname)}`;
		return;
	}
	if (localStorage.getItem("role") !== "staff") {
		window.location.href = "/pages/index.html";
		return;
	}
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

	// Staff can only check guests in or out during their shift. The server
	// enforces this too.
	function blockedByShift() {
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

	// Today's date at the hotel (New Zealand), whatever the computer's timezone
	const hotelToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
	const prettyDate = (ymd) => UI.dates.pretty(ymd);

	let queue = []; // bookings awaiting check-in
	let residents = []; // guests currently staying
	let residenceFilter = "all";

	const rowSkeleton = UI.skeleton(
		3,
		`<div class="guest-row" aria-hidden="true">
			<div><div class="skeleton skeleton-line" style="width:40%"></div><div class="skeleton skeleton-line" style="width:70%;height:18px"></div></div>
			<div><div class="skeleton skeleton-line" style="width:80%"></div><div class="skeleton skeleton-line" style="width:60%"></div></div>
			<div></div><div></div>
		</div>`,
	);
	document.getElementById("queue-list").innerHTML = rowSkeleton;
	document.getElementById("residence-list").innerHTML = rowSkeleton;

	const emptyRow = (text) => `<div class="empty-state" style="padding:28px">${text}</div>`;

	// Queue - guests awaiting check-in
	async function loadQueue() {
		if (!token) return;
		try {
			const res = await fetch("/checkins/queue", {
				headers: { Authorization: "Bearer " + token },
			});
			const data = await res.json();
			document.getElementById("queue-count").textContent = data.count;
			queue = data.bookings;
			renderQueue();
		} catch {
			document.getElementById("queue-list").innerHTML = emptyRow(
				`Couldn't load the arrivals. <button type="button" class="btn-ghost" onclick="location.reload()">Try again</button>`,
			);
		}
	}

	function renderQueue() {
		const list = document.getElementById("queue-list");
		const term = document.getElementById("queue-search").value.trim().toLowerCase();
		const shown = queue.filter((b) =>
			!term || [b.userName, b.roomId, b.id, b.guestEmail].some((v) => String(v || "").toLowerCase().includes(term)),
		);
		document.getElementById("queue-search-count").textContent = term ? `${shown.length} of ${queue.length}` : "";

		if (!queue.length) {
			list.innerHTML = emptyRow("Everyone due today has arrived. Nice work.");
			return;
		}
		if (!shown.length) {
			list.innerHTML = emptyRow(`No arrivals match "${escapeHtml(term)}".`);
			return;
		}
		list.innerHTML = shown
			.map(
				(b) => `
            <div class="guest-row">
                <div>
                    <p class="meta-label">${escapeHtml(b.id)}</p>
                    <p class="font-serif text-xl" style="color:var(--lux-brown-800);">${escapeHtml(b.userName)}</p>
                    ${b.guestEmail ? `<p class="meta-value" style="color:var(--lux-text-muted)">${escapeHtml(b.guestEmail)}</p>` : ""}
                </div>
                <div>
                    <p class="meta-label">Room</p>
                    <p class="meta-value">Room ${escapeHtml(b.roomId)} · Floor ${b.floor}</p>
                </div>
                <div>
                    <p class="meta-label">Stay</p>
                    <p class="meta-value">${prettyDate(b.checkIn)} – ${prettyDate(b.checkOut)} · ${b.nights} ${b.nights === 1 ? "night" : "nights"}</p>
                    <p class="meta-value" style="color:var(--lux-success)">Paid ${UI.money(b.total + 30)} incl. $30 fees${b.ratePlan === "advance" ? " · Advance purchase" : ""}${b.promoCode ? ` · ${escapeHtml(b.promoCode)} −${UI.money(b.discount)}` : ""}</p>
                    ${b.adults ? `<p class="meta-value" style="color:var(--lux-text-muted)">${UI.party.label({ adults: b.adults, children: b.children || 0 })}</p>` : ""}
                    ${b.arrivalTime ? `<p class="meta-value">Arriving ${escapeHtml(b.arrivalTime)}</p>` : ""}
                    ${b.requests ? `<p class="guest-request"><span class="meta-label">Request</span> ${escapeHtml(b.requests)}</p>` : ""}
                </div>
                <div class="md:text-right">
                    ${b.roomNotReady ? `<p class="room-warning" id="ready-${escapeHtml(b.id)}">${escapeHtml(b.roomNotReady)}</p>` : ""}
                    <button onclick="checkIn('${escapeHtml(b.id)}')" class="${b.roomNotReady ? "btn-secondary" : "btn-primary"}" style="padding:12px 22px;"${b.roomNotReady ? ` aria-describedby="ready-${escapeHtml(b.id)}"` : ""}>
                        Check in
                    </button>
                </div>
            </div>`,
			)
			.join("");
	}

	document.getElementById("queue-search").addEventListener("input", renderQueue);

	// Currently in residence, with today's departures first
	async function loadResidence() {
		if (!token) return;
		try {
			const res = await fetch("/checkins/residence", {
				headers: { Authorization: "Bearer " + token },
			});
			residents = await res.json();
			renderResidence();
		} catch {
			document.getElementById("residence-list").innerHTML = emptyRow(
				`Couldn't load the guests in residence. <button type="button" class="btn-ghost" onclick="location.reload()">Try again</button>`,
			);
		}
	}

	function renderResidence() {
		const list = document.getElementById("residence-list");
		const today = hotelToday();
		// Departing today vs overdue (should have left on an earlier day)
		const leaving = (c) => c.checkOutDate === today;
		const overdue = (c) => c.checkOutDate < today;
		const departures = residents.filter(leaving);
		const late = residents.filter(overdue);
		document.getElementById("departures-count").textContent = departures.length;
		document.getElementById("overdue-count").textContent = late.length;
		document.querySelectorAll("#residence-filter [data-filter]").forEach((chip) =>
			chip.setAttribute("aria-pressed", String(chip.dataset.filter === residenceFilter)),
		);

		const shown = (residenceFilter === "leaving" ? departures : residenceFilter === "overdue" ? late : residents)
			.slice()
			.sort((a, b) => a.checkOutDate.localeCompare(b.checkOutDate));

		if (!shown.length) {
			list.innerHTML = emptyRow(
				residenceFilter === "leaving" ? "Nobody is due to check out today." : residenceFilter === "overdue" ? "No overdue guests." : "No guests are staying right now.",
			);
			return;
		}

		list.innerHTML = shown
			.map(
				(c) => `
            <div class="residence-row">
                <div>
                    <p class="meta-label">Room ${escapeHtml(c.roomId)} · ${escapeHtml(c.roomType)}</p>
                    <p class="font-serif text-xl" style="color:var(--lux-brown-800);">${escapeHtml(c.guestName)}</p>
                    ${leaving(c) ? `<span class="badge" style="background:#2c241b;color:#faf7f2;margin-top:6px">Departing today</span>` : ""}
                    ${overdue(c) ? `<span class="badge" style="background:#8b3a2e;color:#fff;margin-top:6px">Overdue · was due ${prettyDate(c.checkOutDate)}</span>` : ""}
                </div>
                <div class="grid grid-cols-3 gap-4">
                    <div>
                        <p class="meta-label">Checked in</p>
                        <p class="meta-value">${prettyDate(c.checkInTime.split("T")[0])}</p>
                    </div>
                    <div>
                        <p class="meta-label">Departs</p>
                        <p class="meta-value">${prettyDate(c.checkOutDate)}</p>
                    </div>
                    <div>
                        <p class="meta-label">Attending</p>
                        <p class="meta-value">${escapeHtml(c.attendingStaff || "-")}</p>
                    </div>
                </div>
                <div class="md:text-right">
                    <button onclick="checkOut('${escapeHtml(c.id)}')" class="${leaving(c) || overdue(c) ? "btn-primary" : "btn-secondary"}" style="padding:12px 22px;">
                        Check out
                    </button>
                </div>
            </div>`,
			)
			.join("");
	}

	document.getElementById("residence-filter").addEventListener("click", (e) => {
		const chip = e.target.closest("[data-filter]");
		if (!chip) return;
		residenceFilter = chip.dataset.filter;
		renderResidence();
	});

	function refreshAll() {
		loadQueue();
		loadCheckIns();
		loadResidence();
		loadHousekeeping();
	}

	// Housekeeping - rooms waiting to be cleaned after a check-out
	async function loadHousekeeping() {
		if (!token) return;
		const list = document.getElementById("housekeeping-list");
		try {
			const res = await fetch("/checkins/housekeeping", { headers: { Authorization: "Bearer " + token } });
			if (!res.ok) throw new Error();
			const rooms = await res.json();
			const since = (iso) => new Date(iso).toLocaleTimeString("en-NZ", { timeZone: "Pacific/Auckland", hour: "numeric", minute: "2-digit" });
			document.getElementById("housekeeping-count").textContent = rooms.length;
			list.innerHTML = rooms.length
				? rooms
						.map(
							(r) => `
            <div class="housekeeping-row">
                <div>
                    <p class="meta-label">Floor ${r.floor} · ${escapeHtml(r.type)}</p>
                    <p class="font-serif text-xl" style="color:var(--lux-brown-800);">Room ${escapeHtml(r.id)}</p>
                    ${r.since ? `<p class="meta-value" style="color:var(--lux-text-muted)">Needs cleaning since ${since(r.since)}</p>` : ""}
                </div>
                <button type="button" class="btn-secondary" style="padding:10px 18px" onclick="markClean('${escapeHtml(r.id)}')">Mark clean</button>
            </div>`,
						)
						.join("")
				: emptyRow("Every room is clean and ready.");
		} catch {
			list.innerHTML = emptyRow("Couldn't load housekeeping.");
		}
	}

	async function markClean(roomId) {
		if (blockedByShift()) return;
		const ok = await UI.dialog({
			title: `Mark Room ${roomId} clean?`,
			body: `<p style="color:var(--lux-brown-600);line-height:1.7">The room will be ready for its next guest to check in.</p>`,
			confirmLabel: "Mark clean",
			onConfirm: async () => {
				const problem = await postAction(`/checkins/housekeeping/${encodeURIComponent(roomId)}`);
				if (problem === null) return "shift";
				if (problem) throw new Error(problem);
			},
		});
		if (ok === true) {
			UI.toast(`Room ${roomId} is clean and ready`);
			refreshAll();
		}
	}

	// Sends a check-in or check-out; returns the error message, or "" when it worked
	async function postAction(url) {
		const res = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
		});
		if (res.ok) return "";
		const data = await res.json().catch(() => ({}));
		if (data.offShift) {
			showShiftPopup(data.offShift, data.error);
			return null; // the shift popup explains it
		}
		return data.error || "Something went wrong. Please try again.";
	}

	// Check in and check out actions
	async function checkIn(bookingId) {
		if (blockedByShift()) return;
		const b = queue.find((x) => x.id === bookingId);
		const ok = await UI.dialog({
			title: `Check in ${b ? b.userName : "this guest"}?`,
			body: b
				? `<p style="color:var(--lux-brown-600);line-height:1.7">Room ${escapeHtml(b.roomId)}, staying until ${prettyDate(b.checkOut)}. The room will show as occupied.</p>`
				: "",
			confirmLabel: "Check in",
			onConfirm: async () => {
				const problem = await postAction(`/checkins/checkin/${encodeURIComponent(bookingId)}`);
				if (problem === null) return "shift";
				if (problem) throw new Error(problem);
			},
		});
		if (ok === true) {
			UI.toast(`${b ? b.userName : "Guest"} checked in to Room ${b ? b.roomId : ""}`);
			refreshAll();
		}
	}

	async function checkOut(checkinId) {
		if (blockedByShift()) return;
		const c = residents.find((x) => x.id === checkinId);
		const ok = await UI.dialog({
			title: `Check out ${c ? c.guestName : "this guest"}?`,
			body: c ? `<p style="color:var(--lux-brown-600);line-height:1.7">Room ${escapeHtml(c.roomId)} will be released for housekeeping.</p>` : "",
			confirmLabel: "Check out",
			onConfirm: async () => {
				const problem = await postAction(`/checkins/checkout/${encodeURIComponent(checkinId)}`);
				if (problem === null) return "shift";
				if (problem) throw new Error(problem);
			},
		});
		if (ok === true) {
			UI.toast(`${c ? c.guestName : "Guest"} checked out of Room ${c ? c.roomId : ""}`);
			refreshAll();
		}
	}

	// Make functions global for onclick handlers
	window.checkIn = checkIn;
	window.checkOut = checkOut;
	window.markClean = markClean;

	// Load everything
	loadShift();
	loadCheckIns();
	loadQueue();
	loadResidence();
	loadHousekeeping();

	// Refresh the lists when a check-in or check-out is confirmed in the chat
	window.addEventListener("ai:data-changed", () => {
		loadCheckIns();
		loadQueue();
		loadResidence();
		loadHousekeeping();
	});
});
