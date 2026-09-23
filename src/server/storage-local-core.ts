
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, rename, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import type { FileHandle } from "node:fs/promises";
import type { StoredObject, StoredObjectMetadata } from "./storage";

function missing(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
async function assertNoSymlink(path: string) {
  const info = await lstat(path);
  if (info.isSymbolicLink()) throw new Error("Local storage does not allow symbolic links");
  return info;
}
async function objectPath(key: string) {
  const root = resolve(process.env.STORAGE_LOCAL_DIR?.trim() || "storage");
  // The volume is private to the application; never share write access with untrusted users.
  // Check ancestors before mkdir so an existing symlink cannot redirect directory creation.
  const ancestors: string[] = [];
  for (let path = root; ; path = dirname(path)) {
    ancestors.unshift(path);
    if (dirname(path) === path) break;
  }
  for (const path of ancestors) {
    try { await assertNoSymlink(path); } catch (error) { if (!missing(error)) throw error; }
  }
  await mkdir(root, { recursive: true, mode: 0o700 });
  for (const path of ancestors) await assertNoSymlink(path);
  return join(root, createHash("sha256").update(key).digest("hex") + ".object");
}
async function assertObjectFile(path: string) {
  const info = await assertNoSymlink(path);
  if (!info.isFile()) throw new Error("Invalid local storage object");
}

// A single envelope keeps bytes and metadata consistent across atomic replacement.
export async function putLocalObject(info: StoredObjectMetadata, bytes: Uint8Array): Promise<StoredObjectMetadata> {
  const path = await objectPath(info.key);
  try { await assertObjectFile(path); } catch (error) { if (!missing(error)) throw error; }
  const temporary = path + "." + randomUUID() + ".tmp";
  let handle: FileHandle | undefined;
  try {
    handle = await open(temporary, "wx", 0o600);
    await handle.writeFile(Buffer.from(JSON.stringify(info) + "\n", "utf8"));
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    // Windows may briefly lock a destination during concurrent atomic replacements.
    for (let attempt = 0; ; attempt++) {
      try { await rename(temporary, path); break; } catch (error) {
        if (process.platform !== "win32" || attempt >= 5 || !(error instanceof Error) ||
            !("code" in error) || (error.code !== "EPERM" && error.code !== "EACCES")) throw error;
        await setTimeout(10 * (attempt + 1));
      }
    }
  } finally {
    await handle?.close();
    await unlink(temporary).catch(error => { if (!missing(error)) throw error; });
  }
  return info;
}
async function inspect(key: string, includeBytes: boolean): Promise<StoredObject | StoredObjectMetadata | null> {
  const path = await objectPath(key);
  let handle: FileHandle | undefined;
  try {
    await assertObjectFile(path);
    handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error("Invalid local storage object");
    const prefix = Buffer.alloc(8192);
    const { bytesRead } = await handle.read(prefix, 0, prefix.length, 0);
    const end = prefix.subarray(0, bytesRead).indexOf(10);
    if (end < 0) throw new Error("Invalid local storage metadata");
    const data: unknown = JSON.parse(prefix.subarray(0, end).toString("utf8"));
    if (!data || typeof data !== "object" || !("key" in data) || data.key !== key ||
        !("contentType" in data) || typeof data.contentType !== "string" ||
        !data.contentType || data.contentType.length > 256 || /[^\x20-\x7e]/.test(data.contentType) || !data.contentType.includes("/") ||
        !("size" in data) || typeof data.size !== "number" || !Number.isSafeInteger(data.size) || data.size < 0 ||
        stat.size !== end + 1 + data.size) throw new Error("Invalid local storage metadata");
    const info: StoredObjectMetadata = { key, contentType: data.contentType, size: data.size };
    if (!includeBytes) return info;
    const bytes = Buffer.alloc(info.size);
    let offset = 0;
    while (offset < bytes.length) {
      const read = await handle.read(bytes, offset, bytes.length - offset, end + 1 + offset);
      if (!read.bytesRead) throw new Error("Stored object size mismatch");
      offset += read.bytesRead;
    }
    return { ...info, bytes };
  } catch (error) {
    if (missing(error)) return null;
    throw error;
  } finally {
    await handle?.close();
  }
}
export async function headLocalObject(key: string): Promise<StoredObjectMetadata | null> {
  return inspect(key, false);
}
export async function readLocalObject(key: string): Promise<StoredObject | null> {
  const result = await inspect(key, true);
  if (result && "bytes" in result) return result;
  return null;
}
export async function deleteLocalObject(key: string) {
  const path = await objectPath(key);
  try {
    await assertObjectFile(path);
    await unlink(path);
  } catch (error) { if (!missing(error)) throw error; }
}


