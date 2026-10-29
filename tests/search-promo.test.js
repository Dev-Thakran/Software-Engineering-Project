// ============================================================
// tests/search-promo.test.js — Adults and children on bookings,
// and promo codes
// ============================================================

const { writeData, readData } = require("./helpers/temp-data");
const app = require("../backend/server");
const http = require("http");
const axios = require("axios");

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

let jane;
beforeAll(async () => {
	jane = (await api().post("/auth/login", { email: "jane@email.com", password: "password" })).data.token;
});

beforeEach(() => {
	writeData("bookings.json", []);
	writeData("checkins.json", []);
	writeData("promos.json", [
		{ code: "EXPO2026", percent: 10, label: "Tech Expo 2026", active: true, validFrom: inDays(-30), validTo: inDays(60) },
		{ code: "OLDCODE", percent: 20, label: "Ended", active: true, validFrom: inDays(-90), validTo: inDays(-1) },
		{ code: "PAUSED", percent: 15, label: "Paused", active: false },
	]);
});

const book = (body) => api(jane).post("/bookings", { checkIn: inDays(5), checkOut: inDays(7), ...body });

// - Adults and children --------------------------------------
test("adults and children are stored and count toward the room's limit", async () => {
	const tooMany = await book({ roomId: "201", adults: 2, children: 1 });
	expect(tooMany.status).toBe(400);
	expect(tooMany.data.error).toMatch(/sleeps up to 2/);

	const ok = await book({ roomId: "401", adults: 2, children: 1 });
	expect(ok.status).toBe(201);
	expect(ok.data).toMatchObject({ adults: 2, children: 1, guests: 3 });
});

test("at least one adult is needed and counts must be whole numbers", async () => {
	expect((await book({ roomId: "401", adults: 0, children: 2 })).status).toBe(400);
	expect((await book({ roomId: "401", adults: 1.5 })).status).toBe(400);
	expect((await book({ roomId: "401", adults: 2, children: -1 })).status).toBe(400);
});

test("older callers sending only 'guests' are treated as adults", async () => {
	const res = await book({ roomId: "201", guests: 2 });
	expect(res.status).toBe(201);
	expect(res.data).toMatchObject({ adults: 2, children: 0, guests: 2 });
	expect((await book({ roomId: "101", guests: 2 })).status).toBe(400);
});

// - Promo codes ------------------------------------------------
test("a valid code takes its percentage off the room price only", async () => {
	const res = await book({ roomId: "201", adults: 2, promoCode: " expo2026 " });
	expect(res.status).toBe(201);
	// 2 nights x $189 = $378, 10% = $38 (rounded)
	expect(res.data).toMatchObject({ promoCode: "EXPO2026", promoPercent: 10, fullPrice: 378, discount: 38, total: 340 });
});

test("expired, paused and unknown codes are refused", async () => {
	for (const code of ["OLDCODE", "PAUSED", "NOPE"]) {
		const res = await book({ roomId: "201", adults: 1, promoCode: code });
		expect(res.status).toBe(400);
	}
	expect(readData("bookings.json")).toHaveLength(0);
});

test("the public promo check previews a code", async () => {
	const ok = await api().get("/promos/expo2026");
	expect(ok.status).toBe(200);
	expect(ok.data).toEqual({ code: "EXPO2026", percent: 10, label: "Tech Expo 2026" });
	expect((await api().get("/promos/OLDCODE")).status).toBe(404);
	expect((await api().get("/promos/PAUSED")).status).toBe(404);
});

test("bookings without a code have no promo fields", async () => {
	const res = await book({ roomId: "201", adults: 1 });
	expect(res.status).toBe(201);
	expect(res.data.promoCode).toBeUndefined();
	expect(res.data.total).toBe(378);
});
