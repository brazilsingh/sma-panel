import { createHash, randomUUID } from '../node-shim.mjs';
import { mkdir, readFile, writeFile } from '../node-shim.mjs';
import { join } from '../node-shim.mjs';
import { invalid, notFound } from './errors.mjs';

export const MEDIA_TYPES = {
  'image/png': { ext: 'png', sniff: b => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/jpeg': { ext: 'jpg', sniff: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/gif': { ext: 'gif', sniff: b => b.subarray(0, 4).toString('latin1') === 'GIF8' },
  'image/webp': { ext: 'webp', sniff: b => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' }
};
export const MAX_MEDIA_BYTES = 8 * 1024 * 1024;

/** Accepts a data URL or base64 string. Returns { mimeType, bytes }. */
export function decodeUpload({ dataUrl, base64, mimeType }) {
  let type = mimeType;
  let payload = base64;
  if (dataUrl) {
    const m = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
    if (!m) throw invalid('Send the graphic as a base64 data URL.');
    [, type, payload] = m;
  }
  if (!payload) throw invalid('Attach a graphic.');
  const info = MEDIA_TYPES[type];
  if (!info) throw invalid('Use a PNG, JPEG, GIF, or WebP graphic.');
  const bytes = Buffer.from(payload, 'base64');
  if (!bytes.length) throw invalid('The graphic is empty.');
  if (bytes.length > MAX_MEDIA_BYTES) throw invalid('Choose a graphic under 8 MB.');
  if (!info.sniff(bytes)) throw invalid('The file content does not match ' + type + '.');
  return { mimeType: type, bytes };
}

export function createMediaLibrary(dataDir) {
  const dir = join(dataDir, 'media');
  return {
    async put({ name, mimeType, bytes }) {
      await mkdir(dir, { recursive: true });
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      const file = sha256 + '.' + MEDIA_TYPES[mimeType].ext;
      await writeFile(join(dir, file), bytes);
      return { id: randomUUID(), name: String(name || 'graphic').slice(0, 200), mimeType, size: bytes.length, sha256, file };
    },
    /** Reads the stored bytes and verifies they are exactly what was submitted. */
    async read(record) {
      if (!record) throw notFound('Graphic not found.');
      const bytes = await readFile(join(dir, record.file)).catch(() => null);
      if (!bytes) throw notFound('The stored graphic ' + record.name + ' is missing from the media folder.');
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      if (sha256 !== record.sha256) throw new Error('The stored graphic ' + record.name + ' has changed on disk since it was submitted.');
      return bytes;
    }
  };
}
