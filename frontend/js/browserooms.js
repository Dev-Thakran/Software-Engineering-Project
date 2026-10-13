// Extra details per room type - bed size and room size
const ROOM_META = {
	"Standard Single": { bed: "Queen bed", sqm: 28 },
	"Deluxe Double": { bed: "Queen bed", sqm: 38 },
	"Executive Double": { bed: "King bed", sqm: 48 },
	"Penthouse Suite": { bed: "King bed", sqm: 80 },
};

// Floor tier names matching the design system
const FLOOR_NAMES = {
	1: "Garden",
	2: "Classic",
	3: "Executive",
	4: "Penthouse",
};

const state = {
	rooms: [], // rooms from the server (with stay prices when dates are set)
	floor: "all",
	maxPrice: Infinity,
	sort: "default",
	checkIn: "",
	checkOut: "",
	guests: 0, // 0 = any party size
};

const $ = (id) => document.getElementById(id);

//  INIT
document.addEventListener("DOMContentLoaded", () => {
	readAddressBar();
	setUpSearch();
	setUpFilters();
	loadRooms();
});

// The search can arrive from the home page: ?checkIn=…&checkOut=…&guests=2&floor=3
function readAddressBar() {
	const params = new URLSearchParams(location.search);
	const { dates } = UI;
	if (dates.valid(params.get("checkIn")) && dates.valid(params.get("checkOut"))) {
		state.checkIn = params.get("checkIn");
		state.checkOut = params.get("checkOut");
	}
	if (/^[1-4]$/.test(params.get("guests") || "")) state.guests = Number(params.get("guests"));
	if (/^[1-4]$/.test(params.get("floor") || "")) state.floor = params.get("floor");

	$("checkIn").value = state.checkIn;
	$("checkOut").value = state.checkOut;
	$("guests").value = String(state.guests);
}

function writeAddressBar() {
	const params = new URLSearchParams();
	if (state.checkIn) {
		params.set("checkIn", state.checkIn);
		params.set("checkOut", state.checkOut);
	}
	if (state.guests) params.set("guests", state.guests);
	if (state.floor !== "all") params.set("floor", state.floor);
	const query = params.toString();
	history.replaceState(null, "", location.pathname + (query ? "?" + query : ""));
}

//  STAY SEARCH
function setUpSearch() {
	const today = UI.dates.today();
	const checkIn = $("checkIn");
	const checkOut = $("checkOut");
	checkIn.min = today;
	checkOut.min = UI.dates.addDays(today, 1);

	// Picking a check-in moves check-out along so it is always at least a night later
	checkIn.addEventListener("change", () => {
		if (!checkIn.value) return;
		const earliest = UI.dates.addDays(checkIn.value, 1);
		checkOut.min = earliest;
		if (!checkOut.value || checkOut.value < earliest) checkOut.value = earliest;
	});

	$("guests").addEventListener("change", () => {
		state.guests = Number($("guests").value);
		writeAddressBar();
		render();
	});

	$("stay-form").addEventListener("submit", (e) => {
		e.preventDefault();
		const error = stayError(checkIn.value, checkOut.value);
		showStayError(error);
		if (error) return;
		state.checkIn = checkIn.value;
		state.checkOut = checkOut.value;
		state.guests = Number($("guests").value);
		writeAddressBar();
		loadRooms();
	});
}

function stayError(from, to) {
	if (!from && !to) return null; // no dates = browse everything
	if (!from || !to) return "Choose both a check-in and a check-out date.";
	if (from < UI.dates.today()) return "Check-in can't be in the past.";
	if (to <= from) return "Check-out needs to be at least one night after check-in.";
	return null;
}

function showStayError(message) {
	const el = $("stay-error");
	el.textContent = message || "";
	el.hidden = !message;
	$("checkIn").setAttribute("aria-invalid", String(Boolean(message)));
	$("checkOut").setAttribute("aria-invalid", String(Boolean(message)));
}

//  FILTERS
function setUpFilters() {
	$("floor-chips").addEventListener("click", (e) => {
		const chip = e.target.closest("[data-floor]");
		if (!chip) return;
		state.floor = chip.dataset.floor;
		writeAddressBar();
		render();
	});

	$("priceFilter").addEventListener("input", (e) => {
		state.maxPrice = Number(e.target.value);
		$("priceLabel").textContent = e.target.value;
		render();
	});

	$("sortFilter").addEventListener("change", (e) => {
		state.sort = e.target.value;
		render();
	});

	$("clear-filters").addEventListener("click", () => {
		state.floor = "all";
		state.sort = "default";
		$("sortFilter").value = "default";
		resetPrice();
		writeAddressBar();
		render();
	});
}

function resetPrice() {
	const slider = $("priceFilter");
	slider.value = slider.max;
	state.maxPrice = Number(slider.max);
	$("priceLabel").textContent = slider.max;
}

// Sets the slider's range from the cheapest and most expensive rooms
function setPriceRange(rooms) {
	if (!rooms.length) return;
	const prices = rooms.map((r) => r.price);
	const slider = $("priceFilter");
	const keep = state.maxPrice !== Infinity && Number(slider.value) < Number(slider.max);
	slider.min = Math.min(...prices);
	slider.max = Math.max(...prices);
	if (!keep) resetPrice();
}

//  LOAD
async function loadRooms() {
	const grid = $("roomsGrid");
	grid.setAttribute("aria-busy", "true");
	grid.innerHTML = UI.skeleton(
		6,
		`<div class="skeleton-card" aria-hidden="true">
			<div class="skeleton" style="aspect-ratio:16/10"></div>
			<div style="padding:18px 20px 20px">
				<div class="skeleton skeleton-line" style="width:40%"></div>
				<div class="skeleton skeleton-line" style="width:65%;height:20px"></div>
				<div class="skeleton skeleton-line" style="width:80%"></div>
			</div>
		</div>`,
	);

	const query = state.checkIn ? `?checkIn=${state.checkIn}&checkOut=${state.checkOut}` : "";
	try {
		const res = await fetch("/rooms" + query);
		const data = await res.json();
		if (!res.ok) throw new Error(data.error || "Could not load rooms");
		state.rooms = data;
		setPriceRange(data);
		render();
	} catch (err) {
		console.error("Could not load rooms:", err);
		grid.removeAttribute("aria-busy");
		grid.innerHTML = `
			<div class="empty-state sm:col-span-2 lg:col-span-3">
				<h3 class="font-serif">We couldn't load the rooms.</h3>
				<p>${UI.escape(err.message)}. Check your connection and try again.</p>
				<button type="button" class="btn-secondary" onclick="loadRooms()">Try again</button>
			</div>`;
	}
}

//  FILTER + SORT
function visibleRooms() {
	let list = state.rooms.filter((r) => r.maxGuests >= state.guests);
	if (state.checkIn) list = list.filter((r) => r.freeForStay);
	if (state.floor !== "all") list = list.filter((r) => r.floor == state.floor);
	list = list.filter((r) => r.price <= state.maxPrice);

	if (state.sort === "price-asc") list.sort((a, b) => a.price - b.price);
	if (state.sort === "price-desc") list.sort((a, b) => b.price - a.price);
	if (state.sort === "floor-desc") list.sort((a, b) => b.floor - a.floor);
	return list;
}

//  RENDER
function render() {
	const grid = $("roomsGrid");
	const list = visibleRooms();
	grid.removeAttribute("aria-busy");

	document.querySelectorAll("#floor-chips [data-floor]").forEach((chip) => {
		chip.setAttribute("aria-pressed", String(chip.dataset.floor === state.floor));
	});
	const filtered =
		state.floor !== "all" ||
		state.sort !== "default" ||
		state.maxPrice < Number($("priceFilter").max);
	$("clear-filters").hidden = !filtered;

	$("roomCount").innerHTML = summaryText(list.length);

	if (list.length === 0) {
		grid.innerHTML = emptyState(filtered);
		return;
	}

	grid.innerHTML = list.map(cardHtml).join("");
}

function summaryText(count) {
	const rooms = `${count} ${count === 1 ? "room" : "rooms"}`;
	const guests = state.guests ? ` for ${state.guests} ${state.guests === 1 ? "guest" : "guests"}` : "";
	if (!state.checkIn) return `<strong>${rooms}</strong>${guests}. Add your dates to see what's free.`;
	const nights = UI.dates.nights(state.checkIn, state.checkOut);
	return `<strong>${rooms} free</strong>${guests}, ${UI.dates.pretty(state.checkIn)} to ${UI.dates.pretty(state.checkOut)} · ${nights} ${nights === 1 ? "night" : "nights"}`;
}

function emptyState(filtered) {
	const advice = state.checkIn
		? "Everything that suits is taken for those dates. Try moving your stay by a day or two."
		: "Nothing matches these filters.";
	return `
		<div class="empty-state sm:col-span-2 lg:col-span-3">
			<h3 class="font-serif">No rooms to show</h3>
			<p>${advice}</p>
			${filtered ? `<button type="button" class="btn-secondary" onclick="document.getElementById('clear-filters').click()">Clear filters</button>` : ""}
		</div>`;
}

function cardHtml(room) {
	const floorName = FLOOR_NAMES[room.floor] || "Floor " + room.floor;
	const meta = ROOM_META[room.type] || { bed: "Queen bed", sqm: 36 };
	const img = room.image ? room.image.replace("../frontend/", "/") : "";

	// Carry the search through so the room page opens with the dates filled in
	const params = new URLSearchParams({ room: room.id });
	if (state.checkIn) {
		params.set("checkIn", state.checkIn);
		params.set("checkOut", state.checkOut);
	}
	if (state.guests) params.set("guests", state.guests);

	const price = state.checkIn
		? `<p class="price-big">${UI.money(room.stayTotal)}</p>
		   <p class="price-note">${room.nights} ${room.nights === 1 ? "night" : "nights"} · ${UI.money(room.price)}/night</p>`
		: `<p class="price-big">${UI.money(room.price)}</p>
		   <p class="price-note">per night</p>`;

	return `
		<a class="room-card" href="./room.html?${params}" aria-label="Room ${UI.escape(room.id)}, ${UI.escape(room.type)}, ${UI.money(room.price)} a night">
			<div class="room-card-photo">
				${img ? `<img src="${UI.escape(img)}" alt="" loading="lazy" onerror="this.remove()" />` : ""}
				<span class="room-card-tag left">Floor ${room.floor}</span>
				${state.checkIn ? `<span class="room-card-tag right">Free for your dates</span>` : ""}
			</div>
			<div class="room-card-body">
				<p class="kicker" style="font-size:11px">${floorName}</p>
				<h2 class="font-serif mt-1" style="font-size:26px; color:#2C241B; line-height:1.15">
					Room ${UI.escape(room.id)}
				</h2>
				<p class="mb-3" style="font-size:13px; color:var(--lux-text-muted)">${UI.escape(room.type)}</p>
				<div class="room-card-meta mb-4">
					<span>${UI.icon("bed")}${meta.bed}</span>
					<span>${UI.icon("guests")}Up to ${room.maxGuests}</span>
					<span>${UI.icon("area")}${meta.sqm} m²</span>
				</div>
				<div class="room-card-foot">
					<div>${price}</div>
					<span class="room-card-cta">${state.checkIn ? "Reserve" : "View room"} ${UI.icon("arrow")}</span>
				</div>
			</div>
		</a>`;
}
