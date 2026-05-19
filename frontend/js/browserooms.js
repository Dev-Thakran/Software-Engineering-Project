// ============================================================
//  browserrooms.js — Rooms & Suites page logic
// ============================================================

const ROOM_IMAGES = {
  "Standard Single": [
    "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&q=80",
    "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=600&q=80",
    "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600&q=80",
    "https://images.unsplash.com/photo-1566195992011-5f6b21e539aa?w=600&q=80",
    "https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=600&q=80",
    "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=600&q=80",
  ],
  "Deluxe Double": [
    "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=600&q=80",
    "https://images.unsplash.com/photo-1560185008-b033106af5c3?w=600&q=80",
    "https://images.unsplash.com/photo-1595576508898-0ad5c879a061?w=600&q=80",
    "https://images.unsplash.com/photo-1587985064135-0366536eab42?w=600&q=80",
    "https://images.unsplash.com/photo-1576354302919-96748cb8299e?w=600&q=80",
    "https://images.unsplash.com/photo-1540518614846-7eded433c457?w=600&q=80",
  ],
  "Executive Double": [
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&q=80",
    "https://images.unsplash.com/photo-1564078516393-cf04bd966897?w=600&q=80",
    "https://images.unsplash.com/photo-1572894046671-4a5f39e5d93f?w=600&q=80",
    "https://images.unsplash.com/photo-1629140727571-9b5c6f6267b4?w=600&q=80",
    "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=600&q=80",
    "https://images.unsplash.com/photo-1505693314120-0d443867891c?w=600&q=80",
  ],
  "Penthouse Suite": [
    "https://images.unsplash.com/photo-1631049421450-348ccd7f8949?w=600&q=80",
    "https://images.unsplash.com/photo-1602872030490-4a484a7b3ba6?w=600&q=80",
    "https://images.unsplash.com/photo-1613553507747-5f8d62ad5904?w=600&q=80",
    "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=600&q=80",
    "https://images.unsplash.com/photo-1600210492493-0946911123ea?w=600&q=80",
    "https://images.unsplash.com/photo-1591088398332-8a7791972843?w=600&q=80",
  ],
};

// Room metadata by type
const ROOM_META = {
  "Standard Single": { bed: "Queen", guests: 1, sqm: 28 },
  "Deluxe Double": { bed: "Queen", guests: 2, sqm: 38 },
  "Executive Double": { bed: "King", guests: 2, sqm: 48 },
  "Penthouse Suite": { bed: "King", guests: 4, sqm: 80 },
};

const FLOOR_NAMES = {
  1: "Garden",
  2: "Classic",
  3: "Executive",
  4: "Penthouse",
};

const ROOMS_URL =
  "https://raw.githubusercontent.com/Dev-Thakran/Software-Engineering-Project/main/backend/data/rooms.json";

let allRooms = [];
let maxPrice = 400;

// ── INIT ──
document.addEventListener("DOMContentLoaded", () => {
  fetch(ROOMS_URL)
    .then((res) => {
      if (!res.ok) throw new Error();
      return res.json();
    })
    .then((data) => {
      allRooms = data;
      applyFilters();
    })
    .catch(() => {
      fetch("../backend/data/rooms.json")
        .then((res) => res.json())
        .then((data) => {
          allRooms = data;
          applyFilters();
        })
        .catch(() => console.error("Could not load rooms.json"));
    });
});

// ── FILTERS ──
function updatePrice(val) {
  maxPrice = parseInt(val);
  document.getElementById("priceLabel").textContent =
    "$" + parseInt(val).toLocaleString();
}

function applyFilters() {
  const floor = document.getElementById("floorFilter").value;
  const sort = document.getElementById("sortFilter").value;
  const status = document.getElementById("statusFilter").value;

  let list = [...allRooms];
  if (floor !== "all") list = list.filter((r) => r.floor == floor);
  if (status === "available")
    list = list.filter((r) => r.status === "available");
  list = list.filter((r) => r.price <= maxPrice);
  if (sort === "price-asc") list.sort((a, b) => a.price - b.price);
  if (sort === "price-desc") list.sort((a, b) => b.price - a.price);

  render(list);
}

// ── RENDER ──
function render(list) {
  const grid = document.getElementById("roomsGrid");
  const empty = document.getElementById("emptyState");
  document.getElementById("roomCount").textContent = list.length + " ROOMS";

  if (list.length === 0) {
    grid.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  // Track image index per type so each room gets a different image
  const imgIndex = {};

  grid.innerHTML = list
    .map((room) => {
      const floorName = FLOOR_NAMES[room.floor] || "Floor " + room.floor;
      const meta = ROOM_META[room.type] || { bed: "Queen", guests: 2, sqm: 36 };
      const isAvail = room.status === "available";

      // Pick a unique image per room
      const images = ROOM_IMAGES[room.type] || ROOM_IMAGES["Standard Single"];
      imgIndex[room.type] = imgIndex[room.type] || 0;
      const img = room.image || images[imgIndex[room.type] % images.length];
      imgIndex[room.type]++;

      return `
            <div style="background:#fff;border:1px solid #E6DFD7;cursor:pointer;transition:box-shadow 0.3s;"
                 onmouseover="this.style.boxShadow='0 4px 24px rgba(44,36,27,0.10)'"
                 onmouseout="this.style.boxShadow='none'">

                <!-- Image -->
                <div style="position:relative;overflow:hidden;height:220px;">
                    <img src="${img}" alt="${room.type}"
                         style="width:100%;height:100%;object-fit:cover;display:block;transition:transform 1200ms ease-out;"
                         onmouseover="this.style.transform='scale(1.04)'"
                         onmouseout="this.style.transform='scale(1)'"
                         onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"/>
                    <div style="display:none;height:220px;width:100%;background:linear-gradient(135deg,#D4C4B0,#B89F89);align-items:center;justify-content:center;color:#FAF7F2;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;font-family:'Outfit',sans-serif;">
                        Room ${room.id}
                    </div>
                    <!-- Floor tag -->
                    <div style="position:absolute;top:0;left:0;background:#2C241B;color:#FAF7F2;font-family:'Outfit',sans-serif;font-size:9px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;padding:5px 10px;">
                        FLOOR ${room.floor}
                    </div>
                </div>

                <!-- Card body -->
                <div style="padding:18px 20px 20px;">
                    <!-- Type label + price row -->
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
                        <p style="font-family:'Outfit',sans-serif;font-size:10px;font-weight:500;letter-spacing:0.22em;text-transform:uppercase;color:#8B7355;">${floorName}</p>
                        <div style="text-align:right;">
                            <p style="font-family:'Cormorant Garamond',serif;font-size:22px;color:#2C241B;line-height:1;">\$${room.price}</p>
                            <p style="font-family:'Outfit',sans-serif;font-size:10px;color:#8B7355;letter-spacing:0.08em;">per night</p>
                        </div>
                    </div>

                    <!-- Room name -->
                    <p style="font-family:'Cormorant Garamond',serif;font-size:26px;color:#2C241B;font-weight:400;line-height:1.1;margin-bottom:14px;">
                        Room ${room.id}
                    </p>

                    <!-- Divider -->
                    <div style="border-top:1px solid #E6DFD7;margin-bottom:12px;"></div>

                    <!-- Meta row -->
                    <div style="display:flex;align-items:center;gap:16px;font-family:'Outfit',sans-serif;font-size:11px;color:#8B7355;">
                        <span>🛏 ${meta.bed}</span>
                        <span>👤 ${meta.guests}</span>
                        <span>⬜ ${meta.sqm}m²</span>
                        ${!isAvail ? `<span class="badge badge-${room.status}" style="margin-left:auto;">${room.status}</span>` : ""}
                        ${isAvail ? `<a href="./booking.html?room=${room.id}" class="btn-primary" style="margin-left:auto;padding:8px 16px;font-size:10px;">Reserve</a>` : ""}
                    </div>
                </div>
            </div>`;
    })
    .join("");
}
