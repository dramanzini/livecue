// Build a structured setlist from Ableton arrangement cue points (locators).
//
// LiveCue "Locator Notation":
//   - If ANY locator is named "Song: <title>", it starts a new song and the
//     locators after it become that song's SECTIONS.
//   - If NO locator uses the "Song:" prefix, every locator is treated as its
//     own song (the common case — one locator per song). This way you don't
//     have to rename anything in Ableton.
//
// This mirrors how AbleSet turns arrangement locators into a navigable setlist.

const SONG_PREFIX = /^song:\s*/i;

export function buildSetlist(cuePoints) {
  const songs = [];
  let current = null;

  // When no locator declares a song, each locator IS a song.
  const usesSongPrefix = cuePoints.some((cp) => SONG_PREFIX.test(cp.name));

  for (const cp of cuePoints) {
    const isSong = usesSongPrefix ? SONG_PREFIX.test(cp.name) : true;
    const title = SONG_PREFIX.test(cp.name) ? cp.name.replace(SONG_PREFIX, "").trim() : cp.name.trim();

    if (isSong || !current) {
      current = {
        id: slug(isSong ? title : `song-${songs.length + 1}`) + "-" + songs.length,
        title: isSong ? title : title || `Song ${songs.length + 1}`,
        startTime: cp.time,
        sections: [],
      };
      songs.push(current);
      // A "Song:" locator also acts as the first section boundary only if it has
      // its own label distinct from a following section. We push it as a section
      // so the song is always playable from its first cue.
      current.sections.push({
        id: current.id + "-s0",
        name: isSong ? "Start" : title || "Start",
        time: cp.time,
      });
    } else {
      current.sections.push({
        id: current.id + "-s" + current.sections.length,
        name: title,
        time: cp.time,
      });
    }
  }

  // Compute end times (next cue or +∞ for last) for progress display.
  const flat = songs.flatMap((s) => s.sections.map((sec) => ({ song: s, sec })));
  flat.sort((a, b) => a.sec.time - b.sec.time);
  for (let i = 0; i < flat.length; i++) {
    flat[i].sec.endTime = i + 1 < flat.length ? flat[i + 1].sec.time : null;
  }
  for (const song of songs) {
    song.endTime = song.sections.length
      ? song.sections[song.sections.length - 1].endTime
      : null;
  }

  return songs;
}

// Given the setlist and current beat position, find the active song/section.
export function locate(songs, songTime) {
  let activeSong = null;
  let activeSection = null;
  for (const song of songs) {
    for (const sec of song.sections) {
      if (songTime + 0.001 >= sec.time && (sec.endTime == null || songTime < sec.endTime)) {
        activeSong = song.id;
        activeSection = sec.id;
      }
    }
  }
  return { activeSong, activeSection };
}

// Apply a saved custom order (array of song ids). Songs in `order` come first
// in that order; any songs not listed keep their original (locator) order at the
// end. Unknown ids in `order` are ignored. This only changes setlist navigation
// order — jumping to a song still uses its locator's beat time.
export function applyOrder(songs, order) {
  if (!Array.isArray(order) || !order.length) return songs;
  const byId = new Map(songs.map((s) => [s.id, s]));
  const out = [];
  for (const id of order) {
    if (byId.has(id)) { out.push(byId.get(id)); byId.delete(id); }
  }
  for (const s of songs) if (byId.has(s.id)) out.push(s);
  return out;
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "song";
}
