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
	party: { adults: 0, children: 0 }, // adults 0 = any party size
	accessible: false, // only rooms with accessible bathrooms and fittings
	promo: "", // a promo code carried from the home page to the booking form
};

const $ = (id) => document.getElementById(id);
// Everyone counts toward a room's limit; "Any" adults means no filter
const partySize = () => (state.party.adults ? UI.party.total(state.party) : 0);

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
	const from = params.get("checkIn");
	const to = params.get("checkOut");
	// Past, reversed or impossible dates in a link are ignored rather than searched
	if (dates.valid(from) && dates.valid(to) && !stayError(from, to)) {
		state.checkIn = from;
		state.checkOut = to;
	}
	state.party = UI.party.fromParams(params, { adults: 0, children: 0 });
	if (/^[1-4]$/.test(params.get("floor") || "")) state.floor = params.get("floor");
	state.accessible = params.get("accessible") === "1";
	if (/^[A-Za-z0-9]{1,20}$/.test(params.get("promo") || "")) state.promo = params.get("promo").toUpperCase();

	$("checkIn").value = state.checkIn;
	$("checkOut").value = state.checkOut;
	UI.party.fillSelects($("adults"), $("children"), state.party, { anyAdults: true });
}

function writeAddressBar() {
	const params = new URLSearchParams();
	if (state.checkIn) {
		params.set("checkIn", state.checkIn);
		params.set("checkOut", state.checkOut);
	}
	if (state.party.adults) UI.party.toParams(params, state.party);
	if (state.floor !== "all") params.set("floor", state.floor);
	if (state.accessible) params.set("accessible", "1");
	if (state.promo) params.set("promo", state.promo);
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

	const readParty = () => {
		state.party = { adults: Number($("adults").value), children: Number($("children").value) };
		// Children need an adult with them
		if (!state.party.adults && state.party.children) {
			state.party.adults = 1;
			$("adults").value = "1";
		}
	};
	[$("adults"), $("children")].forEach((el) =>
		el.addEventListener("change", () => {
			readParty();
			writeAddressBar();
			render();
		}),
	);

	$("stay-form").addEventListener("submit", (e) => {
		e.preventDefault();
		const error = stayError(checkIn.value, checkOut.value);
		showStayError(error);
		if (error) return;
		state.checkIn = checkIn.value;
		state.checkOut = checkOut.value;
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
	$("accessible-chip").addEventListener("click", () => {
		state.accessible = !state.accessible;
		writeAddressBar();
		render();
	});

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
		state.accessible = false;
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
	let list = state.rooms.filter((r) => r.maxGuests >= partySize());
	if (state.checkIn) list = list.filter((r) => r.freeForStay);
	if (state.floor !== "all") list = list.filter((r) => r.floor == state.floor);
	if (state.accessible) list = list.filter((r) => r.accessible);
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
	$("accessible-chip").setAttribute("aria-pressed", String(state.accessible));
	const filtered =
		state.accessible ||
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
	const guests = state.party.adults ? ` for ${UI.party.label(state.party)}` : "";
	const promo = state.promo ? ` <span class="promo-tag">${UI.escape(state.promo)} applied at checkout</span>` : "";
	if (!state.checkIn) return `<strong>${rooms}</strong>${guests}. Add your dates to see what's free.${promo}`;
	const nights = UI.dates.nights(state.checkIn, state.checkOut);
	return `<strong>${rooms} free</strong>${guests}, ${UI.dates.pretty(state.checkIn)} to ${UI.dates.pretty(state.checkOut)} · ${nights} ${nights === 1 ? "night" : "nights"}${promo}`;
}

function emptyState(filtered) {
	// Say so when it's the party size, not availability, that rules rooms out
	const fitsSomewhere = state.rooms.some((r) => r.maxGuests >= partySize() && (state.floor === "all" || r.floor == state.floor));
	const advice = !fitsSomewhere
		? `No rooms ${state.floor === "all" ? "" : "on this floor "}sleep ${UI.party.label(state.party)} - children count toward a room's limit. Our Penthouse suites sleep 4.`
		: state.checkIn
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
	const tier = room.tier || {};
	const img = room.image ? room.image.replace("../frontend/", "/") : "";

	// Carry the search through so the room page opens with the dates filled in
	const params = new URLSearchParams({ room: room.id });
	if (state.checkIn) {
		params.set("checkIn", state.checkIn);
		params.set("checkOut", state.checkOut);
	}
	if (state.party.adults) UI.party.toParams(params, state.party);
	if (state.promo) params.set("promo", state.promo);

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
				${room.accessible ? `<span class="room-card-tag access">${UI.icon("access")} Accessible</span>` : ""}
				${state.checkIn ? `<span class="room-card-tag right">Free for your dates</span>` : ""}
			</div>
			<div class="room-card-body">
				<p class="kicker" style="font-size:11px">${floorName}</p>
				<h2 class="font-serif mt-1" style="font-size:26px; color:#2C241B; line-height:1.15">
					Room ${UI.escape(room.id)}
				</h2>
				<p class="mb-3" style="font-size:13px; color:var(--lux-text-muted)">${UI.escape(room.type)}${tier.view ? ` · ${UI.escape(tier.view)}` : ""}</p>
				<div class="room-card-meta mb-4">
					${tier.bed ? `<span>${UI.icon("bed")}${UI.escape(tier.bed)}</span>` : ""}
					<span>${UI.icon("guests")}Up to ${room.maxGuests}</span>
					${tier.sizeSqm ? `<span>${UI.icon("area")}${tier.sizeSqm} m²</span>` : ""}
				</div>
				<div class="room-card-foot">
					<div>${price}</div>
					<span class="room-card-cta">${state.checkIn ? "Reserve" : "View room"} ${UI.icon("arrow")}</span>
				</div>
			</div>
		</a>`;
}
