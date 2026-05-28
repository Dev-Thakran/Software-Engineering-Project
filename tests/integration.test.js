// ============================================================
// tests/integration.test.js — Integration tests
// Starts the Express server internally so no external server is needed
// ============================================================

const app = require("../backend/server");
const http = require("http");
const axios = require("axios");

let server;
let BASE;

// Start the server on a random port before all tests
beforeAll((done) => {
	server = http.createServer(app);
	server.listen(0, () => {
		const port = server.address().port;
		BASE = `http://localhost:${port}`;
		done();
	});
});

// Close the server after all tests
afterAll((done) => {
	server.close(done);
});

// Axios instance pointing at the test server
// validateStatus: () => true prevents axios from throwing on 4xx/5xx
function api() {
	return axios.create({
		baseURL: BASE,
		validateStatus: () => true,
		timeout: 10000,
	});
}

// - Integration Test 1: Register → Login → Get token -----
// Tests the full authentication flow end to end
test("register then login returns a valid JWT token", async () => {
	const email = `inttest_${Date.now()}@email.com`;
	const password = "testpass123";

	// Register a new customer account
	const regRes = await api().post("/auth/register", {
		name: "Test User",
		email,
		password,
	});
	expect(regRes.status).toBe(201);

	// Log in with the new account and check token is returned
	const loginRes = await api().post("/auth/login", { email, password });
	expect(loginRes.status).toBe(200);
	expect(loginRes.data.token).toBeDefined();
	expect(loginRes.data.role).toBe("customer");
}, 15000);

// - Integration Test 2: Login → Fetch rooms ----------
// Tests that a logged-in customer can browse the room list
test("customer can log in and fetch room list", async () => {
	const loginRes = await api().post("/auth/login", {
		email: "jane@email.com",
		password: "password",
	});
	expect(loginRes.status).toBe(200);
	const token = loginRes.data.token;

	// Fetch all rooms — public endpoint
	const roomsRes = await api().get("/rooms", {
		headers: { Authorization: "Bearer " + token },
	});
	expect(roomsRes.status).toBe(200);
	expect(Array.isArray(roomsRes.data)).toBe(true);
	expect(roomsRes.data.length).toBeGreaterThan(0);
}, 15000);

// - Integration Test 3: Role-based access control ------
// Tests that a customer cannot access a manager-only endpoint
test("customer cannot access manager-only POST /rooms endpoint", async () => {
	const loginRes = await api().post("/auth/login", {
		email: "jane@email.com",
		password: "password",
	});
	expect(loginRes.status).toBe(200);
	const token = loginRes.data.token;

	// Attempt to add a room — manager only, should return 403
	const addRes = await api().post(
		"/rooms",
		{
			id: "999",
			floor: 1,
			type: "Standard Single",
			price: 99,
		},
		{
			headers: { Authorization: "Bearer " + token },
		},
	);

	expect(addRes.status).toBe(403);
	expect(addRes.data.error).toBe("Access denied");
}, 15000);
