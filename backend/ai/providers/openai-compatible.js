// Hosted models reached through an OpenAI-style chat API. Groq and Google
// Gemini both offer one with a free tier, so one adapter serves both.
const { AiUnavailableError } = require("./unavailable-error");

const TIMEOUT_MS = 60000;
// Replies are short; capping them stops free tiers from reserving (and
// rejecting) far more output than Aria needs
const MAX_REPLY_TOKENS = 1024;

// Converts the shared message format into OpenAI-style chat messages.
// `provider` is the preset name. Gemini attaches a hidden signature to its own
// tool calls and requires it back; tool calls without one (made by another
// provider earlier in the conversation) are given to it as plain text instead.
function toOpenAIMessages(system, messages, provider) {
	const needsSignature = provider === "gemini";
	const asText = new Set(); // ids of tool calls shown as text
	const out = [{ role: "system", content: system }];
	for (const m of messages) {
		if (m.role === "user") out.push({ role: "user", content: m.content });
		else if (m.role === "assistant" && m.toolCalls?.length) {
			const signed = m.toolCalls.every((c) => c.extra && c.extra.provider === provider);
			if (needsSignature && !signed) {
				m.toolCalls.forEach((c) => asText.add(c.id));
				const calls = m.toolCalls.map((c) => `(Looked up ${c.name} ${JSON.stringify(c.input || {})})`);
				out.push({ role: "assistant", content: [m.content, ...calls].filter(Boolean).join("\n") });
				continue;
			}
			out.push({
				role: "assistant",
				content: m.content || null,
				tool_calls: m.toolCalls.map((c) => ({
					id: c.id,
					type: "function",
					function: { name: c.name, arguments: JSON.stringify(c.input || {}) },
					...(c.extra && c.extra.provider === provider && { extra_content: c.extra.content }),
				})),
			});
		} else if (m.role === "assistant") out.push({ role: "assistant", content: m.content || "" });
		else if (m.role === "tool" && asText.has(m.toolCallId))
			out.push({ role: "user", content: `(Result of ${m.name}: ${m.content})` });
		else if (m.role === "tool")
			out.push({ role: "tool", tool_call_id: m.toolCallId, content: m.content });
	}
	return out;
}

// Gemini rejects function parameters with no properties, so tools that take
// no input are sent without a parameters schema
function toOpenAITools(tools) {
	return tools.map((t) => ({
		type: "function",
		function: {
			name: t.name,
			description: t.description,
			...(Object.keys(t.parameters?.properties || {}).length && {
				parameters: t.parameters,
			}),
		},
	}));
}

// How long a rate-limited provider asked us to wait, in seconds. Groq sends a
// retry-after header; Gemini puts "retryDelay": "37s" in the error body.
function retryAfterSeconds(res, data) {
	const header = Number(res.headers?.get?.("retry-after"));
	if (header > 0) return header;
	const match = JSON.stringify(data).match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
	return match ? Math.ceil(Number(match[1])) : undefined;
}

function safeParse(json) {
	try {
		return JSON.parse(json || "{}");
	} catch {
		return {};
	}
}

// Builds a provider. `preset` describes one hosted service:
//   { name, label, baseUrl, keyEnv, modelEnv, defaultModel, keyUrl }
function createProvider(preset) {
	const apiKey = () => process.env[preset.keyEnv];
	const model = () => process.env[preset.modelEnv] || preset.defaultModel;

	async function chat({ system, messages, tools }) {
		let res;
		try {
			res = await fetch(`${preset.baseUrl}/chat/completions`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey()}`,
				},
				body: JSON.stringify({
					model: model(),
					max_tokens: MAX_REPLY_TOKENS,
					messages: toOpenAIMessages(system, messages, preset.name),
					...(tools.length && { tools: toOpenAITools(tools) }),
				}),
				signal: AbortSignal.timeout(TIMEOUT_MS),
			});
		} catch {
			throw new AiUnavailableError(
				`Couldn't reach ${preset.label} - check the internet connection.`,
				{ kind: "network" },
			);
		}

		const data = await res.json().catch(() => ({}));
		if (!res.ok) {
			// Full details go to the server log, not the chat window
			const detail = Array.isArray(data) ? data[0]?.error : data.error;
			console.error(`${preset.label} error ${res.status}:`, detail?.message || detail || "");
			// Gemini reports an invalid key as a 400 "API key not valid"
			const badKey = res.status === 400 && /api[_ ]?key/i.test(JSON.stringify(detail || ""));
			if (res.status === 401 || res.status === 403 || badKey)
				throw new AiUnavailableError(
					`The ${preset.label} API key in .env was rejected. Run npm run setup:ai to set a new one.`,
					{ kind: "auth" },
				);
			// A request bigger than the free tier ever allows is not a passing limit
			if (res.status === 413 || /too large/i.test(JSON.stringify(detail || "")))
				throw new AiUnavailableError(
					`That request is too big for the free ${preset.label} model. Try a shorter question.`,
				);
			if (res.status === 429)
				throw new AiUnavailableError(`The free ${preset.label} limit has been reached.`, {
					kind: "rate-limit",
					retryAfter: retryAfterSeconds(res, data),
				});
			if (res.status === 404)
				throw new AiUnavailableError(
					`${preset.label} doesn't recognise the model "${model()}". Run npm run setup:ai to pick a current one.`,
					{ kind: "auth" },
				);
			throw new AiUnavailableError(
				`${preset.label} couldn't handle that request. Please try rephrasing.`,
			);
		}

		const message = data.choices?.[0]?.message || {};
		return {
			text: (message.content || "").trim(),
			toolCalls: (message.tool_calls || []).map((c, i) => ({
				id: c.id || `call_${Date.now()}_${i}`,
				name: c.function?.name,
				input:
					typeof c.function?.arguments === "string"
						? safeParse(c.function.arguments)
						: c.function?.arguments || {},
				// Provider-specific extras (Gemini's thought signature) to send back
				...(c.extra_content && { extra: { provider: preset.name, content: c.extra_content } }),
			})),
			raw: null,
		};
	}

	// Lists the model IDs this key can use (free; used by the setup script)
	async function listModels(key = apiKey()) {
		const res = await fetch(`${preset.baseUrl}/models`, {
			headers: { Authorization: `Bearer ${key}` },
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		if (!res.ok) throw new AiUnavailableError(`${preset.label} rejected the key (${res.status}).`);
		const data = await res.json();
		return (data.data || []).map((m) => String(m.id).replace(/^models\//, ""));
	}

	// Sends one tiny request to see whether a model really answers with this
	// key (used by the setup script; well within free limits)
	async function tryModel(key, modelId) {
		try {
			const res = await fetch(`${preset.baseUrl}/chat/completions`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
				body: JSON.stringify({
					model: modelId,
					max_tokens: MAX_REPLY_TOKENS,
					messages: [{ role: "user", content: "Reply with the word OK." }],
				}),
				signal: AbortSignal.timeout(TIMEOUT_MS),
			});
			return res.ok;
		} catch {
			return false;
		}
	}

	return {
		...preset,
		tryModel,
		get model() {
			return model();
		},
		chat,
		listModels,
	};
}

module.exports = { createProvider, toOpenAIMessages, toOpenAITools };
