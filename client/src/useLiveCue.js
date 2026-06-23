import { useEffect, useRef, useState, useCallback } from "react";

// Connects to the server over WebSocket, keeps live state, and exposes
// commands. Auto-reconnects if the connection drops.
export function useLiveCue() {
  const [setlist, setSetlist] = useState([]);
  const [lyrics, setLyrics] = useState({});
  const [notes, setNotes] = useState({});
  const [transport, setTransport] = useState({ isPlaying: false, tempo: 120, songTime: 0 });
  const [active, setActive] = useState({ activeSong: null, activeSection: null });
  const [connection, setConnection] = useState({ connected: false, simulated: false });
  const [online, setOnline] = useState(false);
  const wsRef = useRef(null);
  const outboxRef = useRef([]);   // commands issued while disconnected
  const lastPongRef = useRef(0);

  useEffect(() => {
    let stop = false;
    let retry;
    const OUTBOX_TTL = 6000; // drop queued commands older than this

    function flushOutbox() {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== 1) return;
      const now = Date.now();
      const pending = outboxRef.current;
      outboxRef.current = [];
      for (const { t, obj } of pending) {
        if (now - t <= OUTBOX_TTL) ws.send(JSON.stringify(obj));
      }
    }

    function connect() {
      if (stop) return;
      const cur = wsRef.current;
      if (cur && (cur.readyState === 0 || cur.readyState === 1)) return; // already (re)connecting
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        setOnline(true);
        lastPongRef.current = Date.now();
        flushOutbox(); // deliver anything tapped while we were reconnecting
      };
      ws.onclose = () => {
        setOnline(false);
        if (!stop) retry = setTimeout(connect, 1000);
      };
      ws.onerror = () => { try { ws.close(); } catch {} };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        switch (msg.type) {
          case "pong": lastPongRef.current = Date.now(); break;
          case "setlist":
            setSetlist(msg.setlist || []);
            if (msg.lyrics) setLyrics(msg.lyrics);
            if (msg.notes) setNotes(msg.notes);
            break;
          case "state":
            setTransport(msg.transport);
            setActive({ activeSong: msg.activeSong, activeSection: msg.activeSection });
            setConnection(msg.connection);
            break;
          case "lyrics": setLyrics(msg.lyrics); break;
          case "notes": setNotes(msg.notes); break;
          default: break;
        }
      };
    }

    // Heartbeat: ping regularly; if the socket looks dead (no pong, or not open)
    // while the page is visible, force a reconnect. iOS silently suspends
    // background sockets, so this is what recovers them.
    const hb = setInterval(() => {
      const ws = wsRef.current;
      if (ws && ws.readyState === 1) {
        try { ws.send(JSON.stringify({ type: "ping" })); } catch {}
        if (Date.now() - lastPongRef.current > 12000) { try { ws.close(); } catch {} }
      } else if (document.visibilityState === "visible") {
        connect();
      }
    }, 4000);

    // Reconnect immediately when the user returns to the app.
    const wake = () => {
      const ws = wsRef.current;
      if (document.visibilityState === "visible" && (!ws || ws.readyState > 1)) connect();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("pageshow", wake);

    connect();
    return () => {
      stop = true;
      clearTimeout(retry);
      clearInterval(hb);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("pageshow", wake);
      wsRef.current?.close();
    };
  }, []);

  const send = useCallback((obj) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(obj));
    } else {
      // Don't drop the user's action — queue it and let reconnect flush it.
      outboxRef.current.push({ t: Date.now(), obj });
    }
  }, []);

  const cmd = {
    play: () => send({ type: "play" }),
    stop: () => send({ type: "stop" }),
    continue: () => send({ type: "continue" }),
    toggle: () => send({ type: transport.isPlaying ? "stop" : "play" }),
    nextCue: () => send({ type: "nextCue" }),
    prevCue: () => send({ type: "prevCue" }),
    setTempo: (value) => send({ type: "tempo", value }),
    gotoSong: (id) => send({ type: "gotoSong", id }),
    gotoSection: (id) => send({ type: "gotoSection", id }),
    loopSection: (id) => send({ type: "loopSection", id }),
    loopOff: () => send({ type: "loopOff" }),
    reorder: (order) => send({ type: "reorder", order }),
    refresh: () => send({ type: "refresh" }),
  };

  const saveLyrics = useCallback(async (title, text) => {
    setLyrics((l) => ({ ...l, [title]: text }));
    await fetch(`/api/lyrics/${encodeURIComponent(title)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  }, []);

  const saveNotes = useCallback(async (title, text) => {
    setNotes((n) => ({ ...n, [title]: text }));
    await fetch(`/api/notes/${encodeURIComponent(title)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  }, []);

  return { setlist, lyrics, notes, transport, active, connection, online, cmd, saveLyrics, saveNotes };
}
