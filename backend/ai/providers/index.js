// ============================================================
//  Picks the hosted language model behind the assistant.
//
//  Set in .env (or run: npm run setup:ai):
//    AI_PROVIDER=auto     default: use whichever provider has a key below
//    GROQ_API_KEY=...     Groq, free tier       (console.groq.com/keys)
//    GEMINI_API_KEY=...   Google Gemini, free   (aistudio.google.com/apikey)
//    ANTHROPIC_API_KEY=.. Claude, paid          (console.anthropic.com)
//    GROQ_MODEL / GEMINI_MODEL / CLAUDE_MODEL   optional model overrides
//
//  Every provider exposes the same function:
//    chat({ system, messages, tools }) -> { text, toolCalls, raw }
//
//  `messages` uses one shared format so conversations don't depend on
//  the provider:
//    { role: "user", content: "text" }
//    { role: "assistant", content: "text", toolCalls: [{ id, name, input }],
//      raw: { provider, content } }   // provider-specific copy, optional
//    { role: "tool", toolCallId, name, content: "text", isError }
//  `tools` is a list of { name, description, parameters (JSON Schema) }.
// ============================================================

const {
	AiUnavailableError,
	AiNotConfiguredError,
	AiBusyError,
} = require("./unavailable-error");
const { createProvider } = require("./openai-compatible");

const groq = createProvider({
	name: "groq",
	label: "Groq",
	baseUrl: "https://api.groq.com/openai/v1",
	keyEnv: "GROQ_API_KEY",
	modelEnv: "GROQ_MODEL",
	defaultModel: "openai/gpt-oss-120b",
	keyUrl: "https://console.groq.com/keys",
});

const gemini = createProvider({
	name: "gemini",
	label: "Google Gemini",
	baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
	keyEnv: "GEMINI_API_KEY",
	modelEnv: "GEMINI_MODEL",
	// An alias that always points at Google's current Flash-Lite model, which
	// answers in about a second on the free tier (full Flash can take 30s+)
	defaultModel: "gemini-flash-lite-latest",
	keyUrl: "https://aistudio.google.com/apikey",
});

// In the order "auto" tries them
const PROVIDERS = {
	claude: { keyEnv: "ANTHROPIC_API_KEY", load: () => require("./claude") },
	groq: { keyEnv: groq.keyEnv, load: () => groq },
	gemini: { keyEnv: gemini.keyEnv, load: () => gemini },
};

const SETUP_HELP =
	"Aria needs a free AI key to work. In the project folder run: npm run setup:ai";

// The providers that can be used right now, in order of preference
function availableProviders() {
	const choice = (process.env.AI_PROVIDER || "auto").toLowerCase();
	if (choice !== "auto") {
		const entry = PROVIDERS[choice];
		if (!entry)
			throw new AiNotConfiguredError(
				`Unknown AI_PROVIDER "${choice}" in .env. Use auto, ${Object.keys(PROVIDERS).join(", ")}.`,
			);
		if (!process.env[entry.keyEnv])
			throw new AiNotConfiguredError(
				`AI_PROVIDER is ${choice} but ${entry.keyEnv} isn't set. ${SETUP_HELP}`,
			);
		return [entry.load()];
	}
	const list = Object.values(PROVIDERS)
		.filter((entry) => process.env[entry.keyEnv])
		.map((entry) => entry.load());
	if (!list.length) throw new AiNotConfiguredError(SETUP_HELP);
	return list;
}

// ---------- Resting providers ----------
// When a provider hits its limit (or is unreachable) it rests for a while
// and requests go to the next one. Once the rest is over it's used again
// automatically, so users never notice the switch.
const resting = new Map(); // provider name -> { until (ms), error that caused it }

const MAX_REST_SECONDS = 6 * 60 * 60;
function restSeconds(err) {
	if (err.kind === "rate-limit") return Math.min(err.retryAfter || 60, MAX_REST_SECONDS);
	if (err.kind === "auth") return 10 * 60; // a bad key won't fix itself quickly
	if (err.kind === "network") return 30;
	return 0; // a problem with this one request, not the provider
}

function isResting(name) {
	return (resting.get(name)?.until || 0) > Date.now();
}

// Seconds until the first provider in the list is usable again
function secondsUntilFree(list) {
	const soonest = Math.min(...list.map((p) => resting.get(p.name)?.until || 0));
	return Math.max(1, Math.ceil((soonest - Date.now()) / 1000));
}

function describeWait(seconds) {
	if (seconds < 60) return "less than a minute";
	const minutes = Math.ceil(seconds / 60);
	if (minutes < 90) return `about ${minutes} minute${minutes > 1 ? "s" : ""}`;
	return `about ${Math.round(minutes / 60)} hours`;
}

function busyError(list) {
	const retryAfter = secondsUntilFree(list);
	return new AiBusyError(
		`Aria needs a short break - she'll be back in ${describeWait(retryAfter)}.`,
		{ kind: "rate-limit", retryAfter },
	);
}

// When nothing can be used: a bad key is reported as such; otherwise it's a
// break caused by limits or outages
function outOfProvidersError(list) {
	const reasons = list.map((p) => resting.get(p.name)?.error);
	if (reasons.every((err) => err?.kind === "auth")) return reasons[0];
	return busyError(list);
}

// Seconds until at least one configured provider can be used: 0 when one is
// ready now. Throws AiNotConfiguredError when no provider has a key.
function secondsUntilAvailable() {
	const list = availableProviders();
	if (list.some((p) => !isResting(p.name))) return 0;
	return secondsUntilFree(list);
}

// Returns a provider that tries each available one in order, skipping any
// that are resting. When all of them are resting it throws AiBusyError.
function getProvider() {
	const list = availableProviders();
	return {
		name: list[0].name,
		model: list[0].model,
		async chat(request) {
			const ready = list.filter((p) => !isResting(p.name));
			if (!ready.length) throw outOfProvidersError(list);
			let lastError;
			for (const provider of ready) {
				try {
					return await provider.chat(request);
				} catch (err) {
					if (!(err instanceof AiUnavailableError)) throw err;
					const rest = restSeconds(err);
					if (rest) resting.set(provider.name, { until: Date.now() + rest * 1000, error: err });
					console.warn(
						`${provider.name} unavailable${rest ? ` - resting ${rest}s` : ""}:`,
						err.message,
					);
					lastError = err;
				}
			}
			throw list.every((p) => isResting(p.name)) ? outOfProvidersError(list) : lastError;
		},
	};
}

module.exports = {
	getProvider,
	secondsUntilAvailable,
	describeWait,
	AiUnavailableError,
	AiNotConfiguredError,
	AiBusyError,
	presets: { groq, gemini },
	resetResting: () => resting.clear(),
};
