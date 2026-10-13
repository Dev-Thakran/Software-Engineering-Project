// ============================================================
//  floormap.js - Every room by floor, coloured by whether it is
//  free for the chosen dates. Rooms are buttons: hover, tap or
//  use the arrow keys to preview, then follow through to book.
// ============================================================

const FLOOR_NAMES = { 1: "Garden", 2: "Classic", 3: "Executive", 4: "Penthouse" };
const $ = (id) => document.getElementById(id);

const state = { rooms: [], checkIn: "", checkOut: "", guests: 2, selected: null };

document.addEventListener("DOMContentLoaded", () => {
	// Default to tonight, so the map always answers "what's free?"
	const today = UI.dates.today();
	state.checkIn = today;
	state.checkOut = UI.dates.addDays(today, 1);
	$("map-checkin").min = today;
	$("map-checkin").value = state.checkIn;
	$("map-checkout").min = state.checkOut;
	$("map-checkout").value = state.checkOut;

	$("map-checkin").addEventListener("change", () => {
		const from = $("map-checkin").value;
		if (!from) return;
		const earliest = UI.dates.addDays(from, 1);
		$("map-checkout").min = earliest;
		if ($("map-checkout").value < earliest) $("map-checkout").value = earliest;
		datesChanged();
	});
	$("map-checkout").addEventListener("change", datesChanged);
	$("map-guests").addEventListener("change", () => {
		state.guests = Number($("map-guests").value);
		render();
	});
	$("map-dates").addEventListener("submit", (e) => e.preventDefault());
	// Leaving the map goes back to showing the chosen room
	$("floor-map").addEventListener("mouseleave", () => preview(state.selected));

	load();
});

function datesChanged() {
	const from = $("map-checkin").value;
	const to = $("map-checkout").value;
	let problem = "";
	if (!from || !to) problem = "Choose both dates.";
	else if (from < UI.dates.today()) problem = "Check-in can't be in the past.";
	else if (to <= from) problem = "Check-out needs to be after check-in.";
	$("map-error").textContent = problem;
	$("map-error").hidden = !problem;
	if (problem) return;
	state.checkIn = from;
	state.checkOut = to;
	load();
}

async function load() {
	$("floor-map").setAttribute("aria-busy", "true");
	try {
		const res = await fetch(`/rooms?checkIn=${state.checkIn}&checkOut=${state.checkOut}`);
		const data = await res.json();
		if (!res.ok) throw new Error(data.error);
		state.rooms = data;
		render();
	} catch (err) {
		console.error("Could not load rooms", err);
		$("floor-map").innerHTML = `
			<div class="empty-state" style="border:none">
				<h3 class="font-serif">We couldn't load the map.</h3>
				<p>Check your connection and try again.</p>
				<button type="button" class="btn-secondary" onclick="load()">Try again</button>
			</div>`;
	} finally {
		$("floor-map").removeAttribute("aria-busy");
	}
}

function render() {
	const rooms = state.rooms;
	const nights = UI.dates.nights(state.checkIn, state.checkOut);
	const fits = (r) => r.maxGuests >= state.guests;
	const free = rooms.filter((r) => r.freeForStay && fits(r)).length;
	$("map-summary").innerHTML = `<strong>${free} of ${rooms.length}</strong> rooms free for ${state.guests} ${state.guests === 1 ? "guest" : "guests"} · ${UI.dates.pretty(state.checkIn)} – ${UI.dates.pretty(state.checkOut)} (${nights} ${nights === 1 ? "night" : "nights"})`;

	const floors = [...new Set(rooms.map((r) => r.floor))].sort((a, b) => b - a);
	$("floor-map").innerHTML = floors
		.map((floor) => {
			const onFloor = rooms
				.filter((r) => r.floor === floor)
				.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
			const cheapest = Math.min(...onFloor.map((r) => r.price));
			const cells = onFloor
				.map((r) => {
					const status = r.freeForStay ? "free" : "taken";
					const label = `Room ${r.id}, ${r.type}, ${r.freeForStay ? "free" : "booked"} for your dates${fits(r) ? "" : ", too small for your party"}, ${UI.money(r.price)} a night`;
					return `<button type="button" class="room-cell ${status} ${fits(r) ? "" : "small"}" data-room="${UI.escape(r.id)}"
						aria-pressed="${state.selected === r.id}" aria-label="${UI.escape(label)}" tabindex="-1">
						${UI.escape(r.id)}<small>${r.freeForStay ? UI.money(r.price) : "Booked"}</small>
					</button>`;
				})
				.join("");
			return `
				<div class="floor-row">
					<div class="floor-label">
						<p class="kicker" style="text-align:right">Floor ${floor}</p>
						<p class="font-serif text-lg" style="color:#2C241B; text-align:right">${FLOOR_NAMES[floor] || ""}</p>
						<p style="font-size:12px; color:var(--lux-text-muted); text-align:right">from ${UI.money(cheapest)}</p>
					</div>
					<div class="floor-rooms" role="group" aria-label="Floor ${floor}">${cells}</div>
				</div>`;
		})
		.join("");

	// One tab stop for the whole map; arrow keys move around inside it
	const cells = [...document.querySelectorAll(".room-cell")];
	const start = cells.find((c) => c.dataset.room === state.selected) || cells[0];
	if (start) start.tabIndex = 0;
	cells.forEach((cell) => {
		cell.addEventListener("mouseenter", () => preview(cell.dataset.room));
		cell.addEventListener("focus", () => preview(cell.dataset.room));
		cell.addEventListener("click", () => select(cell.dataset.room));
		cell.addEventListener("keydown", moveFocus);
	});
	if (state.selected) preview(state.selected);
}

function moveFocus(e) {
	const keys = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: "up", ArrowDown: "down" };
	if (!(e.key in keys)) return;
	e.preventDefault();
	const rows = [...document.querySelectorAll(".floor-rooms")].map((row) => [...row.children]);
	const r = rows.findIndex((row) => row.includes(e.currentTarget));
	const c = rows[r].indexOf(e.currentTarget);
	let target;
	if (keys[e.key] === "up") target = rows[r - 1]?.[Math.min(c, rows[r - 1].length - 1)];
	else if (keys[e.key] === "down") target = rows[r + 1]?.[Math.min(c, rows[r + 1].length - 1)];
	else target = rows[r][c + keys[e.key]];
	if (!target) return;
	e.currentTarget.tabIndex = -1;
	target.tabIndex = 0;
	target.focus();
}

function select(roomId) {
	state.selected = roomId;
	document.querySelectorAll(".room-cell").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.room === roomId)));
	preview(roomId);
}

function preview(roomId) {
	const room = state.rooms.find((r) => r.id === roomId);
	const box = $("preview-content");
	if (!room) {
		box.innerHTML = `
			<p class="kicker mb-3">Room preview</p>
			<p class="font-serif italic" style="color:var(--lux-text-muted); font-size:17px">Pick a room on the map to see it here.</p>`;
		return;
	}
	const img = room.image ? room.image.replace("../frontend/", "/") : "";
	const params = new URLSearchParams({ room: room.id, checkIn: state.checkIn, checkOut: state.checkOut, guests: Math.min(state.guests, room.maxGuests) });
	const fits = room.maxGuests >= state.guests;
	const status = !room.freeForStay
		? `<p class="text-sm mb-4" style="color:var(--lux-danger)">Booked for these dates - try other dates or a room nearby.</p>`
		: !fits
			? `<p class="text-sm mb-4" style="color:var(--lux-danger)">Sleeps up to ${room.maxGuests} - too small for ${state.guests} guests.</p>`
			: `<p class="text-sm mb-4" style="color:var(--lux-success)">Free for your dates · ${UI.money(room.stayTotal)} for ${room.nights} ${room.nights === 1 ? "night" : "nights"}</p>`;
	box.innerHTML = `
		${img ? `<div class="preview-photo"><img src="${UI.escape(img)}" alt="" /></div>` : ""}
		<p class="font-serif text-3xl mb-1" style="color:#2C241B">Room ${UI.escape(room.id)}</p>
		<p class="meta-label mb-3">Floor ${room.floor} · ${UI.escape(room.type)} · up to ${room.maxGuests}</p>
		<p class="mb-3"><span class="font-serif text-3xl" style="color:#2C241B">${UI.money(room.price)}</span> <span class="meta-label">per night</span></p>
		${status}
		<a href="/pages/room.html?${params}" class="btn-primary block text-center">${room.freeForStay && fits ? "View & reserve" : "View room"}</a>`;
}
