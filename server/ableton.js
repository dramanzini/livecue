// Bridge to Ableton Live via AbletonOSC (https://github.com/ideoforms/AbletonOSC).
//
// AbletonOSC is a free remote script that exposes Live's API over OSC.
// It LISTENS on UDP 11000 and SENDS replies on UDP 11001 (by default).
// We send commands to 11000 and listen for replies/updates on 11001.
//
// If Live/AbletonOSC is not reachable, we fall back to a built-in simulator so
// the whole app (setlist, transport, lyrics) can be developed without Ableton.

import osc from "osc";
import { EventEmitter } from "node:events";

const SEND_PORT = Number(process.env.ABLETON_SEND_PORT || 11000); // AbletonOSC receives here
const RECV_PORT = Number(process.env.ABLETON_RECV_PORT || 11001); // AbletonOSC sends here
const ABLETON_HOST = process.env.ABLETON_HOST || "127.0.0.1";
const LOCAL_RECV_PORT = Number(process.env.LOCAL_RECV_PORT || RECV_PORT);

// Multi-machine redundancy: mirror every outgoing command to one or more backup
// rigs running AbletonOSC. Set BACKUP_HOSTS="192.168.0.5,192.168.0.6" (each may
// include :port, defaulting to ABLETON_SEND_PORT).
const BACKUP_HOSTS = (process.env.BACKUP_HOSTS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((entry) => {
    const [host, port] = entry.split(":");
    return { host, port: Number(port || SEND_PORT) };
  });

export class AbletonBridge extends EventEmitter {
  constructor() {
    super();
    this.connected = false;
    this.simulated = false;
    this.cuePoints = []; // [{ name, time }] — time is in beats
    this.state = {
      isPlaying: false,
      tempo: 120,
      songTime: 0, // beats
      signatureNum: 4,
      signatureDenom: 4,
      loop: { enabled: false, start: 0, length: 0, sectionId: null },
    };
    this.backups = BACKUP_HOSTS;
    this._lastPong = 0;
    this._sim = null;
  }

  start() {
    this.udp = new osc.UDPPort({
      localAddress: "0.0.0.0",
      localPort: LOCAL_RECV_PORT,
      remoteAddress: ABLETON_HOST,
      remotePort: SEND_PORT,
      metadata: true,
    });

    this.udp.on("ready", () => {
      console.log(`[ableton] OSC ready — sending to ${ABLETON_HOST}:${SEND_PORT}, listening on ${LOCAL_RECV_PORT}`);
      this._probe();
    });

    this.udp.on("message", (msg) => this._onMessage(msg));
    this.udp.on("error", (err) => {
      // EADDRINUSE etc. — fall back to simulator.
      console.warn("[ableton] OSC error:", err.message);
      this._startSimulator();
    });

    try {
      this.udp.open();
    } catch (err) {
      console.warn("[ableton] could not open OSC port:", err.message);
      this._startSimulator();
    }

    // If Live never answers our probe, run the simulator so the UI still works.
    this._probeTimer = setTimeout(() => {
      if (!this.connected) this._startSimulator();
    }, 2500);

    // Heartbeat: re-probe periodically; detect Live appearing/disappearing.
    this._hb = setInterval(() => this._probe(), 5000);
  }

  // ---- outgoing commands -------------------------------------------------

  send(address, args = []) {
    if (this.simulated) {
      this._mirror(address, args); // backups may be real rigs even while we simulate
      return this._simHandle(address, args);
    }
    if (!this.udp) return;
    const packet = { address, args: args.map(toArg) };
    this.udp.send(packet, ABLETON_HOST, SEND_PORT);
    this._mirror(address, args, packet);
  }

  // Mirror commands (not queries) to backup rigs for redundant playback.
  _mirror(address, args, packet) {
    if (!this.backups.length) return;
    if (address.includes("/get/") || address.includes("/listen")) return; // commands only
    const p = packet || { address, args: args.map(toArg) };
    if (!this.udp) return;
    for (const b of this.backups) this.udp.send(p, b.host, b.port);
  }

  play() { this.send("/live/song/start_playing"); }
  stop() { this.send("/live/song/stop_playing"); }
  continuePlaying() { this.send("/live/song/continue_playing"); }
  setTempo(bpm) { this.send("/live/song/set/tempo", [Number(bpm)]); }

  // Jump the arrangement playhead to a beat position.
  locate(beats) { this.send("/live/song/set/current_song_time", [Number(beats)]); }

  nextCue() { this.send("/live/song/jump_to_next_cue"); }
  prevCue() { this.send("/live/song/jump_to_prev_cue"); }

  // Loop a region of the arrangement (beats). Used to loop the active section.
  setLoop(start, length, sectionId = null) {
    this.state.loop = { enabled: true, start, length, sectionId };
    this.send("/live/song/set/loop_start", [Number(start)]);
    this.send("/live/song/set/loop_length", [Number(length)]);
    this.send("/live/song/set/loop", [1]);
    this.emit("state", this.state);
  }

  clearLoop() {
    this.state.loop = { enabled: false, start: 0, length: 0, sectionId: null };
    this.send("/live/song/set/loop", [0]);
    this.emit("state", this.state);
  }

  refreshCuePoints() { this.send("/live/song/get/cue_points"); }

  // ---- probing & listeners ----------------------------------------------

  _probe() {
    if (this.simulated) return;
    // Ask for state; AbletonOSC replies on RECV_PORT. Also (re)register listeners.
    this.send("/live/song/get/is_playing");
    this.send("/live/song/get/tempo");
    this.send("/live/song/get/current_song_time");
    this.send("/live/song/get/signature_numerator");
    this.send("/live/song/get/signature_denominator");
    this.refreshCuePoints();
    this.send("/live/song/start_listen/is_playing");
    this.send("/live/song/start_listen/current_song_time");
    this.send("/live/song/start_listen/tempo");
  }

  _onMessage(msg) {
    const { address } = msg;
    const args = (msg.args || []).map((a) => (a && typeof a === "object" && "value" in a ? a.value : a));

    if (!this.connected) {
      this.connected = true;
      this.simulated = false;
      clearTimeout(this._probeTimer);
      this._stopSimulator();
      console.log("[ableton] connected to AbletonOSC");
      this.emit("connection", { connected: true, simulated: false });
    }
    this._lastPong = Date.now();

    switch (address) {
      case "/live/song/get/is_playing":
      case "/live/song/get/is_playing/listen":
        this.state.isPlaying = !!args[0];
        this.emit("state", this.state);
        break;
      case "/live/song/get/tempo":
      case "/live/song/get/tempo/listen":
        this.state.tempo = Number(args[0]);
        this.emit("state", this.state);
        break;
      case "/live/song/get/current_song_time":
      case "/live/song/get/current_song_time/listen":
        this.state.songTime = Number(args[0]);
        this.emit("state", this.state);
        break;
      case "/live/song/get/signature_numerator":
        this.state.signatureNum = Number(args[0]);
        break;
      case "/live/song/get/signature_denominator":
        this.state.signatureDenom = Number(args[0]);
        break;
      case "/live/song/get/cue_points":
        this.cuePoints = parseCuePoints(args);
        this.emit("cuepoints", this.cuePoints);
        break;
      default:
        // ignore other replies
        break;
    }
  }

  // ---- simulator ---------------------------------------------------------

  _startSimulator() {
    if (this.simulated) return;
    this.simulated = true;
    this.connected = false;
    console.log("[ableton] no Live detected — running in SIMULATION mode");

    // A demo arrangement so the UI is usable out of the box.
    // Locator notation: "Song: <title>" starts a song; bare names are sections.
    this.cuePoints = [
      { name: "Song: Opening", time: 0 },
      { name: "Intro", time: 4 },
      { name: "Verse", time: 20 },
      { name: "Chorus", time: 52 },
      { name: "Song: Second Track", time: 84 },
      { name: "Intro", time: 84 },
      { name: "Verse", time: 100 },
      { name: "Chorus", time: 132 },
      { name: "Bridge", time: 164 },
      { name: "Song: Closer", time: 196 },
      { name: "Build", time: 196 },
      { name: "Drop", time: 228 },
      { name: "Outro", time: 260 },
    ];
    this.state.tempo = 124;
    this.emit("connection", { connected: false, simulated: true });
    this.emit("cuepoints", this.cuePoints);
    this.emit("state", this.state);

    clearInterval(this._sim);
    this._sim = setInterval(() => {
      if (this.state.isPlaying) {
        // advance song time at tempo (beats per 100ms)
        this.state.songTime += (this.state.tempo / 60) * 0.1;
        const loop = this.state.loop;
        if (loop.enabled && loop.length > 0 && this.state.songTime >= loop.start + loop.length) {
          this.state.songTime = loop.start; // wrap within the looped section
        }
        const last = this.cuePoints[this.cuePoints.length - 1];
        if (last && this.state.songTime > last.time + 32) this.state.songTime = 0;
        this.emit("state", this.state);
      }
    }, 100);
  }

  _stopSimulator() {
    clearInterval(this._sim);
    this._sim = null;
  }

  _simHandle(address, args) {
    switch (address) {
      case "/live/song/start_playing":
      case "/live/song/continue_playing":
        this.state.isPlaying = true; break;
      case "/live/song/stop_playing":
        this.state.isPlaying = false; break;
      case "/live/song/set/tempo":
        this.state.tempo = Number(args[0]); break;
      case "/live/song/set/current_song_time":
        this.state.songTime = Number(args[0]); break;
      case "/live/song/jump_to_next_cue": {
        const next = this.cuePoints.find((c) => c.time > this.state.songTime + 0.01);
        if (next) this.state.songTime = next.time; break;
      }
      case "/live/song/jump_to_prev_cue": {
        const prev = [...this.cuePoints].reverse().find((c) => c.time < this.state.songTime - 0.01);
        if (prev) this.state.songTime = prev.time; break;
      }
      default: break;
    }
    this.emit("state", this.state);
  }

  stopAll() {
    clearTimeout(this._probeTimer);
    clearInterval(this._hb);
    this._stopSimulator();
    if (this.udp) this.udp.close();
  }
}

function toArg(v) {
  if (typeof v === "number") return Number.isInteger(v) ? { type: "i", value: v } : { type: "f", value: v };
  if (typeof v === "boolean") return { type: v ? "T" : "F" };
  return { type: "s", value: String(v) };
}

// AbletonOSC returns cue points as a flat list. Depending on version this is
// either [name, time, name, time, ...] or [index, name, time, ...]. We detect
// the shape by checking whether names are strings.
function parseCuePoints(args) {
  const out = [];
  // Try [name, time] pairs first.
  for (let i = 0; i + 1 < args.length; i += 2) {
    const name = args[i];
    const time = args[i + 1];
    if (typeof name === "string" && typeof time === "number") {
      out.push({ name, time });
    }
  }
  if (out.length) return out.sort((a, b) => a.time - b.time);

  // Fallback: maybe [time, name] pairs.
  for (let i = 0; i + 1 < args.length; i += 2) {
    const time = args[i];
    const name = args[i + 1];
    if (typeof name === "string" && typeof time === "number") {
      out.push({ name, time });
    }
  }
  return out.sort((a, b) => a.time - b.time);
}
