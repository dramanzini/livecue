import express from "express";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { networkInterfaces } from "node:os";

import { AbletonBridge } from "./ableton.js";
import { buildSetlist, applyOrder, locate } from "./setlist.js";
import { load, save, setLyrics } from "./store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);

const app = express();
app.use(express.json());

const ableton = new AbletonBridge();
let rawCuePoints = [];      // last locators received from Live/simulator
let setlist = [];           // built + custom-ordered
let connection = { connected: false, simulated: false };

// Rebuild the setlist from the latest locators and the saved custom order.
async function rebuildSetlist() {
  const store = await load();
  setlist = applyOrder(buildSetlist(rawCuePoints), store.order);
  return store;
}

// ---- REST API --------------------------------------------------------------

app.get("/api/setlist", async (_req, res) => {
  const store = await load();
  res.json({ setlist, lyrics: store.lyrics, notes: store.notes, connection });
});

app.put("/api/lyrics/:title", async (req, res) => {
  const store = await setLyrics(req.params.title, String(req.body.text ?? ""));
  broadcast({ type: "lyrics", lyrics: store.lyrics });
  res.json({ ok: true });
});

app.put("/api/notes/:title", async (req, res) => {
  const store = await load();
  const next = await save({ notes: { ...store.notes, [req.params.title]: String(req.body.text ?? "") } });
  broadcast({ type: "notes", notes: next.notes });
  res.json({ ok: true });
});

// Serve the built client if present.
const clientDist = join(__dirname, "..", "client", "dist");
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(join(clientDist, "index.html")));
}

const server = createServer(app);

// ---- WebSocket (real-time state) ------------------------------------------

const wss = new WebSocketServer({ server, path: "/ws" });

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

function snapshot() {
  const { activeSong, activeSection } = locate(setlist, ableton.state.songTime);
  return {
    type: "state",
    connection: { ...connection, backups: ableton.backups.length },
    transport: ableton.state,
    activeSong,
    activeSection,
  };
}

wss.on("connection", async (ws) => {
  const store = await load();
  ws.send(JSON.stringify({ type: "setlist", setlist, lyrics: store.lyrics, notes: store.notes }));
  ws.send(JSON.stringify(snapshot()));

  ws.on("message", (raw) => {
    let cmd;
    try { cmd = JSON.parse(raw); } catch { return; }
    handleCommand(cmd);
  });
});

function handleCommand(cmd) {
  switch (cmd.type) {
    case "play": ableton.play(); break;
    case "stop": ableton.stop(); break;
    case "continue": ableton.continuePlaying(); break;
    case "tempo": ableton.setTempo(cmd.value); break;
    case "nextCue": ableton.nextCue(); break;
    case "prevCue": ableton.prevCue(); break;
    case "locate": ableton.locate(cmd.beats); break; // jump to a beat position
    case "gotoSection": {
      // find the section by id and jump to its beat time
      for (const song of setlist) {
        const sec = song.sections.find((s) => s.id === cmd.id);
        if (sec) { ableton.locate(sec.time); return; }
      }
      break;
    }
    case "gotoSong": {
      const song = setlist.find((s) => s.id === cmd.id);
      if (song) ableton.locate(song.startTime);
      break;
    }
    case "loopSection": {
      for (const song of setlist) {
        const sec = song.sections.find((s) => s.id === cmd.id);
        if (sec && sec.endTime != null) {
          ableton.setLoop(sec.time, sec.endTime - sec.time, sec.id);
          return;
        }
      }
      break;
    }
    case "loopOff": ableton.clearLoop(); break;
    case "reorder": {
      // cmd.order is the new array of song ids; persist and rebuild.
      save({ order: Array.isArray(cmd.order) ? cmd.order : null })
        .then(rebuildSetlist)
        .then((store) =>
          broadcast({ type: "setlist", setlist, lyrics: store.lyrics, notes: store.notes })
        );
      break;
    }
    case "refresh": ableton.refreshCuePoints(); break;
    default: break;
  }
}

// ---- wire Ableton bridge to clients ---------------------------------------

ableton.on("cuepoints", (cps) => {
  rawCuePoints = cps;
  rebuildSetlist().then((store) =>
    broadcast({ type: "setlist", setlist, lyrics: store.lyrics, notes: store.notes })
  );
});
ableton.on("state", () => broadcast(snapshot()));
ableton.on("connection", (c) => { connection = c; broadcast(snapshot()); });

ableton.start();

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n  LiveCue server running`);
  for (const url of localUrls(PORT)) console.log(`   → ${url}`);
  console.log(`\n  Open the URL above on any device on the same Wi-Fi.\n`);
});

function localUrls(port) {
  const urls = [`http://localhost:${port}`];
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) urls.push(`http://${net.address}:${port}`);
    }
  }
  return urls;
}

process.on("SIGINT", () => { ableton.stopAll(); server.close(() => process.exit(0)); });
