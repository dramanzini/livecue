// Tiny JSON file persistence for things Ableton doesn't hold:
// lyrics per song, custom setlist order, and notes. No external DB needed.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, "data", "store.json");

const defaults = {
  lyrics: {},     // { [songTitle]: "plain text / chordpro lyrics" }
  order: null,    // optional array of song ids to override locator order
  notes: {},      // { [songTitle]: "performance notes" }
};

let cache = null;

export async function load() {
  if (cache) return cache;
  try {
    cache = { ...defaults, ...JSON.parse(await readFile(DATA_FILE, "utf8")) };
  } catch {
    cache = { ...defaults };
  }
  return cache;
}

export async function save(patch) {
  const data = await load();
  cache = { ...data, ...patch };
  await mkdir(dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(cache, null, 2));
  return cache;
}

export async function setLyrics(title, text) {
  const data = await load();
  return save({ lyrics: { ...data.lyrics, [title]: text } });
}
