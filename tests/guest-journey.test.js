// ============================================================
// tests/guest-journey.test.js — Date search on rooms, booked dates
// per room, guests cancelling their own bookings, and reviews
// ============================================================

const { writeData, readData } = require("./helpers/temp-data");
const app = require("../backend/server");
const http = require("http");
const axios = require("axios");
const jwt = require("jsonwebtoken");

let server;
let BASE;

beforeAll((done) => {
	server = http.createServer(app);
	server.listen(0, () => {
		BASE = `http://localhost:${server.address().port}`;
		done();
	});
});
afterAll((done) => {
	server.close(done);
});

function api(token) {
	return axios.create({
		baseURL: BASE,
		validateStatus: () => true,
		timeout: 10000,
		headers: token ? { Authorization: `Bearer ${token}` } : {},
	});
}

function inDays(days) {
	const d = new Date();
	d.setDate(d.getDate() + days);
	return d.toLocaleDateString("en-CA");
}

async function login(email) {
	const res = await api().post("/auth/login", { email, password: "password" });
	return { token: res.data.token, id: jwt.decode(res.data.token).id };
}

let jane;
let lily;
beforeAll(async () => {
	jane = await login("jane@email.com");
	lily = await login("lily.evans@example.com");
});

function booking(id, userId, roomId, checkIn, checkOut, status = "booked") {
	return {
		id, userId, userName: "Test Guest", roomId, roomType: "Deluxe Double", floor: 2,
		checkIn, checkOut, nights: 2, total: 378, status, createdAt: new Date().toISOString(),
	};
}

beforeEach(() => {
	writeData("checkins.json", []);
	writeData("bookings.json", [
		booking("bFuture", jane.id, "201", inDays(10), inDays(12)),
		booking("bToday", jane.id, "202", inDays(0), inDays(2)),
		booking("bDone", jane.id, "203", inDays(-5), inDays(-3), "completed"),
		booking("bOld", jane.id, "204", inDays(-20), inDays(-18), "booked"),
	]);
});

// - Date search ---------------------------------------------
test("rooms list marks which rooms are free for a stay and prices it", async () => {
	const res = await api().get(`/rooms?checkIn=${inDays(11)}&checkOut=${inDays(14)}`);
	expect(res.status).toBe(200);
	const r201 = res.data.find((r) => r.id === "201");
	const r101 = res.data.find((r) => r.id === "101");
	expect(r201.freeForStay).toBe(false);
	expect(r101.freeForStay).toBe(true);
	expect(r101.nights).toBe(3);
	expect(r101.stayTotal).toBe(3 * r101.price);
});

test("rooms list filters by guest count", async () => {
	const res = await api().get("/rooms?guests=3");
	expect(res.data.length).toBeGreaterThan(0);
	expect(res.data.every((r) => r.maxGuests >= 3)).toBe(true);
});

test("rooms list rejects invalid stay dates", async () => {
	const res = await api().get(`/rooms?checkIn=${inDays(5)}&checkOut=${inDays(5)}`);
	expect(res.status).toBe(400);
});

// - Booked dates ----------------------------------------------
test("booked dates for a room list date ranges only, no guest details", async () => {
	const res = await api().get("/rooms/201/booked");
	expect(res.status).toBe(200);
	expect(res.data).toEqual([{ checkIn: inDays(10), checkOut: inDays(12) }]);
});

// - Guest cancellations ---------------------------------------
test("a guest can cancel their own upcoming booking", async () => {
	const res = await api(jane.token).patch("/bookings/bFuture", { status: "cancelled" });
	expect(res.status).toBe(200);
	expect(res.data.status).toBe("cancelled");
});

test("a guest can't cancel someone else's booking", async () => {
	const res = await api(lily.token).patch("/bookings/bFuture", { status: "cancelled" });
	expect(res.status).toBe(404);
	expect(readData("bookings.json")[0].status).toBe("booked");
});

test("a guest can't cancel on the day of arrival", async () => {
	const res = await api(jane.token).patch("/bookings/bToday", { status: "cancelled" });
	expect(res.status).toBe(409);
});

// - Reviews -----------------------------------------------------
test("a guest can review a finished stay once", async () => {
	const first = await api(jane.token).post("/reviews", {
		bookingId: "bDone", rating: 5, title: "Lovely", comment: "Quiet room, great breakfast.",
	});
	expect(first.status).toBe(201);
	expect(first.data.roomId).toBe("203");
	expect(readData("bookings.json").find((b) => b.id === "bDone").reviewed).toBe(true);

	const again = await api(jane.token).post("/reviews", {
		bookingId: "bDone", rating: 4, comment: "Second go",
	});
	expect(again.status).toBe(409);

	const list = await api().get("/reviews?roomId=203");
	expect(list.data.some((r) => r.bookingId === "bDone")).toBe(true);
});

test("reviews are refused before checkout, for others' stays, and without a rating", async () => {
	const early = await api(jane.token).post("/reviews", { bookingId: "bFuture", rating: 5, comment: "x" });
	expect(early.status).toBe(409);
	const notMine = await api(lily.token).post("/reviews", { bookingId: "bDone", rating: 5, comment: "x" });
	expect(notMine.status).toBe(404);
	const noRating = await api(jane.token).post("/reviews", { bookingId: "bDone", comment: "x" });
	expect(noRating.status).toBe(400);
});

// - 404 page ------------------------------------------------------
test("unknown pages get the branded 404 page with a 404 status", async () => {
	const res = await api().get("/no-such-page");
	expect(res.status).toBe(404);
	expect(res.data).toContain("Page not found");
	const home = await api().get("/");
	expect(home.status).toBe(200);
});
