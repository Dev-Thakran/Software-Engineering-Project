module.exports = [
	{
		files: ["**/*.js"],
		languageOptions: {
			ecmaVersion: "latest",
			sourceType: "commonjs",
			globals: {
				// Node.js globals
				__dirname: "readonly",
				__filename: "readonly",
				process: "readonly",
				console: "readonly",
				require: "readonly",
				module: "readonly",
				exports: "readonly",
				Buffer: "readonly",
				setTimeout: "readonly",
				setInterval: "readonly",
			},
		},
		rules: {
			complexity: ["warn", 10],
			"no-unused-vars": "warn",
			"no-undef": "warn",
		},
	},
];
