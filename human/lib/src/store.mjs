import { mkdir, open, readFile, rename, rm } from '../node-shim.mjs';
import { join } from '../node-shim.mjs';

const SCHEMA_VERSION = 1;
const empty = () => ({ schemaVersion: SCHEMA_VERSION, jobs: {}, idempotency: {}, media: {}, events: [], seq: 0 });

/**
 * Durable JSON store. Every change is written to a temporary file, flushed to disk and
 * renamed over the previous file, so a crash leaves either the old or the new state,
 * never a torn file. Writes are serialised. One server process should own a data directory.
 */
export async function openFileStore(dataDir) {
  await mkdir(dataDir, { recursive: true });
  const file = join(dataDir, 'queue.json');
  const temp = file + '.tmp';
  let state;
  try {
    state = JSON.parse(await readFile(file, 'utf8'));
    if (state.schemaVersion !== SCHEMA_VERSION) throw new Error('Unsupported queue schema version ' + state.schemaVersion);
    state = { ...empty(), ...state };
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('Could not read the publishing queue at ' + file + ': ' + error.message);
    state = empty();
  }
  await rm(temp, { force: true });
  let chain = Promise.resolve();

  async function write(next) {
    const handle = await open(temp, 'w');
    try {
      await handle.writeFile(JSON.stringify(next));
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temp, file);
  }

  return {
    file,
    /** Read-only snapshot (callers must not mutate). */
    get state() { return state; },
    /**
     * Run `fn` against a draft copy. If `fn` throws, or the write fails, nothing changes.
     * Returns whatever `fn` returns.
     */
    transact(fn) {
      const run = chain.then(async () => {
        const draft = structuredClone(state);
        const result = await fn(draft);
        await write(draft);
        state = draft;
        return result;
      });
      chain = run.catch(() => {});
      return run;
    }
  };
}
