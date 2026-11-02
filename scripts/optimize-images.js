// Converts the site's JPG photos to WebP, which is much smaller for the same
// quality. Room photos also get a 640px version for cards and thumbnails
// (used through srcset by UI.photo in frontend/js/ui.js).
//
//   npm run images                       convert, keep the JPGs
//   npm run images -- --remove-originals convert, then delete the JPGs
//
// Add a new photo as a JPG, run this, then reference the .webp file.
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "../frontend/images");
const QUALITY = 78;
const removeOriginals = process.argv.includes("--remove-originals");

function jpgs(dir) {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const full = path.join(dir, e.name);
		if (e.isDirectory()) return jpgs(full);
		return /\.jpe?g$/i.test(e.name) ? [full] : [];
	});
}

async function convert(file) {
	const isRoom = file.includes(`${path.sep}tiers${path.sep}`);
	const base = file.replace(/\.jpe?g$/i, "");
	const before = fs.statSync(file).size;

	// Big photos (hero, editorial) up to 1600px wide; room photos up to 1200px
	await sharp(file)
		.resize({ width: isRoom ? 1200 : 1600, withoutEnlargement: true })
		.webp({ quality: QUALITY })
		.toFile(base + ".webp");
	let after = fs.statSync(base + ".webp").size;

	if (isRoom) {
		await sharp(file).resize({ width: 640, withoutEnlargement: true }).webp({ quality: QUALITY }).toFile(base + "-640.webp");
		after += fs.statSync(base + "-640.webp").size;
	}
	if (removeOriginals) fs.unlinkSync(file);
	console.log(`${path.relative(ROOT, file).padEnd(36)} ${Math.round(before / 1024)} KB -> ${Math.round(after / 1024)} KB`);
	return { before, after };
}

(async () => {
	const files = jpgs(ROOT);
	if (!files.length) return console.log("No JPGs to convert.");
	let before = 0;
	let after = 0;
	for (const f of files) {
		const r = await convert(f);
		before += r.before;
		after += r.after;
	}
	console.log(`\n${files.length} photos: ${Math.round(before / 1024)} KB -> ${Math.round(after / 1024)} KB${removeOriginals ? " (JPGs removed)" : ""}`);
})();
