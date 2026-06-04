// biome-ignore-all lint/suspicious/noConsole: intended logging

const esbuild = require("esbuild");
const args = process.argv.slice(2);
const isWatch = args.includes("--watch");

const options = {
	bundle: true,
	entryPoints: ["./source/index.ts"],
	external: ["@minecraft/server", "@minecraft/server-ui"],
	format: "esm",
	logLevel: "info",
	minify: false,
	outfile: "scripts/index.esm.js",
	platform: "neutral",
	sourcemap: false,
	sourcesContent: false,
	target: "es2023",
};

(async () => {
	const ctx = await esbuild.context(options);
	if (isWatch) {
		await ctx.watch();
		console.log(`Watching to outfile: ${options.outfile}`);
	} else {
		await ctx.rebuild();
		await ctx.dispose();
		console.log(`Built outfile: ${options.outfile}`);
	}
})();
