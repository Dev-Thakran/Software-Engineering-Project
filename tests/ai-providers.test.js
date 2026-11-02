// ============================================================
// tests/ai-providers.test.js — Hosted AI providers (Groq, Gemini)
// and automatic provider selection, with fetch mocked so no API
// key or network is needed
// ============================================================

require("./helpers/temp-data");
const { toOpenAIMessages, toOpenAITools } = require("../backend/ai/providers/openai-compatible");
const {
	getProvider,
	presets,
	resetResting,
	AiUnavailableError,
	AiNotConfiguredError,
	AiBusyError,
	secondsUntilAvailable,
} = require("../backend/ai/providers");
const assistant = require("../backend/ai/assistant");

const KEYS = ["AI_PROVIDER", "GROQ_API_KEY", "GEMINI_API_KEY", "ANTHROPIC_API_KEY"];
const savedEnv = {};
const realFetch = global.fetch;

beforeEach(() => {
	resetResting();
	KEYS.forEach((k) => {
		savedEnv[k] = process.env[k];
		delete process.env[k];
	});
});
afterEach(() => {
	jest.restoreAllMocks();
	KEYS.forEach((k) => {
		if (savedEnv[k] === undefined) delete process.env[k];
		else process.env[k] = savedEnv[k];
	});
	global.fetch = realFetch;
});

// A fake fetch that answers per host
function mockFetch(handlers) {
	global.fetch = jest.fn(async (url, options) => {
		const host = new URL(url).host;
		const handler = handlers[host];
		if (!handler) throw new TypeError("fetch failed");
		const { status = 200, body = {}, headers = {} } = handler(url, options);
		return {
			ok: status < 400,
			status,
			headers: { get: (name) => headers[name.toLowerCase()] ?? null },
			json: async () => body,
		};
	});
}

const reply = (message) => ({ body: { choices: [{ message }] } });
const request = { system: "sys", messages: [{ role: "user", content: "Hi" }], tools: [] };

test("shared messages convert to OpenAI-style messages and back", () => {
	const out = toOpenAIMessages("You are Aria", [
		{ role: "user", content: "Who's waiting?" },
		{ role: "assistant", content: "", toolCalls: [{ id: "t1", name: "get_checkin_queue", input: {} }] },
		{ role: "tool", toolCallId: "t1", name: "get_checkin_queue", content: "[]" },
		{ role: "assistant", content: "Nobody is waiting." },
	]);
	expect(out).toEqual([
		{ role: "system", content: "You are Aria" },
		{ role: "user", content: "Who's waiting?" },
		{
			role: "assistant",
			content: null,
			tool_calls: [
				{ id: "t1", type: "function", function: { name: "get_checkin_queue", arguments: "{}" } },
			],
		},
		{ role: "tool", tool_call_id: "t1", content: "[]" },
		{ role: "assistant", content: "Nobody is waiting." },
	]);
});

test("tools without inputs are sent without a parameters schema", () => {
	const tools = toOpenAITools([
		{ name: "a", description: "A", parameters: { type: "object", properties: {} } },
		{ name: "b", description: "B", parameters: { type: "object", properties: { x: { type: "string" } } } },
	]);
	expect(tools[0].function.parameters).toBeUndefined();
	expect(tools[1].function.parameters.properties.x.type).toBe("string");
});

test("Groq tool calls are parsed into the shared format", async () => {
	process.env.GROQ_API_KEY = "test-key";
	mockFetch({
		"api.groq.com": (url, options) => {
			expect(options.headers.Authorization).toBe("Bearer test-key");
			return reply({
				content: null,
				tool_calls: [{ id: "c1", function: { name: "propose_checkin", arguments: '{"booking":"Jane"}' } }],
			});
		},
	});
	const result = await presets.groq.chat(request);
	expect(result.toolCalls).toEqual([{ id: "c1", name: "propose_checkin", input: { booking: "Jane" } }]);
	expect(result.text).toBe("");
});

test("provider errors become plain messages", async () => {
	process.env.GROQ_API_KEY = "bad";
	mockFetch({ "api.groq.com": () => ({ status: 401, body: { error: { message: "Invalid API Key" } } }) });
	await expect(presets.groq.chat(request)).rejects.toThrow(/key in .env was rejected/);

	mockFetch({ "api.groq.com": () => ({ status: 429 }) });
	await expect(presets.groq.chat(request)).rejects.toThrow(/limit has been reached/);

	mockFetch({});
	await expect(presets.groq.chat(request)).rejects.toThrow(/Couldn't reach Groq/);
});

test("with no keys, the assistant reports it isn't set up", () => {
	expect(() => getProvider()).toThrow(AiNotConfiguredError);
	const status = assistant.status();
	expect(status.ready).toBe(false);
	expect(status.setup).toMatch(/npm run setup:ai/);
});

test("auto uses the provider that has a key", () => {
	process.env.GEMINI_API_KEY = "g";
	expect(getProvider().name).toBe("gemini");
	process.env.GROQ_API_KEY = "q";
	expect(getProvider().name).toBe("groq");
	expect(assistant.status()).toMatchObject({ ready: true, provider: "groq" });
});

test("auto moves on to the next provider when one is busy", async () => {
	process.env.GROQ_API_KEY = "q";
	process.env.GEMINI_API_KEY = "g";
	mockFetch({
		"api.groq.com": () => ({ status: 429 }),
		"generativelanguage.googleapis.com": () => reply({ content: "Hello from Gemini" }),
	});
	const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
	const error = jest.spyOn(console, "error").mockImplementation(() => {});
	const result = await getProvider().chat(request);
	expect(result.text).toBe("Hello from Gemini");
	warn.mockRestore();
	error.mockRestore();
});

test("a forced provider without its key explains what's missing", () => {
	process.env.AI_PROVIDER = "groq";
	expect(() => getProvider()).toThrow(/GROQ_API_KEY isn't set/);
	process.env.AI_PROVIDER = "ollama";
	expect(() => getProvider()).toThrow(/Unknown AI_PROVIDER "ollama"/);
	expect(AiNotConfiguredError.prototype).toBeInstanceOf(AiUnavailableError);
});

// Silences the expected warnings from providers hitting limits
function quiet() {
	jest.spyOn(console, "warn").mockImplementation(() => {});
	jest.spyOn(console, "error").mockImplementation(() => {});
}

test("a provider that hits its limit rests, then is used again afterwards", async () => {
	quiet();
	process.env.GROQ_API_KEY = "q";
	process.env.GEMINI_API_KEY = "g";
	let now = 1_000_000;
	jest.spyOn(Date, "now").mockImplementation(() => now);
	let groqLimited = true;
	mockFetch({
		"api.groq.com": () =>
			groqLimited ? { status: 429, headers: { "retry-after": "120" } } : reply({ content: "Groq" }),
		"generativelanguage.googleapis.com": () => reply({ content: "Gemini" }),
	});

	expect((await getProvider().chat(request)).text).toBe("Gemini");
	// While Groq rests it isn't even tried
	global.fetch.mockClear();
	expect((await getProvider().chat(request)).text).toBe("Gemini");
	expect(global.fetch.mock.calls.map(([url]) => new URL(url).host)).toEqual([
		"generativelanguage.googleapis.com",
	]);
	// Two minutes later Groq is back in use
	groqLimited = false;
	now += 121_000;
	expect((await getProvider().chat(request)).text).toBe("Groq");
});

test("when every provider is out, Aria takes a break until the first is back", async () => {
	quiet();
	process.env.GROQ_API_KEY = "q";
	process.env.GEMINI_API_KEY = "g";
	jest.spyOn(Date, "now").mockReturnValue(5_000_000);
	mockFetch({
		"api.groq.com": () => ({ status: 429, headers: { "retry-after": "300" } }),
		"generativelanguage.googleapis.com": () => ({
			status: 429,
			body: { error: { details: [{ retryDelay: "90s" }] } },
		}),
	});

	const err = await getProvider().chat(request).catch((e) => e);
	expect(err).toBeInstanceOf(AiBusyError);
	expect(err.retryAfter).toBe(90); // Gemini's wait, read from its error body
	expect(err.message).toBe("Aria needs a short break - she'll be back in about 2 minutes.");

	// During the break no requests are sent at all
	global.fetch.mockClear();
	await expect(getProvider().chat(request)).rejects.toThrow(AiBusyError);
	expect(global.fetch).not.toHaveBeenCalled();
});

test("a one-off bad request doesn't make a provider rest", async () => {
	quiet();
	process.env.GROQ_API_KEY = "q";
	let calls = 0;
	mockFetch({
		"api.groq.com": () => (++calls === 1 ? { status: 400 } : reply({ content: "OK" })),
	});
	await expect(getProvider().chat(request)).rejects.toThrow(/couldn't handle that request/);
	expect((await getProvider().chat(request)).text).toBe("OK");
});

test("a rejected key is reported as a key problem, not as a break", async () => {
	quiet();
	process.env.GEMINI_API_KEY = "wrong";
	mockFetch({
		"generativelanguage.googleapis.com": () => ({
			status: 400,
			body: [{ error: { message: "API key not valid. Please pass a valid API key." } }],
		}),
	});
	await expect(getProvider().chat(request)).rejects.toThrow(/Gemini API key in .env was rejected/);
	// Still the key message on the next try, without calling Gemini again
	global.fetch.mockClear();
	await expect(getProvider().chat(request)).rejects.toThrow(/key in .env was rejected/);
	expect(global.fetch).not.toHaveBeenCalled();
});

test("Gemini gets its own signed tool calls back, and other providers' calls as text", () => {
	const signed = { provider: "gemini", content: { google: { thought_signature: "sig" } } };
	const history = [
		{ role: "user", content: "Revenue?" },
		{ role: "assistant", content: "", toolCalls: [{ id: "g1", name: "get_overview", input: {} }] },
		{ role: "tool", toolCallId: "g1", name: "get_overview", content: '{"totalRevenue":5}' },
		{ role: "assistant", content: "", toolCalls: [{ id: "m1", name: "get_staff", input: {}, extra: signed }] },
		{ role: "tool", toolCallId: "m1", name: "get_staff", content: "[]" },
	];
	const out = toOpenAIMessages("sys", history, "gemini");
	// A call another provider made becomes plain text
	expect(out[2]).toEqual({ role: "assistant", content: "(Looked up get_overview {})" });
	expect(out[3]).toEqual({ role: "user", content: '(Result of get_overview: {"totalRevenue":5})' });
	// Gemini's own call keeps its signature
	expect(out[4].tool_calls[0].extra_content).toEqual(signed.content);
	expect(out[5]).toEqual({ role: "tool", tool_call_id: "m1", content: "[]" });
	// Groq never sees Gemini's extras
	expect(toOpenAIMessages("sys", history, "groq")[4].tool_calls[0].extra_content).toBeUndefined();
});

test("Aria reports how long until she's back, and words it from the config", async () => {
	quiet();
	process.env.GROQ_API_KEY = "q";
	process.env.GEMINI_API_KEY = "g";
	let now = 9_000_000;
	jest.spyOn(Date, "now").mockImplementation(() => now);
	expect(secondsUntilAvailable()).toBe(0);

	let groqLimited = true;
	mockFetch({
		"api.groq.com": () =>
			groqLimited ? { status: 429, headers: { "retry-after": "40" } } : reply({ content: "Groq is back" }),
		"generativelanguage.googleapis.com": () => ({ status: 429, headers: { "retry-after": "120" } }),
	});
	await expect(getProvider().chat(request)).rejects.toThrow(AiBusyError);
	// Groq is free first, after 40 seconds
	expect(secondsUntilAvailable()).toBe(40);
	expect(assistant.status().availableIn).toBe(40);
	expect(assistant.awayMessage(40)).toBe("Aria needs a short break - she'll be back in less than a minute.");

	// Once Groq's rest is over, Aria is available again and answers
	now += 41_000;
	groqLimited = false;
	expect(secondsUntilAvailable()).toBe(0);
	expect((await getProvider().chat(request)).text).toBe("Groq is back");
});

test("the greeting carries the message Aria says when she's back", () => {
	process.env.GROQ_API_KEY = "q";
	const greeting = assistant.greeting({ id: "u001", name: "Jane Thompson", role: "customer" });
	expect(greeting.backMessage).toBe(
		"Sorry about that! I'm an AI that needs a power nap every minute, but I'll be quick to help you :)",
	);
});
