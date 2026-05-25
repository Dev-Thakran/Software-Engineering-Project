document.addEventListener("DOMContentLoaded", async function () {

    // Get room ID from URL — supports ?room=101, ?roomId=101, ?id=101
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get("room") || params.get("roomId") || params.get("id");

    if (!roomId) {
        window.location.href = "./rooms.html";
        return;
    }

    // Floor tier names
    const FLOOR_NAMES = { 1: "Garden", 2: "Classic", 3: "Executive", 4: "Penthouse" };

    // Room metadata
    const ROOM_META = {
        "Standard Single":  { guests: 1, sqm: 28 },
        "Deluxe Double":    { guests: 2, sqm: 38 },
        "Executive Double": { guests: 2, sqm: 48 },
        "Penthouse Suite":  { guests: 4, sqm: 80 },
    };

    try {
        // Fetch room data, amenities and reviews in parallel
        // /reviews is the public endpoint added to server.js
        const [roomRes, amenRes, revRes] = await Promise.all([
            fetch(`/rooms/${roomId}`),
            fetch(`/rooms/${roomId}/amenities`),
            fetch(`/reviews`),
        ]);

        if (!roomRes.ok) throw new Error("Room not found");

        const room       = await roomRes.json();
        const amenities  = await amenRes.json();
        const allReviews = revRes.ok ? await revRes.json() : [];

        // Only show reviews for this specific room
        const reviews = Array.isArray(allReviews)
            ? allReviews.filter(r => r.roomId === roomId)
            : [];

        // Update page title
        document.title = `Room ${room.id} – La Extravaganza`;

        // Image — convert "../frontend/images/..." to "/images/..."
        const imgPath = room.image
            ? room.image.trim().replace("../frontend/", "/")
            : "";
        document.getElementById("room-image").src = imgPath;
        document.getElementById("room-image").alt = `Room ${room.id}`;

        // Floor label
        const floorName = FLOOR_NAMES[room.floor] || "Floor " + room.floor;
        document.getElementById("room-floor-label").textContent =
            `Floor ${room.floor} — ${floorName}`;

        // Room name
        document.getElementById("room-name").textContent = `Room ${room.id}`;

        // Meta
        const meta = ROOM_META[room.type] || { guests: 2, sqm: 36 };
        document.getElementById("room-guests").textContent = `Up to ${meta.guests}`;
        document.getElementById("room-sqm").textContent    = `${meta.sqm} m²`;

        // Description
        const descriptions = {
            "Standard Single":  `A garden room on floor ${room.floor}, appointed with ${amenities.length} thoughtful amenities.`,
            "Deluxe Double":    `A classic double on floor ${room.floor}, appointed with ${amenities.length} thoughtful amenities.`,
            "Executive Double": `A premium double on floor ${room.floor}, appointed with ${amenities.length} thoughtful amenities.`,
            "Penthouse Suite":  `Our finest suite on floor ${room.floor}, appointed with ${amenities.length} thoughtful amenities.`,
        };
        document.getElementById("room-description").textContent =
            descriptions[room.type] || room.description;

        // Price
        document.getElementById("room-price").textContent = `$${room.price}`;

        // Reserve button
        const reserveBtn = document.getElementById("reserve-btn");
        if (room.status === "available") {
            reserveBtn.href = `./bookingform.html?room=${room.id}`;
            reserveBtn.addEventListener("mouseover", () => {
                reserveBtn.style.background = "var(--lux-brown-900)";
            });
            reserveBtn.addEventListener("mouseout", () => {
                reserveBtn.style.background = "var(--lux-brown-800)";
            });
        } else {
            reserveBtn.textContent       = "Currently Unavailable";
            reserveBtn.style.background  = "var(--lux-brown-200)";
            reserveBtn.style.color       = "var(--lux-brown-500)";
            reserveBtn.style.cursor      = "default";
            reserveBtn.style.pointerEvents = "none";
        }

        // Amenities grid
        const amenGrid = document.getElementById("amenities-grid");
        if (amenities.length === 0) {
            amenGrid.innerHTML = `<p style="font-family:'Outfit',sans-serif; font-size:13px;
                                           color:var(--lux-brown-400);">No amenities listed.</p>`;
        } else {
            amenGrid.innerHTML = amenities.map(a => `
                <div class="amenity-item">
                    <span class="amenity-check">✓</span>
                    <span>${a}</span>
                </div>`).join("");
        }

        // Reviews
        const reviewsList = document.getElementById("reviews-list");
        if (reviews.length === 0) {
            reviewsList.innerHTML = `
                <p class="font-serif" style="font-size:18px; font-style:italic;
                                              color:var(--lux-brown-400);">
                    No reviews yet for this room — be the first.
                </p>`;
        } else {
            reviewsList.innerHTML = reviews.map(r => {
                const stars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);
                return `
                    <div class="review-item">
                        <p class="stars text-sm mb-2">${stars}</p>
                        <p class="font-serif text-xl mb-2"
                           style="color:var(--lux-brown-800);">"${r.title}"</p>
                        <p style="font-family:'Outfit',sans-serif; font-size:13px;
                                  color:var(--lux-brown-600); line-height:1.7; margin-bottom:8px;">
                            ${r.comment}
                        </p>
                        <p class="kicker" style="font-size:10px;">${r.guestName}</p>
                    </div>`;
            }).join("");
        }

    } catch (err) {
        console.error(err);
        document.querySelector("main").innerHTML = `
            <div style="padding:96px 48px; text-align:center;">
                <p class="font-serif text-4xl" style="color:var(--lux-brown-400);">
                    Room not found.
                </p>
                <a href="./rooms.html" class="btn-primary" style="margin-top:32px; display:inline-block;">
                    Back to rooms
                </a>
            </div>`;
    }
});