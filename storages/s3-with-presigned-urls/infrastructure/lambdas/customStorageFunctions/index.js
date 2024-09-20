import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ region: process.env.AWS_REGION });
const BUCKET_NAME = process.env.STORAGE_BUCKET;

// Generates a presigned url for uploading the files
export const getPresignedUrlForUploading = async (event) => {
  try {
    // Parse query string parameters
    const queryStringParameters = event.queryStringParameters || {};
    const { hash, projectId } = queryStringParameters;

    if (!hash || !projectId) {
      return createResponse(400, {
        error: "Missing hash or projectId parameter",
      });
    }

    const expiresIn = 60 * 5; // 5 minutes
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${projectId}/${hash}`,
    });

    const data = await getSignedUrl(s3, command, { expiresIn });

    return createResponse(200, {
      data,
    });
  } catch (err) {
    console.error("Error generating presigned URL:", err);

    return createResponse(500, {
      error: err.message,
    });
  }
};

// generates a presigned url for retreiving a file
export const getPresignedUrlForRetreiving = async (event) => {
  try {
    // Parse query string parameters
    const queryStringParameters = event.queryStringParameters || {};
    const { hash, projectId } = queryStringParameters;

    if (!hash || !projectId) {
      return createResponse(400, {
        error: "Missing hash or projectId parameter",
      });
    }

    const expiresIn = 60 * 5; // 5 minutes
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${projectId}/${hash}`,
    });

    const data = await getSignedUrl(s3, command, { expiresIn });

    return createResponse(200, {
      data,
    });
  } catch (err) {
    console.error("Error generating presigned URL:", err);

    return createResponse(500, {
      error: err.message,
    });
  }
};

// deletes a file
export const deleteFile = async (event) => {
  try {
    // Parse query string parameters
    const queryStringParameters = event.queryStringParameters || {};
    const { hash, projectId } = queryStringParameters;

    if (!hash || !projectId) {
      return createResponse(400, {
        error: "Missing hash or projectId parameter",
      });
    }

    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${projectId}/${hash}`,
    });
    await s3.send(command);

    return createResponse(200, {
      data: true,
    });
  } catch (err) {
    console.error("Error generating presigned URL:", err);

    return createResponse(500, {
      error: err.message,
    });
  }
};

// lists all the filenames
export const listFilesHashes = async (event) => {
  try {
    // Parse query string parameters
    const queryStringParameters = event.queryStringParameters || {};
    const { projectId } = queryStringParameters;

    if (!projectId) {
      return createResponse(400, {
        error: "Missing projectId parameter",
      });
    }

    const prefix = `${projectId}/`;

    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
    });
    const data = await s3.send(command);

    // Extract file names from the objects and remove the prefix
    const fileNames =
      data.Contents?.map((obj) => {
        return obj.Key.startsWith(prefix)
          ? obj.Key.substring(prefix.length)
          : obj.Key;
      }) || [];

    return createResponse(200, {
      data: fileNames,
    });
  } catch (err) {
    console.error("Error generating presigned URL:", err);

    return createResponse(500, {
      error: err.message,
    });
  }
};

async function createResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "*",
    },
    body: JSON.stringify(body),
  };
}
