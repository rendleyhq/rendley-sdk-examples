import express from "express";
import https from "https";
import fs from "fs";
import { randomUUID } from "crypto";
import { writeFile, mkdir, access, unlink } from "fs/promises";
import { spawn } from "child_process";
import path from "path";

const app = express();
const port = 3000;

// Only needed for HTTPS
const options = {
	key: fs.readFileSync("tmp_certificates/key.pem"), // Path to private key
	cert: fs.readFileSync("tmp_certificates/cert.pem"), // Path to certificate
};

const jobs = new Map();

app.use((req, res, next) => {
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Headers", "*");
	next();
});

app.use(express.raw({ type: "application/octet-stream", limit: "10000mb" }));

app.use("/", express.static("www"));

app.use("/out", express.static("out"));

app.post("/transcode", async (req, res) => {
	const body = req.body;

	const mimeType = req.query.mimeType || "video/*";

	if (!body) {
		return res.status(400).json({ message: "No body" });
	}

	const jobId = randomUUID();

	try {
		await writeRawFile(getInputFilePath(jobId), body);

		jobs.set(jobId, {
			status: "processing",
			started: Date.now(),
			progress: 0,
			error: null,
			outputFile: getOutputFilePath(jobId, mimeType),
		});

		// Start transcoding in background
		transcodeInBackground(jobId, mimeType);

		res.status(202).json({
			jobId,
			message: "Transcoding started",
		});
	} catch (error) {
		console.error("Upload error:", error);

		res.status(500).json({
			message: "Upload failed",
			error: error.message,
		});
	}
});

app.get("/status/:jobId", async (req, res) => {
	const { jobId } = req.params;
	const job = jobs.get(jobId);

	if (!job) {
		return res.status(404).json({
			message: "Job not found",
		});
	}

	res.status(200).json(job);
});

app.delete("/:jobId", async () => {
	const jobId = req.params.jobId;

	if (!jobs.has(jobId)) {
		return res.status(404).json({
			message: "Job not found",
		});
	}

	await safelyRemoveFile(getOutputFilePath(job.outputFile));
	jobs.delete(jobId);

	return res.status(200).json({});
});

// ===

async function ensureDirectoryExists(dirPath) {
	try {
		await access(dirPath);
	} catch {
		await mkdir(dirPath, { recursive: true });
	}
}

async function safelyRemoveFile(filePath) {
	try {
		await access(filePath);
		await unlink(filePath);
	} catch {}
}

async function writeRawFile(filePath, buffer) {
	await ensureDirectoryExists(path.dirname(filePath));
	return await writeFile(filePath, buffer);
}

function getInputFilePath(jobId) {
	return `./bin/${jobId}.raw`;
}

function getOutputExtension(mimeType) {
	const type = mimeType.split("/")[0];

	if (type === "image") {
		return "webp";
	} else if (type === "audio") {
		return "aac";
	} else if (type === "video") {
		return "mp4";
	} else {
		return "mp4";
	}
}

function getOutputFilePath(jobId, mimeType) {
	return `./out/${jobId}.${getOutputExtension(mimeType)}`;
}

function getOutputMimeType(mimeType) {
	const type = mimeType.split("/")[0];

	if (type === "image") {
		return "image/webp";
	} else if (type === "audio") {
		return "audio/aac";
	} else if (type === "video") {
		return "video/mp4";
	} else {
		return "video/mp4";
	}
}

function getTotalPackets(inputFile) {
	return new Promise((resolve, reject) => {
		const ffprobe = spawn("ffprobe", ["-v", "error", "-select_streams", "v:0", "-count_packets", "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", inputFile]);

		ffprobe.stdout.on("data", (data) => {
			const totalPackets = parseInt(data.toString(), 10);
			resolve(totalPackets);
		});

		ffprobe.stderr.on("data", (data) => {
			console.error(`FFprobe STDERR: ${data}`);
		});

		ffprobe.on("error", (err) => {
			reject(`Failed to start FFprobe: ${err}`);
		});

		ffprobe.on("close", (code) => {
			if (code !== 0) {
				reject(`FFprobe exited with code: ${code}`);
			}
		});
	});
}

function getTranscodingParamsByMimeType(mimeType) {
	const type = mimeType.split("/")[0];

	switch (type) {
		case "audio":
			return ["-c:a", "aac"];
		case "image":
			return ["-c:v", "webp"];
		case "video":
		default:
			return ["-c:v", "libx264", "-crf", "23"];
	}
}

async function transcodeInBackground(jobId, mimeType) {
	const inputFile = getInputFilePath(jobId);
	const outputFile = getOutputFilePath(jobId, mimeType);

	try {
		await ensureDirectoryExists("./out");

		await new Promise(async (resolve, reject) => {
			const totalPackets = await getTotalPackets(inputFile);

			const params = ["-i", inputFile, ...getTranscodingParamsByMimeType(mimeType), "-progress", "pipe:1", outputFile];

			const ffmpeg = spawn("ffmpeg", params);

			// Listen for data from stderr (for progress info)
			ffmpeg.stderr.on("data", (data) => {
				const output = data.toString();

				// Parse progress data for packets processed
				// Update the regex to match the correct output structure
				const frameMatch = output.match(/frame=\s*(\d+).*?fps=\s*(\d+)/);
				const packetsMatch = output.match(/frame=\s*(\d+).*?fps=\s*\d+.*?time=(\d+:\d+:\d+\.\d+)/);

				if (packetsMatch && frameMatch) {
					const currentFrame = parseInt(frameMatch[1], 10);

					// Use currentFrame for percentage calculation, as packets might not be reported
					const progressPercentage = ((currentFrame / totalPackets) * 100).toFixed(2);

					jobs.set(jobId, {
						...jobs.get(jobId),
						progress: progressPercentage,
					});
				}
			});

			// Handle process exit
			ffmpeg.on("close", (code) => {
				if (code === 0) {
					resolve();
				} else {
					reject(code);
				}
			});
		});

		const resultURL = `https://localhost:3000/out${outputFile.replace("./out", "")}`;

		jobs.set(jobId, {
			...jobs.get(jobId),
			status: "completed",
			completed: Date.now(),
			result: resultURL,
			extension: getOutputExtension(mimeType),
			mimeType: getOutputMimeType(mimeType),
			error: null,
		});
	} catch (error) {
		console.error("Transcoding error:", error);
		jobs.set(jobId, {
			...jobs.get(jobId),
			status: "failed",
			error: error.message,
		});
	} finally {
		await Promise.all([
			safelyRemoveFile(inputFile),
			// safelyRemoveFile(outputFile),
		]);
	}
}

/* http
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
*/

// Start HTTPS Server
https.createServer(options, app).listen(port, () => {
	console.log(`HTTPS Server running on https://localhost:${port}`);
});
