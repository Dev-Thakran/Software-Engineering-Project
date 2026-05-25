// Extra metadata per room type — bed size, guest count, room size
const ROOM_META = {
	"Standard Single": { bed: "Queen", guests: 1, sqm: 28 },
	"Deluxe Double": { bed: "Queen", guests: 2, sqm: 38 },
	"Executive Double": { bed: "King", guests: 2, sqm: 48 },
	"Penthouse Suite": { bed: "King", guests: 4, sqm: 80 },
};

// Floor tier names matching the design system
const FLOOR_NAMES = {
	1: "Garden",
	2: "Classic",
	3: "Executive",
	4: "Penthouse",
};

let allRooms = []; // Stores all rooms fetched from the backend
let maxPrice = 400; // Current max price filter value

//  INIT
document.addEventListener("DOMContentLoaded", () => {
	// Fetch rooms from the local Express backend
	// Uses the same /rooms endpoint as the rest of the app
	fetch("/rooms")
		.then((res) => {
			if (!res.ok) throw new Error("Failed to fetch rooms");
			return res.json();
		})
		.then((data) => {
			allRooms = data;
			applyFilters(); // Render all rooms immediately on load
		})
		.catch((err) => {
			console.error("Could not load rooms:", err);
			document.getElementById("roomsGrid").innerHTML = `
                <p style="color:#8B7355; font-family:'Outfit',sans-serif; font-size:13px;">
                    Could not load rooms. Is the server running?
                </p>`;
		});
});

//  PRICE SLIDER
function updatePrice(val) {
	// Called every time the price slider moves
	// Updates the displayed price label and the maxPrice variable
	maxPrice = parseInt(val);
	document.getElementById("priceLabel").textContent =
		parseInt(val).toLocaleString();
}

//  FILTERS
function applyFilters() {
	// Read current filter values from the DOM
	const floor = document.getElementById("floorFilter").value;
	const sort = document.getElementById("sortFilter").value;
	const status = document.getElementById("statusFilter").value;

	// Start with all rooms then apply each filter in sequence
	let list = [...allRooms];

	// Filter by floor if not set to "all"
	if (floor !== "all") list = list.filter((r) => r.floor == floor);

	// Filter by availability if set to "available"
	if (status === "available")
		list = list.filter((r) => r.status === "available");

	// Filter by max price from the slider
	list = list.filter((r) => r.price <= maxPrice);

	// Sort the filtered list
	if (sort === "price-asc") list.sort((a, b) => a.price - b.price);
	if (sort === "price-desc") list.sort((a, b) => b.price - a.price);
	// Default sort is floor low to high which is the natural order from the backend

	render(list);
}

//  RENDER
function render(list) {
	const grid = document.getElementById("roomsGrid");
	const empty = document.getElementById("emptyState");

	// Update room count display
	document.getElementById("roomCount").textContent = list.length + " ROOMS";

	if (list.length === 0) {
		grid.innerHTML = "";
		empty.classList.remove("hidden");
		return;
	}
	empty.classList.add("hidden");

	// Track image index per room type so each room gets a different photo
	const imgIndex = {};

	grid.innerHTML = list
		.map((room) => {
			const floorName = FLOOR_NAMES[room.floor] || "Floor " + room.floor;
			const meta = ROOM_META[room.type] || { bed: "Queen", guests: 2, sqm: 36 };
			const isAvail = room.status === "available";

			// Pick a unique image for this room based on its type
			// Use the image path from rooms.json directly
			// Convert the relative path from backend to a path the browser can access
			const img = room.image
				? room.image.replace("../frontend/", "/")
				: ROOM_IMAGES[room.type]?.[0] || ROOM_IMAGES["Standard Single"][0];

			// Status badge colour — only shown when room is not available
			const statusColors = {
				occupied: "background:#D4C4B0; color:#6B5743;",
				pending: "background:#E6DFD7; color:#6B5743;",
			};
			const badgeStyle = statusColors[room.status] || "";

			return `
            <div style="background:#FFFFFF; border:1px solid #E6DFD7; cursor:pointer; transition:box-shadow 0.3s;"
                 onmouseover="this.style.boxShadow='0 4px 24px rgba(44,36,27,0.10)'"
                 onmouseout="this.style.boxShadow='none'">
                 <a href="./room.html?room=${room.id}">

                <!-- Room image with hover zoom -->
                <div style="position:relative; overflow:hidden; height:220px;">
                    <img src="${img}" alt="${room.type}"
                         style="width:100%; height:100%; object-fit:cover; display:block; transition:transform 1200ms ease-out;"
                         onmouseover="this.style.transform='scale(1.04)'"
                         onmouseout="this.style.transform='scale(1)'"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                    <!-- Fallback shown if image fails to load -->
                    <div style="display:none; height:220px; width:100%; background:linear-gradient(135deg,#D4C4B0,#B89F89); align-items:center; justify-content:center; color:#FAF7F2; font-size:11px; letter-spacing:0.2em; text-transform:uppercase; font-family:'Outfit',sans-serif;">
                        Room ${room.id}
                    </div>
                    <!-- Floor tier tag in top left corner -->
                    <div style="position:absolute; top:0; left:0; background:#2C241B; color:#FAF7F2; font-family:'Outfit',sans-serif; font-size:9px; font-weight:600; letter-spacing:0.18em; text-transform:uppercase; padding:5px 10px;">
                        FLOOR ${room.floor}
                    </div>
                </div>

                <!-- Card body -->
                <div style="padding:18px 20px 20px;">

                    <!-- Tier name and price on same row -->
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
                        <p style="font-family:'Outfit',sans-serif; font-size:10px; font-weight:500; letter-spacing:0.22em; text-transform:uppercase; color:#8B7355;">
                            ${floorName}
                        </p>
                        <div style="text-align:right;">
                            <p style="font-family:'Cormorant Garamond',serif; font-size:22px; color:#2C241B; line-height:1;">
                                $${room.price}
                            </p>
                            <p style="font-family:'Outfit',sans-serif; font-size:10px; color:#8B7355; letter-spacing:0.08em;">
                                per night
                            </p>
                        </div>
                    </div>

                    <!-- Room number as main heading -->
                    <p style="font-family:'Cormorant Garamond',serif; font-size:26px; color:#2C241B; font-weight:400; line-height:1.1; margin-bottom:14px;">
                        Room ${room.id}
                    </p>

                    <!-- Divider -->
                    <div style="border-top:1px solid #E6DFD7; margin-bottom:12px;"></div>

                    <!-- Room metadata and action row -->
                    <div style="display:flex; align-items:center; gap:16px; font-family:'Outfit',sans-serif; font-size:11px; color:#8B7355;">
                        <span>🛏 ${meta.bed}</span>
                        <span>👤 ${meta.guests}</span>
                        <span>⬜ ${meta.sqm}m²</span>

                        <!-- Show status badge if not available -->
                        ${!isAvail
					? `
                            <span style="margin-left:auto; padding:4px 10px; font-size:10px; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; ${badgeStyle}">
                                ${room.status}
                            </span>`
					: ""
				}

                        <!-- Show Reserve button only if room is available -->
                        ${isAvail
					? `
                            <a href="./room.html?room=${room.id}"
                               class="btn-primary"
                               style="margin-left:auto; padding:8px 16px; font-size:10px;">
                                Reserve
                            </a>`
					: ""
				}
                    </div>
                </div>
                </a>
            </div>`;
		})
		.join("");
}