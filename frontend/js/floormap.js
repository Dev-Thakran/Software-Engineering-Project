document.addEventListener("DOMContentLoaded", async function () {
	// Floor definitions matching your 4-floor hotel
	const floors = [
		{
			floor: 4,
			name: "Penthouse Suite",
			price: "$380",
			rooms: ["401", "402", "403", "404", "405", "406"],
		},
		{
			floor: 3,
			name: "Executive Double",
			price: "$220",
			rooms: ["301", "302", "303", "304", "305", "306"],
		},
		{
			floor: 2,
			name: "Deluxe Double",
			price: "$189",
			rooms: ["201", "202", "203", "204", "205", "206"],
		},
		{
			floor: 1,
			name: "Standard Single",
			price: "$99",
			rooms: ["101", "102", "103", "104", "105", "106"],
		},
	];

	// Fetch live room data from backend
	let roomData = [];
	try {
		const res = await fetch("/rooms");
		roomData = await res.json();
	} catch {
		console.error("Could not load rooms");
	}

	function getRoomStatus(roomId) {
		const room = roomData.find((r) => r.id === roomId);
		return room ? room.status : "available";
	}

	function getRoomDetails(roomId) {
		return roomData.find((r) => r.id === roomId);
	}

	// Build floor map
	const map = document.getElementById("floor-map");

	floors.forEach((f) => {
		const row = document.createElement("div");
		row.className = "floor-row";

		// Floor label
		row.innerHTML = `
                <div class="floor-label">
                    <p class="kicker" style="text-align:right;">Floor ${f.floor}</p>
                    <p class="font-serif text-lg" style="color:#2C241B; text-align:right;">${f.name}</p>
                    <p style="font-size:11px; color:#B89F89; text-align:right;">from ${f.price}</p>
                </div>
            `;

		// Room cells
		const roomsDiv = document.createElement("div");
		roomsDiv.className = "floor-rooms";

		f.rooms.forEach((roomId) => {
			const status = getRoomStatus(roomId);
			const cell = document.createElement("div");
			cell.className = `room-cell ${status}`;
			cell.textContent = roomId;

			// Hover - show preview
			cell.addEventListener("mouseenter", () => {
				const room = getRoomDetails(roomId);
				const preview = document.getElementById("preview-content");
				if (!room) return;

				const statusColor =
					{
						available: "#4A3B32",
						occupied: "#9A826A",
						pending: "#B89F89",
					}[room.status] || "#4A3B32";

				preview.innerHTML = `
                        <p class="font-serif text-2xl mb-1" style="color:#2C241B;">Room ${room.id}</p>
                        <p class="meta-label mb-3">Floor ${room.floor} · ${room.type}</p>
                        <p class="font-serif text-3xl mb-1" style="color:#2C241B;">$${room.price}</p>
                        <p class="meta-label mb-4">per night</p>
                        <p class="text-sm mb-4" style="color:#6B5743;">${room.description}</p>
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:16px;">
                            <span style="width:8px;height:8px;border-radius:50%;background:${statusColor};display:inline-block;"></span>
                            <span class="meta-label">${room.status}</span>
                        </div>
                        ${
													room.status === "available"
														? `<a href="/pages/room.html?room=${room.id}"
                                  class="btn-primary"
                                  style="display:block; text-align:center; padding:12px 20px; font-size:10px;">
                                  Book this room
                               </a>`
														: `<p class="meta-label" style="color:#B89F89;">Not available for booking</p>`
												}
                    `;
			});

			// Click - select room and go to booking
			cell.addEventListener("click", () => {
				const room = getRoomDetails(roomId);
				if (!room || room.status !== "available") return;

				// Deselect all
				document.querySelectorAll(".room-cell.selected").forEach((c) => {
					const cId = c.textContent;
					const cStatus = getRoomStatus(cId);
					c.className = `room-cell ${cStatus}`;
				});

				cell.className = "room-cell selected";
				window.location.href = `/pages/room.html?room=${roomId}`;
			});

			roomsDiv.appendChild(cell);
		});

		row.appendChild(roomsDiv);
		map.appendChild(row);
	});
});
