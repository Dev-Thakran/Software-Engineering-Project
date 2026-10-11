// ============================================================
//  npm run setup:ai - sets up the AI assistant on this computer
//
//  Creates .env if it's missing, asks which AI provider to use,
//  checks the API key works, and saves it to .env. Keys are only
//  ever written to .env, which git ignores.
// ============================================================

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const readline = require("readline");
const { presets } = require("../backend/ai/providers");

const ROOT = path.join(__dirname, "..");
const ENV_FILE = path.join(ROOT, ".env");
const EXAMPLE_FILE = path.join(ROOT, ".env.example");

const CHOICES = [
	{ key: "groq", label: "Groq - free, very fast", preset: presets.groq },
	{ key: "gemini", label: "Google Gemini - free", preset: presets.gemini },
	{
		key: "claude",
		label: "Claude - paid per message, most capable",
		keyEnv: "ANTHROPIC_API_KEY",
		keyUrl: "https://console.anthropic.com/settings/keys",
	},
];

// Model families that handle tool use well, in order of preference, used
// when a provider has retired the default model
const PREFERRED_MODELS = {
	groq: [/^openai\/gpt-oss-120b$/, /^openai\/gpt-oss/, /^llama-3\.3-70b/, /^llama/, /^qwen/],
	gemini: [/^gemini-flash-lite-latest$/, /^gemini-[\d.]+-flash-lite$/, /^gemini-flash-latest$/],
};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (question) => new Promise((resolve) => rl.question(question, resolve));

// Reads a line without echoing it, so the key doesn't show on screen
function askHidden(question) {
	return new Promise((resolve) => {
		const write = rl._writeToOutput;
		rl._writeToOutput = (text) => {
			if (text.includes(question)) write.call(rl, text);
			else write.call(rl, "*".repeat(text.trim() ? 1 : 0));
		};
		rl.question(question, (answer) => {
			rl._writeToOutput = write;
			process.stdout.write("\n");
			resolve(answer.trim());
		});
	});
}

// Sets KEY=value in .env text, replacing (or uncommenting) an existing line
function setEnv(text, key, value) {
	const line = `${key}=${value}`;
	const pattern = new RegExp(`^#?\\s*${key}=.*$`, "m");
	return pattern.test(text) ? text.replace(pattern, line) : `${text.trimEnd()}\n${line}\n`;
}

function ensureEnvFile() {
	if (fs.existsSync(ENV_FILE)) return fs.readFileSync(ENV_FILE, "utf8");
	let text = fs.readFileSync(EXAMPLE_FILE, "utf8");
	text = setEnv(text, "JWT_SECRET", crypto.randomBytes(32).toString("hex"));
	fs.writeFileSync(ENV_FILE, text);
	console.log("Created .env with a new login secret.");
	return text;
}

// Checks the key and finds a model that really answers with it. Being in the
// model list isn't enough: providers list models they no longer serve to new
// users, or whose free limits are too small. Returns null for the default.
async function checkHostedKey(choice, key) {
	const { preset } = choice;
	const models = await preset.listModels(key);
	const candidates = [
		preset.defaultModel,
		...PREFERRED_MODELS[choice.key].flatMap((pattern) => models.filter((id) => pattern.test(id))),
	].filter((id, i, all) => all.indexOf(id) === i);
	for (const model of candidates) {
		if (await preset.tryModel(key, model)) {
			if (model !== preset.defaultModel) console.log(`(using the model ${model})`);
			return model === preset.defaultModel ? null : model;
		}
	}
	throw new Error(`The key works, but none of its models answered. Available: ${models.slice(0, 10).join(", ")}`);
}

async function checkClaudeKey(key) {
	const { Anthropic } = require("@anthropic-ai/sdk");
	const client = new Anthropic({ apiKey: key });
	await client.models.list({ limit: 1 }); // free call that only works with a valid key
}

async function main() {
	console.log("\nAI assistant setup for La Extravaganza\n");
	let env = ensureEnvFile();

	CHOICES.forEach((c, i) => console.log(`  ${i + 1}. ${c.label}`));
	const answer = await ask("\nWhich AI should Aria use? [1] ");
	const choice = CHOICES[(parseInt(answer, 10) || 1) - 1];
	if (!choice) throw new Error("Please run again and choose 1, 2 or 3.");

	// "auto" lets Aria switch between every provider that has a key
	env = setEnv(env, "AI_PROVIDER", "auto");
	env = await addKey(choice, env);
	fs.writeFileSync(ENV_FILE, env);
	console.log("Saved to .env.");

	// A second free provider means Aria keeps working when one hits its limit
	const backup = CHOICES.find((c) => c.preset && c !== choice);
	const hasBackupKey = new RegExp(`^${backup.preset.keyEnv}=.+`, "m").test(env);
	if (choice.preset && !hasBackupKey) {
		const yes = await ask(
			`\nAdd ${backup.preset.label} as a free backup? Aria switches to it by itself ` +
				`when the ${choice.preset.label} free limit is reached. [Y/n] `,
		);
		if (!/^n/i.test(yes.trim())) {
			try {
				env = await addKey(backup, env);
				fs.writeFileSync(ENV_FILE, env);
				console.log("Saved to .env.");
			} catch (err) {
				console.log(`\nSkipped the backup: ${err.message}`);
			}
		}
	}

	console.log(`\nAll set. Start the site with: npm run dev`);
	console.log("Keep keys private: never commit .env or paste a key into code.\n");
}

// Asks for one provider's key, checks it, and returns the updated .env text
async function addKey(choice, env) {
	const keyEnv = choice.preset?.keyEnv || choice.keyEnv;
	const keyUrl = choice.preset?.keyUrl || choice.keyUrl;
	console.log(`\nCreate a key at ${keyUrl} (sign in, then "Create API key").`);
	const key = await askHidden(`Paste the key here and press Enter: `);
	if (!key) throw new Error("No key entered.");

	process.stdout.write("Checking the key... ");
	let model = null;
	if (choice.preset) model = await checkHostedKey(choice, key);
	else await checkClaudeKey(key);
	console.log("it works.");

	env = setEnv(env, keyEnv, key);
	if (model) env = setEnv(env, choice.preset.modelEnv, model);
	return env;
}

main()
	.catch((err) => {
		console.error(`\nSetup stopped: ${err.message}\n`);
		process.exitCode = 1;
	})
	.finally(() => rl.close());
