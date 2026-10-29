// ============================================================
// tests/manage-booking.test.js — Guests changing their dates,
// forgotten passwords, and agreeing to the terms at sign-up
// ============================================================

const { writeData, readData } = require("./helpers/temp-data");
const app = require("../backend/server");
const http = require("http");
const axios = require("axios");
const jwt = require("jsonwebtoken");

let server;
let BASE;
const originalUsers = readData("users.json");
const originalRooms = readData("rooms.json");

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

async function login(email, password = "password") {
	const res = await api().post("/auth/login", { email, password });
	return { token: res.data.token, id: res.data.token && jwt.decode(res.data.token).id, status: res.status };
}

function booking(id, userId, roomId, checkIn, checkOut, extra = {}) {
	return {
		id, userId, userName: "Test", roomId, roomType: "Deluxe Double", floor: 2,
		checkIn, checkOut, nights: 2, total: 378, status: "booked", createdAt: new Date().toISOString(), ...extra,
	};
}

let jane;
let lily;
beforeAll(async () => {
	jane = await login("jane@email.com");
	lily = await login("lily.evans@example.com");
});

beforeEach(() => {
	writeData("users.json", originalUsers);
	writeData("rooms.json", originalRooms);
	writeData("checkins.json", []);
	writeData("bookings.json", [
		booking("bMine", jane.id, "201", inDays(10), inDays(12)),
		booking("bOther", lily.id, "201", inDays(20), inDays(22)),
		booking("bToday", jane.id, "202", inDays(0), inDays(2)),
		booking("bPromo", jane.id, "203", inDays(30), inDays(32), {
			total: 340, fullPrice: 378, discount: 38, promoCode: "EXPO2026", promoPercent: 10,
		}),
	]);
});

// - Changing dates ------------------------------------------
test("a guest can move their own booking and the stay is re-priced", async () => {
	const res = await api(jane.token).patch("/bookings/bMine/dates", { checkIn: inDays(11), checkOut: inDays(14) });
	expect(res.status).toBe(200);
	expect(res.data.booking.nights).toBe(3);
	expect(res.data.booking.total).toBe(3 * 189);
	expect(res.data.difference).toBe(3 * 189 - 378);
	const saved = readData("bookings.json").find((b) => b.id === "bMine");
	expect(saved.checkIn).toBe(inDays(11));
	expect(saved.changes).toHaveLength(1);
	expect(saved.changes[0].from).toEqual({ checkIn: inDays(10), checkOut: inDays(12), total: 378 });
});

test("moving over your own old dates is allowed, but not over someone else's", async () => {
	const overlapOwn = await api(jane.token).patch("/bookings/bMine/dates", { checkIn: inDays(9), checkOut: inDays(11) });
	expect(overlapOwn.status).toBe(200);
	const clash = await api(jane.token).patch("/bookings/bMine/dates", { checkIn: inDays(19), checkOut: inDays(21) });
	expect(clash.status).toBe(409);
});

test("guests can't change other people's bookings, same-day stays or bad dates", async () => {
	expect((await api(lily.token).patch("/bookings/bMine/dates", { checkIn: inDays(11), checkOut: inDays(13) })).status).toBe(404);
	expect((await api(jane.token).patch("/bookings/bToday/dates", { checkIn: inDays(3), checkOut: inDays(5) })).status).toBe(409);
	expect((await api(jane.token).patch("/bookings/bMine/dates", { checkIn: inDays(15), checkOut: inDays(14) })).status).toBe(400);
	expect((await api(jane.token).patch("/bookings/bMine/dates", { checkIn: inDays(10), checkOut: inDays(12) })).status).toBe(400);
	const staff = await login("staff@email.co.nz");
	expect((await api(staff.token).patch("/bookings/bMine/dates", { checkIn: inDays(11), checkOut: inDays(13) })).status).toBe(403);
});

test("a promo discount is kept when dates change", async () => {
	const res = await api(jane.token).patch("/bookings/bPromo/dates", { checkIn: inDays(30), checkOut: inDays(33) });
	expect(res.status).toBe(200);
	// 3 nights x $189 = $567, 10% off = $57 (rounded) -> $510
	expect(res.data.booking.fullPrice).toBe(567);
	expect(res.data.booking.discount).toBe(57);
	expect(res.data.booking.total).toBe(510);
	expect(res.data.difference).toBe(170);
});

// - Forgot / reset password ------------------------------------
test("forgot password gives the same reply whether or not the account exists", async () => {
	const unknown = await api().post("/auth/forgot", { email: "nobody@example.com" });
	const known = await api().post("/auth/forgot", { email: "JANE@email.com" });
	expect(unknown.status).toBe(200);
	expect(known.status).toBe(200);
	expect(known.data.message).toBe(unknown.data.message);
	expect(unknown.data.resetLink).toBeUndefined();
	expect(known.data.resetLink).toMatch(/^\/pages\/reset\.html\?token=[0-9a-f]{64}$/);
});

test("a reset link changes the password once, and the old password stops working", async () => {
	const { data } = await api().post("/auth/forgot", { email: "jane@email.com" });
	const token = new URLSearchParams(data.resetLink.split("?")[1]).get("token");

	expect((await api().post("/auth/reset", { token, password: "        " })).status).toBe(400);
	expect((await api().post("/auth/reset", { token, password: "short" })).status).toBe(400);
	const ok = await api().post("/auth/reset", { token, password: "brand-new-pass" });
	expect(ok.status).toBe(200);
	expect((await api().post("/auth/reset", { token, password: "another-pass1" })).status).toBe(400);

	expect((await login("jane@email.com", "password")).status).toBe(401);
	expect((await login("jane@email.com", "brand-new-pass")).status).toBe(200);
});

test("reset links expire after 30 minutes", async () => {
	const { data } = await api().post("/auth/forgot", { email: "jane@email.com" });
	const token = new URLSearchParams(data.resetLink.split("?")[1]).get("token");
	const realNow = Date.now;
	Date.now = () => realNow() + 31 * 60 * 1000;
	try {
		expect((await api().post("/auth/reset", { token, password: "brand-new-pass" })).status).toBe(400);
	} finally {
		Date.now = realNow;
	}
});

test("logging in without a password is a clear error, not a crash", async () => {
	const res = await api().post("/auth/login", { email: "jane@email.com" });
	expect(res.status).toBe(400);
	expect(res.data.error).toBeDefined();
});

test("emails are matched without regard to letter case", async () => {
	expect((await login(" JANE@email.com ")).status).toBe(200);
	const dup = await api().post("/auth/register", { name: "Jane Again", email: "Jane@Email.com", password: "password123", acceptTerms: true });
	expect(dup.status).toBe(409);
});

// - Terms at sign-up -------------------------------------------
test("registering requires agreeing to the terms, and records when", async () => {
	const email = `terms_${process.pid}@example.com`;
	const without = await api().post("/auth/register", { name: "Terms Test", email, password: "password123" });
	expect(without.status).toBe(400);
	const withTerms = await api().post("/auth/register", { name: "Terms Test", email, password: "password123", acceptTerms: true });
	expect(withTerms.status).toBe(201);
	const user = readData("users.json").find((u) => u.email === email);
	expect(user.termsAcceptedAt).toBeDefined();
});
