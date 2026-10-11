const express = require("express");
const assistant = require("../ai/assistant");
const { AiUnavailableError, AiBusyError } = require("../ai/providers");
const { authenticate } = require("../middleware/auth.middleware");
const router = express.Router();

// The assistant is only for signed-in users
router.use(authenticate);

// Sends known errors with their status; anything else is logged as a bug
function handle(fn) {
	return async (req, res) => {
		try {
			res.json(await fn(req));
		} catch (err) {
			if (err instanceof AiBusyError)
				return res.status(503).json({
					error: assistant.awayMessage(err.retryAfter),
					retryAfter: err.retryAfter,
				});
			if (err instanceof AiUnavailableError)
				return res.status(503).json({ error: err.message });
			if (err.status) return res.status(err.status).json({ error: err.message });
			console.error("Assistant error:", err);
			res.status(500).json({ error: "Something went wrong. Please try again." });
		}
	};
}

router.get("/status", handle(() => assistant.status()));
router.get("/greeting", handle((req) => assistant.greeting(req.user)));
router.post("/chat", handle((req) => assistant.chat(req.user, req.body?.message)));
router.post(
	"/actions/:id/confirm",
	handle((req) => assistant.confirmAction(req.user, req.params.id)),
);
router.post(
	"/actions/:id/cancel",
	handle((req) => assistant.cancelAction(req.user, req.params.id)),
);
router.delete(
	"/conversation",
	handle((req) => {
		assistant.resetConversation(req.user.id);
		return { message: "Conversation cleared" };
	}),
);

module.exports = router;
