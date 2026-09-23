
import { addAbortSignal, Readable } from "node:stream";
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { deleteLocalObject, headLocalObject, putLocalObject, readLocalObject } from "./storage-local-core";

export type StorageBackend = "local" | "r2";
export interface StoredObjectMetadata {
  key: string;
  contentType: string;
  size: number;
}
export interface StoredObject extends StoredObjectMetadata {
  bytes: Uint8Array;
}

export function getStorageBackend(): StorageBackend {
  const backend = process.env.STORAGE_BACKEND?.trim();
  if (backend && backend !== "local" && backend !== "r2") {
    throw new Error("STORAGE_BACKEND must be local or r2");
  }
  if (backend === "local") return "local";
  const settings = [process.env.R2_ACCOUNT_ID, process.env.R2_ENDPOINT, process.env.R2_BUCKET,
    process.env.R2_ACCESS_KEY_ID, process.env.R2_SECRET_ACCESS_KEY];
  if (!backend && settings.every(value => !value?.trim())) return "local";
  if ((!process.env.R2_ACCOUNT_ID?.trim() && !process.env.R2_ENDPOINT?.trim()) ||
      !process.env.R2_BUCKET?.trim() || !process.env.R2_ACCESS_KEY_ID?.trim() ||
      !process.env.R2_SECRET_ACCESS_KEY?.trim()) {
    throw new Error("R2 requires R2_ACCOUNT_ID or R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY");
  }
  return "r2";
}

let client: S3Client | undefined;
export function getStorage() {
  if (getStorageBackend() !== "r2") {
    throw new Error("R2 client and signed URLs require STORAGE_BACKEND=r2; use the shared storage operations for local files");
  }
  return client ??= new S3Client({
    region: "auto",
    maxAttempts: 2,
    endpoint: process.env.R2_ENDPOINT || "https://" + process.env.R2_ACCOUNT_ID + ".r2.cloudflarestorage.com",
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
  });
}
function bucket() {
  getStorage();
  return process.env.R2_BUCKET!;
}
function validateKey(key: string) {
  if (!key || !key.isWellFormed() || Buffer.byteLength(key, "utf8") > 1024 || /[\\\x00-\x1f\x7f]/.test(key) ||
      key.split("/").some(segment => !segment || segment === "." || segment === "..")) {
    throw new Error("Invalid storage key");
  }
}
export function validateStorageContentType(contentType: string) {
  if (!contentType || contentType.length > 256 || /[^\x20-\x7e]/.test(contentType) || !contentType.includes("/")) {
    throw new Error("Invalid storage content type");
  }
}
function missingObject(error: unknown) {
  if (!error || typeof error !== "object") return false;
  return ("name" in error && (error.name === "NoSuchKey" || error.name === "NotFound")) ||
    ("$metadata" in error && typeof error.$metadata === "object" && error.$metadata !== null &&
      "httpStatusCode" in error.$metadata && error.$metadata.httpStatusCode === 404);
}
function metadata(key: string, contentType: string | undefined, size: number | undefined): StoredObjectMetadata {
  const type = contentType ?? "application/octet-stream";
  validateStorageContentType(type);
  if (size === undefined || !Number.isSafeInteger(size) || size < 0) throw new Error("Invalid stored object size");
  return { key, contentType: type, size };
}

// Authorization, purpose/type/size limits and server-generated keys belong to the caller.
export async function putStoredObject(key: string, bytes: Uint8Array, contentType = "application/octet-stream"): Promise<StoredObjectMetadata> {
  validateKey(key);
  validateStorageContentType(contentType);
  if (!(bytes instanceof Uint8Array)) throw new Error("Stored object bytes must be a Uint8Array");
  const result = metadata(key, contentType, bytes.byteLength);
  if (getStorageBackend() === "local") return putLocalObject(result, bytes);
  await getStorage().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: bytes, ContentType: contentType }), { abortSignal: AbortSignal.timeout(60_000) });
  return result;
}
export async function readStoredObject(key: string): Promise<StoredObject | null> {
  validateKey(key);
  if (getStorageBackend() === "local") return readLocalObject(key);
  try {
    const signal = AbortSignal.timeout(60_000);
    const result = await getStorage().send(new GetObjectCommand({ Bucket: bucket(), Key: key }), { abortSignal: signal });
    if (!result.Body) throw new Error("Stored object response has no body");
    // The HTTP request can finish before its body; retain the same deadline while reading.
    if (result.Body instanceof Readable) addAbortSignal(signal, result.Body);
    const bytes = await result.Body.transformToByteArray();
    const info = metadata(key, result.ContentType, result.ContentLength);
    if (info.size !== bytes.byteLength) throw new Error("Stored object size mismatch");
    return { ...info, bytes };
  } catch (error) {
    if (missingObject(error)) return null;
    throw error;
  }
}
export async function headStoredObject(key: string): Promise<StoredObjectMetadata | null> {
  validateKey(key);
  if (getStorageBackend() === "local") return headLocalObject(key);
  try {
    const result = await getStorage().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }), { abortSignal: AbortSignal.timeout(60_000) });
    return metadata(key, result.ContentType, result.ContentLength);
  } catch (error) {
    if (missingObject(error)) return null;
    throw error;
  }
}
export async function deleteStoredObject(key: string): Promise<void> {
  validateKey(key);
  if (getStorageBackend() === "local") return deleteLocalObject(key);
  await getStorage().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }), { abortSignal: AbortSignal.timeout(60_000) });
}
// R2-only direct transfers. Local downloads must use an authorized application route.
export async function signUpload(key: string, contentType: string, expiresIn = 300) {
  validateKey(key);
  validateStorageContentType(contentType);
  return getSignedUrl(getStorage(), new PutObjectCommand({
    Bucket: bucket(), Key: key, ContentType: contentType,
  }), { expiresIn });
}
export async function signDownload(key: string, expiresIn = 300) {
  validateKey(key);
  return getSignedUrl(getStorage(), new GetObjectCommand({
    Bucket: bucket(), Key: key,
  }), { expiresIn });
}



