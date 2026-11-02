// ============================================================
//  manager-rooms.js - The manager's Rooms & prices page: change
//  one room's nightly price, or set a whole floor at once
// ============================================================

const FLOOR_NAMES = { 1: "Garden", 2: "Classic", 3: "Executive", 4: "Penthouse" };
const $ = (id) => document.getElementById(id);

let rooms = [];

document.addEventListener("DOMContentLoaded", () => {
	// Managers only - everyone else goes to their own home page
	const role = localStorage.getItem("role");
	if (!localStorage.getItem("token")) {
		location.href = `/pages/Login.html?redirect=${encodeURIComponent(location.pathname)}`;
		return;
	}
	if (role !== "manager") {
		location.href = role === "staff" ? "/pages/staff.html" : "/pages/index.html";
		return;
	}

	// One listener for every Save / Apply button and price box on the page
	$("floors").addEventListener("input", (e) => {
		if (e.target.matches("input[data-price]")) checkInput(e.target);
	});
	$("floors").addEventListener("click", (e) => {
		const roomBtn = e.target.closest("[data-save-room]");
		const floorBtn = e.target.closest("[data-save-floor]");
		if (roomBtn) saveRoom(roomBtn.dataset.saveRoom);
		if (floorBtn) saveFloor(Number(floorBtn.dataset.saveFloor));
	});
	// Enter in a price box saves it
	$("floors").addEventListener("keydown", (e) => {
		if (e.key !== "Enter" || !e.target.matches("input[data-price]")) return;
		e.preventDefault();
		e.target.closest("[data-row]")?.querySelector("button")?.click();
	});

	load();
});

async function load() {
	try {
		const res = await fetch("/rooms");
		if (!res.ok) throw new Error();
		rooms = await res.json();
		render();
	} catch {
		$("floors").innerHTML = `
			<div class="empty-state">
				<h3 class="font-serif">We couldn't load the rooms.</h3>
				<p>Check your connection and try again.</p>
				<button type="button" class="btn-secondary" onclick="load()">Try again</button>
			</div>`;
	} finally {
		$("floors").removeAttribute("aria-busy");
	}
}

// Whole dollars from $1 to $10,000 - the same rule the server uses
function parsePrice(text) {
	const value = String(text).trim();
	if (!/^\d+$/.test(value)) return null;
	const n = Number(value);
	return n >= 1 && n <= 10000 ? n : null;
}

// Enables the button next to a box only when it holds a new, valid price
function checkInput(input) {
	const row = input.closest("[data-row]");
	const price = parsePrice(input.value);
	const current = Number(input.dataset.current);
	const empty = input.value.trim() === "";
	const bad = !empty && price === null;
	row.querySelector(".price-input").classList.toggle("invalid", bad);
	input.setAttribute("aria-invalid", String(bad));
	row.querySelector(".field-error").textContent = bad ? "Use a whole number of dollars from $1 to $10,000." : "";
	row.querySelector("button").disabled = price === null || price === current;
}

function render() {
	const floors = [...new Set(rooms.map((r) => r.floor))].sort((a, b) => b - a);
	const prices = rooms.map((r) => r.price);
	$("price-summary").textContent = rooms.length
		? `${rooms.length} rooms · ${UI.money(Math.min(...prices))} to ${UI.money(Math.max(...prices))} a night`
		: "";

	$("floors").innerHTML = floors
		.map((floor) => {
			const onFloor = rooms
				.filter((r) => r.floor === floor)
				.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
			const low = Math.min(...onFloor.map((r) => r.price));
			const high = Math.max(...onFloor.map((r) => r.price));
			const range = low === high ? UI.money(low) : `${UI.money(low)} – ${UI.money(high)}`;
			return `
				<section class="floor-card" aria-labelledby="floor-${floor}-title">
					<div class="floor-head">
						<div>
							<p class="kicker" style="font-size:11px">Floor ${floor}</p>
							<h2 id="floor-${floor}-title" class="font-serif text-3xl" style="color:#2c241b">${FLOOR_NAMES[floor] || "Floor " + floor}</h2>
							<p class="text-sm" style="color:var(--lux-text-muted)">${onFloor.length} rooms · ${range} a night</p>
						</div>
						<div data-row>
							<div class="floor-set">
								<label for="floor-${floor}-price">Set every room on this floor to</label>
								<span class="price-input"><span>$</span><input id="floor-${floor}-price" data-price data-current="${onFloor.length && low === high ? low : ""}" inputmode="numeric" placeholder="${low}" autocomplete="off" /></span>
								<button type="button" class="btn-primary small-btn" data-save-floor="${floor}" disabled>Apply</button>
							</div>
							<p class="field-error mt-2" role="alert"></p>
						</div>
					</div>
					<div class="room-row head" aria-hidden="true">
						<p class="meta-label">Room</p><p class="meta-label">Type</p><p class="meta-label">Now</p><p class="meta-label" style="text-align:right">New price</p>
					</div>
					${onFloor.map(roomRow).join("")}
				</section>`;
		})
		.join("");
	UI.fillIcons();
}

function roomRow(room) {
	return `
		<div class="room-row" data-row data-room="${UI.escape(room.id)}">
			<p class="font-serif text-xl" style="color:#2c241b">Room ${UI.escape(room.id)}</p>
			<p class="type text-sm" style="color:var(--lux-text-muted)">${UI.escape(room.type)} · up to ${room.maxGuests}</p>
			<p class="now">${UI.money(room.price)}</p>
			<div class="room-edit">
				<span class="changed" data-changed hidden>${UI.icon("check")} Updated</span>
				<span class="price-input"><span>$</span><input data-price data-current="${room.price}" inputmode="numeric" placeholder="${room.price}" aria-label="New price for Room ${UI.escape(room.id)}" autocomplete="off" /></span>
				<button type="button" class="btn-primary small-btn" data-save-room="${UI.escape(room.id)}" disabled>Save</button>
			</div>
			<p class="field-error row-error" role="alert"></p>
		</div>`;
}

// Sends a price change; returns the server's reply or throws its message
async function patch(url, price) {
	const res = await fetch(url, {
		method: "PATCH",
		headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("token") },
		body: JSON.stringify({ price }),
	});
	const data = await res.json().catch(() => ({}));
	if (res.status === 401) {
		localStorage.clear();
		location.href = `/pages/Login.html?redirect=${encodeURIComponent(location.pathname)}`;
	}
	if (!res.ok) throw new Error(data.error || "We couldn't save the new price. Please try again.");
	return data;
}

async function saveRoom(id) {
	const room = rooms.find((r) => r.id === id);
	const row = document.querySelector(`[data-room="${CSS.escape(id)}"]`);
	const price = parsePrice(row.querySelector("input").value);
	if (!room || price === null || price === room.price) return;

	const updated = await UI.dialog({
		title: `Change Room ${room.id}'s price?`,
		body: `<p style="color:var(--lux-brown-600);line-height:1.7">
			<strong style="color:#2c241b">${UI.money(room.price)} → ${UI.money(price)}</strong> a night.<br />
			New bookings use the new price straight away; existing bookings keep theirs.</p>`,
		confirmLabel: "Change price",
		onConfirm: () => patch(`/rooms/${encodeURIComponent(id)}`, price),
	});
	if (!updated) return;

	Object.assign(room, updated);
	render();
	markChanged([id]);
	UI.toast(`Room ${id} is now ${UI.money(price)} a night`);
}

async function saveFloor(floor) {
	const onFloor = rooms.filter((r) => r.floor === floor);
	const input = document.getElementById(`floor-${floor}-price`);
	const price = parsePrice(input.value);
	if (!onFloor.length || price === null) return;
	const changing = onFloor.filter((r) => r.price !== price);
	if (!changing.length) return;

	const updated = await UI.dialog({
		title: `Change every room on Floor ${floor}?`,
		body: `<p style="color:var(--lux-brown-600);line-height:1.7">
			All <strong style="color:#2c241b">${onFloor.length} rooms</strong> on ${FLOOR_NAMES[floor] || "this floor"}
			will be <strong style="color:#2c241b">${UI.money(price)} a night</strong>
			(${changing.length} of them change).<br />
			New bookings use the new price straight away; existing bookings keep theirs.</p>`,
		confirmLabel: "Change prices",
		onConfirm: () => patch(`/rooms/floors/${floor}`, price),
	});
	if (!Array.isArray(updated)) return;

	updated.forEach((u) => Object.assign(rooms.find((r) => r.id === u.id) || {}, u));
	render();
	markChanged(changing.map((r) => r.id));
	UI.toast(`Every room on Floor ${floor} is now ${UI.money(price)} a night`);
}

// Shows a short "Updated" tick on the rooms that just changed
function markChanged(ids) {
	ids.forEach((id) => {
		const tick = document.querySelector(`[data-room="${CSS.escape(id)}"] [data-changed]`);
		if (!tick) return;
		tick.hidden = false;
		setTimeout(() => (tick.hidden = true), 6000);
	});
}
