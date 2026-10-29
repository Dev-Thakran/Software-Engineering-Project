// ============================================================
// tests/rooms-rates.test.js — Room content per tier, accessible
// rooms, and the Flexible / Advance purchase rate plans
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

const login = async (email) => (await api().post("/auth/login", { email, password: "password" })).data.token;

let jane;
let staff;
beforeAll(async () => {
	jane = await login("jane@email.com");
	staff = await login("manager@email.co.nz"); // managers are never blocked by shifts
});

beforeEach(() => {
	writeData("bookings.json", []);
	writeData("checkins.json", []);
	writeData("promos.json", [{ code: "EXPO2026", percent: 10, label: "Tech Expo", active: true }]);
});

// - Room content -------------------------------------------
test("every room carries its floor's content", async () => {
	const { data: rooms } = await api().get("/rooms");
	expect(rooms).toHaveLength(24);
	for (const r of rooms) {
		expect(r.tier).toBeDefined();
		expect(r.tier.sizeSqm).toBeGreaterThan(0);
		expect(r.tier.story.length).toBeGreaterThan(40);
		expect(r.tier.photos.length).toBeGreaterThanOrEqual(3);
		// a room's own photo comes from its tier's set
		expect(r.tier.photos).toContain(r.image.replace("../frontend", ""));
	}
	const garden = rooms.find((r) => r.id === "101");
	expect(garden.tier.view).toMatch(/courtyard/i);
	expect(garden.description).not.toMatch(/city/i);
	expect(rooms.find((r) => r.id === "401").tier.name).toBe("Penthouse");
});

test("no two tiers share a photo", async () => {
	const tiers = readData("tiers.json");
	const all = Object.values(tiers.floors).flatMap((t) => t.photos);
	expect(new Set(all).size).toBe(all.length);
});

// - Accessible rooms -----------------------------------------
test("accessible rooms are one per floor and can be filtered", async () => {
	const res = await api().get("/rooms?accessible=1");
	expect(res.data.map((r) => r.id).sort()).toEqual(["106", "206", "306", "406"]);
	expect(res.data[0].accessibleFeatures.length).toBeGreaterThan(3);
	const other = (await api().get("/rooms/301")).data;
	expect(other.accessible).toBe(false);
	expect(other.accessibleFeatures).toBeUndefined();
});

// - Rate plans --------------------------------------------------
test("the rate plans are published", async () => {
	const { data } = await api().get("/rooms/rate-plans");
	expect(data.map((p) => p.id)).toEqual(["flexible", "advance"]);
	expect(data.find((p) => p.id === "advance")).toMatchObject({ discountPercent: 10, refundable: false });
});

const book = (body) => api(jane).post("/bookings", { roomId: "402", checkIn: inDays(10), checkOut: inDays(13), adults: 2, ...body });

test("flexible is the default and keeps the full price", async () => {
	const res = await book({});
	expect(res.status).toBe(201);
	expect(res.data).toMatchObject({ ratePlan: "flexible", total: 1140 });
	expect(res.data.rateDiscount).toBeUndefined();
});

test("advance purchase takes 10% off, and a promo stacks on the reduced price", async () => {
	const plain = await book({ ratePlan: "advance" });
	expect(plain.data).toMatchObject({ ratePlan: "advance", rateDiscount: 114, fullPrice: 1140, total: 1026 });

	writeData("bookings.json", []);
	const promo = await book({ ratePlan: "advance", promoCode: "EXPO2026" });
	// $1,140 -> $1,026 -> 10% of $1,026 = $103 (rounded) -> $923
	expect(promo.data).toMatchObject({ rateDiscount: 114, discount: 103, total: 923, promoCode: "EXPO2026" });
});

test("unknown rate plans are refused", async () => {
	expect((await book({ ratePlan: "super-saver" })).status).toBe(400);
});

test("guests can't cancel or change an advance booking, but reception can cancel", async () => {
	const { data: b } = await book({ ratePlan: "advance" });
	const cancel = await api(jane).patch(`/bookings/${b.id}`, { status: "cancelled" });
	expect(cancel.status).toBe(409);
	expect(cancel.data.error).toMatch(/non-refundable/);
	expect((await api(jane).patch(`/bookings/${b.id}/dates`, { checkIn: inDays(11), checkOut: inDays(14) })).status).toBe(409);

	const byStaff = await api(staff).patch(`/bookings/${b.id}`, { status: "cancelled" });
	expect(byStaff.status).toBe(200);
});

test("flexible bookings can still be cancelled by the guest", async () => {
	const { data: b } = await book({});
	expect((await api(jane).patch(`/bookings/${b.id}`, { status: "cancelled" })).status).toBe(200);
});

test("cancelling a finished stay gives the right reason", async () => {
	writeData("bookings.json", [{
		id: "bDone", userId: readData("users.json").find((u) => u.email === "jane@email.com").id, userName: "Jane",
		roomId: "201", roomType: "Deluxe Double", floor: 2, checkIn: inDays(-5), checkOut: inDays(-3),
		nights: 2, total: 378, status: "completed", createdAt: new Date().toISOString(),
	}]);
	const res = await api(jane).patch("/bookings/bDone", { status: "cancelled" });
	expect(res.status).toBe(409);
	expect(res.data.error).toMatch(/awaiting check-in/);
});
