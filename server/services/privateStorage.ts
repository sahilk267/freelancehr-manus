import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { storageGetSignedUrl, storagePut } from "../storage";

type PrivateStorageMode = "managed" | "s3";

function getMode(): PrivateStorageMode {
  const configured = process.env.PRIVATE_STORAGE_MODE?.trim().toLowerCase();
  if (configured === "s3") return "s3";
  if (configured === "managed") return "managed";
  return process.env.NODE_ENV === "production" ? "s3" : "managed";
}

function normalizeKey(value: string) {
  return value.replace(/^\/+/, "");
}

function requiredS3Config() {
  const values = {
    bucket: process.env.STORAGE_BUCKET?.trim(),
    region: process.env.STORAGE_REGION?.trim(),
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID?.trim(),
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY?.trim(),
  };
  const missing = Object.entries(values).filter(([, value]) => !value).map(([key]) => key);
  return { values, missing };
}

function getS3Client() {
  const { values, missing } = requiredS3Config();
  if (missing.length) throw new Error(`Private storage is not configured; missing ${missing.join(", ")}.`);
  return {
    bucket: values.bucket!,
    client: new S3Client({
      region: values.region!,
      endpoint: process.env.STORAGE_ENDPOINT?.trim() || undefined,
      forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === "true",
      credentials: { accessKeyId: values.accessKeyId!, secretAccessKey: values.secretAccessKey! },
    }),
  };
}

export function getPrivateStorageStatus() {
  const mode = getMode();
  const { missing } = requiredS3Config();
  return { mode, configured: mode === "managed" || missing.length === 0, missing: mode === "s3" ? missing : [] };
}

export async function putPrivateDocument(relKey: string, data: Buffer | Uint8Array | string, contentType: string) {
  const mode = getMode();
  if (mode === "managed") return storagePut(relKey, data, contentType);
  const key = normalizeKey(relKey);
  const { bucket, client } = getS3Client();
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: data, ContentType: contentType, ServerSideEncryption: "AES256" }));
  return { key, url: `private://s3/${key}` };
}

export async function getPrivateDocumentUrl(relKey: string, expiresInSeconds = 300) {
  const key = normalizeKey(relKey);
  const boundedExpiry = Math.max(60, Math.min(expiresInSeconds, 900));
  if (getMode() === "managed") return storageGetSignedUrl(key);
  const { bucket, client } = getS3Client();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: boundedExpiry });
}
