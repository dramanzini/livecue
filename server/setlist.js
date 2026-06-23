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
      // Each song is playable from its own startTime (tap the song row). We do
      // NOT add a redundant "Start" section — sections are only the real
      // sub-locators inside the song (Song: mode), if any.
      current = {
        id: slug(isSong ? title : `song-${songs.length + 1}`) + "-" + songs.length,
        title: isSong ? title : title || `Song ${songs.length + 1}`,
        startTime: cp.time,
        sections: [],
      };
      songs.push(current);
    } else {
      current.sections.push({
        id: current.id + "-s" + current.sections.length,
        name: title,
        time: cp.time,
      });
    }
  }

  // Song end = next song's start (last song is open-ended → null).
  for (let i = 0; i < songs.length; i++) {
    songs[i].endTime = i + 1 < songs.length ? songs[i + 1].startTime : null;
    // Section end = next section's start, or the song's end for the last one.
    const secs = songs[i].sections;
    for (let j = 0; j < secs.length; j++) {
      secs[j].endTime = j + 1 < secs.length ? secs[j + 1].time : songs[i].endTime;
    }
  }

  return songs;
}

// Given the setlist and current beat position, find the active song/section.
// activeSong is determined by the song's time range (works even with no
// sections); activeSection by the sections within the active song.
export function locate(songs, songTime) {
  let activeSong = null;
  let activeSection = null;
  for (const song of songs) {
    const inSong = songTime + 0.001 >= song.startTime && (song.endTime == null || songTime < song.endTime);
    if (!inSong) continue;
    activeSong = song.id;
    for (const sec of song.sections) {
      if (songTime + 0.001 >= sec.time && (sec.endTime == null || songTime < sec.endTime)) {
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
