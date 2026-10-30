// Tailwind is built ahead of time (npm run build:css) instead of in the
// browser, so pages don't download and run the 400 KB Play CDN script.
// Re-run the build after adding new Tailwind classes to any page or script.
/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./frontend/pages/**/*.html", "./frontend/js/**/*.js"],
	theme: { extend: {} },
	plugins: [],
};
