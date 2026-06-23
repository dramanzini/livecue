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

  useEffect(() => {
    let stop = false;
    let retry;

    function connect() {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => setOnline(true);
      ws.onclose = () => {
        setOnline(false);
        if (!stop) retry = setTimeout(connect, 1000);
      };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        switch (msg.type) {
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

    connect();
    return () => { stop = true; clearTimeout(retry); wsRef.current?.close(); };
  }, []);

  const send = useCallback((obj) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
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
