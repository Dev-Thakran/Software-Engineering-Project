// In-memory state for the assistant. Everything here is cleared when the
// server restarts, which is fine for a demo.
const crypto = require("crypto");
const config = require("./assistant.config");

const ACTION_TTL_MS = 30 * 60 * 1000;

const conversations = new Map(); // userId -> message list (shared format)
const actions = new Map(); // actionId -> pending action
const recentMessages = new Map(); // userId -> timestamps, for rate limiting

function getConversation(userId) {
	if (!conversations.has(userId)) conversations.set(userId, []);
	return conversations.get(userId);
}

function clearConversation(userId) {
	conversations.delete(userId);
	for (const [id, action] of actions)
		if (action.userId === userId) actions.delete(id);
}

// Drops the oldest messages once the history is too long. The cut always
// lands on a user's typed message, so tool calls keep their results.
function trimConversation(userId) {
	const messages = getConversation(userId);
	const max = config.limits.maxHistoryMessages;
	if (messages.length <= max) return;
	let start = messages.length - max;
	while (start < messages.length && !messages[start].typed) start++;
	messages.splice(0, start);
}

// Records an action the user still has to confirm, and returns it
function addAction(userId, type, params, card) {
	const action = {
		id: crypto.randomUUID(),
		userId,
		type,
		params,
		card,
		createdAt: Date.now(),
	};
	actions.set(action.id, action);
	return action;
}

// Removes and returns a pending action owned by this user, or null
function takeAction(userId, actionId) {
	const action = actions.get(actionId);
	if (!action || action.userId !== userId) return null;
	actions.delete(actionId);
	if (Date.now() - action.createdAt > ACTION_TTL_MS) return null;
	return action;
}

// True when the user has sent too many messages in the last minute
function isRateLimited(userId) {
	const now = Date.now();
	const recent = (recentMessages.get(userId) || []).filter(
		(t) => now - t < 60000,
	);
	if (recent.length >= config.limits.maxMessagesPerMinute) {
		recentMessages.set(userId, recent);
		return true;
	}
	recent.push(now);
	recentMessages.set(userId, recent);
	return false;
}

module.exports = {
	getConversation,
	clearConversation,
	trimConversation,
	addAction,
	takeAction,
	isRateLimited,
};
