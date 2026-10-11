// The model can't be reached right now. The message is shown to the user,
// so keep it free of secrets.
//   kind:       "rate-limit" | "auth" | "network" | "error"
//   retryAfter: seconds the provider asked us to wait, when it said
class AiUnavailableError extends Error {
	constructor(message, { kind = "error", retryAfter } = {}) {
		super(message);
		this.kind = kind;
		this.retryAfter = retryAfter;
	}
}

// No AI provider is set up on this computer (no API key in .env)
class AiNotConfiguredError extends AiUnavailableError {}

// Every provider is resting after hitting its limits; retryAfter says when
// the first one is usable again
class AiBusyError extends AiUnavailableError {}

module.exports = { AiUnavailableError, AiNotConfiguredError, AiBusyError };
