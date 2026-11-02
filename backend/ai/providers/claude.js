// Claude via the official Anthropic SDK. Reads ANTHROPIC_API_KEY from .env.
const { Anthropic } = require("@anthropic-ai/sdk");
const { AiUnavailableError } = require("./unavailable-error");

const name = "claude";
const model = process.env.CLAUDE_MODEL || "claude-opus-5";

let client;
function getClient() {
	if (!process.env.ANTHROPIC_API_KEY)
		throw new AiUnavailableError(
			"The assistant isn't set up yet: add ANTHROPIC_API_KEY to .env.",
		);
	client ??= new Anthropic();
	return client;
}

// Converts the shared message format into Claude's. Assistant turns that
// Claude produced are replayed exactly as returned (including thinking
// blocks); consecutive tool results are grouped into one user message.
function toClaudeMessages(messages) {
	const out = [];
	for (const m of messages) {
		if (m.role === "user") {
			out.push({ role: "user", content: m.content });
		} else if (m.role === "assistant") {
			out.push({ role: "assistant", content: assistantContent(m) });
		} else if (m.role === "tool") {
			const result = {
				type: "tool_result",
				tool_use_id: m.toolCallId,
				content: m.content,
				...(m.isError && { is_error: true }),
			};
			const last = out[out.length - 1];
			if (last?.role === "user" && Array.isArray(last.content) && last.toolResults)
				last.content.push(result);
			else out.push({ role: "user", content: [result], toolResults: true });
		}
	}
	return out.map(({ role, content }) => ({ role, content }));
}

function assistantContent(m) {
	if (m.raw?.provider === name) return m.raw.content;
	const blocks = [];
	if (m.content) blocks.push({ type: "text", text: m.content });
	for (const call of m.toolCalls || [])
		blocks.push({ type: "tool_use", id: call.id, name: call.name, input: call.input });
	return blocks.length ? blocks : [{ type: "text", text: "(no reply)" }];
}

async function chat({ system, messages, tools }) {
	let response;
	try {
		response = await getClient().beta.messages.create({
			model,
			max_tokens: 16000,
			// On a safety decline, retry on Anthropic's recommended fallback model
			betas: ["server-side-fallback-2026-07-01"],
			fallbacks: "default",
			system,
			tools: tools.map((t) => ({
				name: t.name,
				description: t.description,
				input_schema: t.parameters,
			})),
			messages: toClaudeMessages(messages),
		});
	} catch (err) {
		if (err instanceof Anthropic.AuthenticationError)
			throw new AiUnavailableError("The Anthropic API key in .env was rejected.", {
				kind: "auth",
			});
		if (err instanceof Anthropic.RateLimitError)
			throw new AiUnavailableError("The Claude API limit has been reached.", {
				kind: "rate-limit",
				retryAfter: Number(err.headers?.get?.("retry-after")) || undefined,
			});
		if (err instanceof Anthropic.APIConnectionError)
			throw new AiUnavailableError(
				"Couldn't reach the Claude API - check the internet connection.",
				{ kind: "network" },
			);
		throw err;
	}

	if (response.stop_reason === "refusal")
		return {
			text: "Sorry, I can't help with that request.",
			toolCalls: [],
			raw: null,
		};

	// After a fallback, only the blocks from the model that answered are kept
	const lastFallback = response.content.map((b) => b.type).lastIndexOf("fallback");
	const content = response.content.slice(lastFallback + 1);

	return {
		text: content
			.filter((b) => b.type === "text")
			.map((b) => b.text)
			.join("\n")
			.trim(),
		toolCalls: content
			.filter((b) => b.type === "tool_use")
			.map((b) => ({ id: b.id, name: b.name, input: b.input })),
		raw: { provider: name, content },
	};
}

module.exports = { name, model, chat, toClaudeMessages };
