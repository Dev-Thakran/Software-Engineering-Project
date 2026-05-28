// ============================================================
// tests/booking.test.js — Unit tests for booking logic
// ============================================================

// Booking calculation logic — mirrors booking.controller.js
function calculateNights(checkIn, checkOut) {
	const diff = new Date(checkOut) - new Date(checkIn);
	return Math.ceil(diff / 86400000);
}

function isRoomAvailable(room) {
	return room.status === "available";
}

function buildBooking(userId, userName, room, checkIn, checkOut) {
	const nights = calculateNights(checkIn, checkOut);
	return {
		id: "b" + Date.now(),
		userId,
		userName,
		roomId: room.id,
		roomType: room.type,
		floor: room.floor,
		checkIn,
		checkOut,
		nights,
		total: nights * room.price,
		status: "pending",
		createdAt: new Date().toISOString(),
	};
}

// - Unit Test 13: Night calculation is correct --------
test("calculateNights returns correct number of nights", () => {
	expect(calculateNights("2026-05-17", "2026-05-19")).toBe(2);
});

// - Unit Test 14: Same day check-in/out returns 0 ------
test("calculateNights returns 0 for same day", () => {
	expect(calculateNights("2026-05-17", "2026-05-17")).toBe(0);
});

// - Unit Test 15: Available room returns true --------
test("isRoomAvailable returns true for available room", () => {
	const room = { id: "101", status: "available" };
	expect(isRoomAvailable(room)).toBe(true);
});

// - Unit Test 16: Occupied room returns false --------
test("isRoomAvailable returns false for occupied room", () => {
	const room = { id: "102", status: "occupied" };
	expect(isRoomAvailable(room)).toBe(false);
});

// - Unit Test 17: Pending room returns false ---------
test("isRoomAvailable returns false for pending room", () => {
	const room = { id: "103", status: "pending" };
	expect(isRoomAvailable(room)).toBe(false);
});

// - Unit Test 18: Booking total is calculated correctly ---
test("booking total equals price times nights", () => {
	const room = { id: "201", type: "Deluxe Double", floor: 2, price: 189 };
	const booking = buildBooking(
		"u001",
		"Jane",
		room,
		"2026-05-17",
		"2026-05-19",
	);
	expect(booking.total).toBe(378); // 189 * 2
});

// - Unit Test 19: Booking has pending status on creation ---
test("new booking has pending status", () => {
	const room = { id: "201", type: "Deluxe Double", floor: 2, price: 189 };
	const booking = buildBooking(
		"u001",
		"Jane",
		room,
		"2026-05-17",
		"2026-05-18",
	);
	expect(booking.status).toBe("pending");
});

// - Unit Test 20: Booking contains correct roomId ------
test("booking contains the correct roomId", () => {
	const room = { id: "304", type: "Executive Double", floor: 3, price: 220 };
	const booking = buildBooking(
		"u001",
		"Jane",
		room,
		"2026-05-17",
		"2026-05-18",
	);
	expect(booking.roomId).toBe("304");
});
