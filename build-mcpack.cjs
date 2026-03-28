const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

const MCPACK_FILENAME = "addon.mcpack";
const OUTPUT_DIRECTORY_NAME = "_temp_mcpack_directory";
const OUTPUT_DIRECTORY_PATH = path.join(__dirname, OUTPUT_DIRECTORY_NAME);

const SKIP_DIRECTORIES = [".vscode", "node_modules", "source", OUTPUT_DIRECTORY_NAME];
const SKIP_FILES = [
	"build-mcpack.cjs",
	"esbuild.cjs",
	"package.json",
	"pnpm-lock.yaml",
	"pnpm-workspace.yaml",
	"tsconfig.json",
	MCPACK_FILENAME
];

async function copyDirectory(source, destination) {
	await fs.promises.mkdir(destination, { recursive: true });
	for (const entry of await fs.promises.readdir(source, { withFileTypes: true })) {
		const name = entry.name;
		const sourcePath = path.join(source, name);
		const destinationPath = path.join(destination, name);
		if (entry.isDirectory()) {
			if (SKIP_DIRECTORIES.includes(name)) continue;
			await copyDirectory(sourcePath, destinationPath);
		} else {
			if (SKIP_FILES.includes(name)) continue;
			await fs.promises.copyFile(sourcePath, destinationPath);
		}
	}
}

async function createZip(sourceDir, outputFilePath) {
	return new Promise((resolve, reject) => {
		const output = fs.createWriteStream(outputFilePath);
		const archive = archiver("zip", { zlib: { level: 9 } });

		output.on("close", resolve);
		archive.on("error", reject);

		archive.pipe(output);
		archive.directory(sourceDir, false);
		archive.finalize();
	});
}

async function build() {
	try {
		await fs.promises.rm(OUTPUT_DIRECTORY_PATH, { recursive: true, force: true }).catch(() => { });

		console.log(`Starting build in: ${__dirname}`);
		console.log("Cleaning up old output directory...");
		await fs.promises.rm(OUTPUT_DIRECTORY_PATH, { recursive: true, force: true });

		console.log(`Creating temporary directory at: ${OUTPUT_DIRECTORY_PATH}`);
		await copyDirectory(__dirname, OUTPUT_DIRECTORY_PATH);
		console.log("Successfully copied files.");

		const zipFilePath = path.join(__dirname, MCPACK_FILENAME);
		console.log(`Zipping contents to ${MCPACK_FILENAME}...`);
		await createZip(OUTPUT_DIRECTORY_PATH, zipFilePath);
		console.log("Successfully created addon.mcpack.");

		console.log("Deleting temporary output directory...");
		await fs.promises.rm(OUTPUT_DIRECTORY_PATH, { recursive: true, force: true });
		console.log("Cleanup complete.");

		console.log("\nBuild finished successfully!");
	} catch (error) {
		console.error("\nAn error occurred during the build process:");
		console.error(error);
		process.exit(1);
	}
}

build();
