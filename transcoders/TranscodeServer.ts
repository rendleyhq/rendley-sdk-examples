import {
  TranscodeControl,
  TranscodeControlStateEnum,
  TranscodeMediaDetails,
  TranscodeProgressInfo,
  TranscodeSupportType,
  ITranscodeProvider,
  TranscodeResult,
} from "../ITranscodeProvider";

export class TranscodeServer implements ITranscodeProvider {
  init(): Promise<void> {
    return Promise.resolve();
  }
  destroy(): Promise<void> {
    return Promise.resolve();
  }

  async supportsInput(mediaMetadata: TranscodeMediaDetails): Promise<boolean> {
    // For this example only support videos
    if (mediaMetadata.mimeType?.split("/")[0] === "video") {
      return true;
    }
    const videoFormats = ["mp4", "mkv", "avi", "mov", "wmv", "flv", "webm", "ts"]; // Add more?
    const extension = mediaMetadata.fileName?.split(".")[1]?.toLowerCase() ?? "";
    if (videoFormats.indexOf(extension) >= 0) {
      return true;
    }
    const urlExtension = mediaMetadata.url?.split(".")[1]?.toLowerCase() ?? "";
    if (videoFormats.indexOf(urlExtension) >= 0) {
      return true;
    }
    return false;
  }
  async supportsOutput(outputType: TranscodeSupportType): Promise<boolean> {
    // For this example only support videos
    if (outputType.mimeType == "video/mp4") return true;
    return false;
  }
  async supportsInputURL(): Promise<boolean> {
    return false;
  }
  async transcode(
    source: Uint8Array | URL,
    mediaMetadata: TranscodeMediaDetails,
    outputType: TranscodeSupportType,
    control: TranscodeControl,
    progressCallback?: (progressInfo: TranscodeProgressInfo) => void,
  ): Promise<TranscodeResult | null> {
    progressCallback?.({ state: "Initializing", progress: 0 });

    // Check if somehow we got an URL source (we shouldn't) but also automatically sets the source type to Uint8Array for later use
    if (source instanceof URL) {
      console.error("Transcoder doesn't support URLs!");
      return null;
    }

    // Send our data
    let jobId = "";
    try {
      const mimeType = mediaMetadata.mimeType ?? "";
      const filename = mediaMetadata.fileName ?? "input.raw";
      const response = await fetch(`https://localhost:3000/transcode?mimeType=${mimeType}&filename=${filename}`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: source,
      }).then((res) => res.json());

      console.log(response);
      jobId = response.jobId;
    } catch (err) {
      console.error("Error during transcoding fetch", err);
      throw err;
    }

    control.isRead = true;

    let url = "";
    // Wait for the job to finish
    const success = await new Promise<boolean>((resolve) => {
      const check = async () => {
        // We got an early cancel request
        if (control.state == TranscodeControlStateEnum.CANCEL) {
          // You could ping the server here that we don't need the file any longer
          console.log("Received a cancel request, stopping transcoding");
          control.isRead = true; // Always set the read flag to confirm we received the control data and responded to it
          resolve(false);
          return;
        }

        try {
          const jobResponse = await fetch(`https://localhost:3000/status/${jobId}`).then((res) => res.json());

          if (jobResponse.status === "processing") {
            console.log("Job is still processing...", jobResponse.progress);
            progressCallback?.({ state: "Transcoding", progress: jobResponse.progress / 100 }); // Our server reports percentage, convert to normalized value
            setTimeout(check, 1000);
          } else if (jobResponse.status === "completed") {
            console.log("Job completed!");
            progressCallback?.({ state: "Done", progress: 1 });
            url = jobResponse.result;
            resolve(true);
          } else {
            console.log("Job failed!");
            resolve(false);
          }
        } catch (err) {
          console.error("Error during transcoding fetch", err);
          resolve(false);
        }
      };
      check();
    });

    if (success) {
      return {
        source: new URL(url),
        extension: url.split(".")[1],
        mimeType: outputType.mimeType,
      };
    }

    return null;
  }
}
