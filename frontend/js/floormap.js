document.addEventListener("DOMContentLoaded", async function () {
	// Fetch live room data from backend
	let roomData = [];
	try {
		const res = await fetch("/rooms");
		roomData = await res.json();
	} catch {
		console.error("Could not load rooms");
	}

	// Build the floors from the room data, top floor first: each floor lists
	// its rooms, its room type(s) and its cheapest nightly price
	const floors = [...new Set(roomData.map((r) => r.floor))]
		.sort((a, b) => b - a)
		.map((floor) => {
			const onFloor = roomData
				.filter((r) => r.floor === floor)
				.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
			return {
				floor,
				name: [...new Set(onFloor.map((r) => r.type))].join(" / "),
				price: "$" + Math.min(...onFloor.map((r) => r.price)),
				rooms: onFloor.map((r) => r.id),
			};
		});

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
                        <a href="/pages/room.html?room=${room.id}"
                           class="btn-primary"
                           style="display:block; text-align:center; padding:12px 20px; font-size:10px;">
                           Book this room
                        </a>
                    `;
			});

			// Click - select room and go to booking
			cell.addEventListener("click", () => {
				const room = getRoomDetails(roomId);
				if (!room) return;

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
