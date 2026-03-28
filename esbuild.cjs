const esbuild = require("esbuild");
const args = process.argv.slice(2);
const isWatch = args.includes("--watch");

const options = {
	entryPoints: ["./source/index.ts"],
	bundle: true,
	sourcemap: true,
	sourcesContent: false,
	logLevel: "info",
	minify: false,
	format: "esm",
	target: "es2023",
	outfile: "scripts/index.esm.js",
	platform: "neutral",
	external: ["@minecraft/server", "@minecraft/server-ui"]
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