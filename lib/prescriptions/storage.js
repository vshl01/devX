import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const UPLOAD_ROOT = path.join(/*turbopackIgnore: true*/ process.cwd(), 'uploads');

/**
 * Persist an uploaded prescription file locally and return a relative reference.
 *
 * @param {{ buffer: Buffer, fileName: string }} file
 * @returns {Promise<{ absolutePath: string, relativePath: string }>}
 */
export async function storePrescriptionFile(file) {
  await mkdir(UPLOAD_ROOT, { recursive: true });
  const safeName = file.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storedName = `${Date.now()}_${randomUUID()}_${safeName}`;
  const absolutePath = path.join(UPLOAD_ROOT, storedName);
  await writeFile(absolutePath, file.buffer);
  return {
    absolutePath,
    relativePath: path.posix.join('uploads', storedName),
  };
}

/**
 * @param {string} relativePath
 * @returns {string}
 */
export function resolveStoredFilePath(relativePath) {
  const absolute = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(/*turbopackIgnore: true*/ process.cwd(), relativePath);
  const normalizedRoot = path.normalize(UPLOAD_ROOT + path.sep);
  const normalizedTarget = path.normalize(absolute);
  if (!normalizedTarget.startsWith(normalizedRoot)) {
    throw new Error('Invalid file reference');
  }
  return absolute;
}
