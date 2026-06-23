import { useMemo, useState, useEffect } from "react";
import { useLiveCue } from "./useLiveCue.js";
import { useMidi } from "./useMidi.js";
import Setlist from "./components/Setlist.jsx";
import NowPlaying from "./components/NowPlaying.jsx";
import Transport from "./components/Transport.jsx";
import LyricsPanel from "./components/LyricsPanel.jsx";
import Notes from "./components/Notes.jsx";
import Settings from "./components/Settings.jsx";

export default function App() {
  const lc = useLiveCue();
  const [view, setView] = useState("setlist"); // mobile tab: setlist | lyrics
  const [showSettings, setShowSettings] = useState(false);

  const activeSongObj = useMemo(
    () => lc.setlist.find((s) => s.id === lc.active.activeSong) || null,
    [lc.setlist, lc.active.activeSong]
  );
  const activeSectionName = useMemo(
    () => activeSongObj?.sections.find((s) => s.id === lc.active.activeSection)?.name || "",
    [activeSongObj, lc.active.activeSection]
  );

  // MIDI control (footswitch / pads) mapped to transport actions.
  const midi = useMidi({
    toggle: lc.cmd.toggle,
    play: lc.cmd.play,
    stop: lc.cmd.stop,
    next: lc.cmd.nextCue,
    prev: lc.cmd.prevCue,
  });

  // Keyboard shortcuts (also covers footswitches that emit keystrokes).
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.matches?.("input, textarea")) return;
      if (e.code === "Space") { e.preventDefault(); lc.cmd.toggle(); }
      else if (e.code === "ArrowRight") { e.preventDefault(); lc.cmd.nextCue(); }
      else if (e.code === "ArrowLeft") { e.preventDefault(); lc.cmd.prevCue(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lc.cmd]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="dot" />
          LiveCue
        </div>
        <ConnBadge connection={lc.connection} online={lc.online} />
        <div className="tempo">{Math.round(lc.transport.tempo)} BPM</div>
        <button className="ghost gear" onClick={() => setShowSettings(true)} title="Settings">⚙</button>
      </header>

      <nav className="tabs">
        <button className={view === "setlist" ? "on" : ""} onClick={() => setView("setlist")}>Setlist</button>
        <button className={view === "lyrics" ? "on" : ""} onClick={() => setView("lyrics")}>Lyrics</button>
      </nav>

      <main className="layout">
        <section className={"pane setlist-pane " + (view === "setlist" ? "show" : "")}>
          <Setlist
            songs={lc.setlist}
            active={lc.active}
            loop={lc.transport.loop}
            onSong={lc.cmd.gotoSong}
            onSection={lc.cmd.gotoSection}
            onLoop={lc.cmd.loopSection}
            onLoopOff={lc.cmd.loopOff}
            onReorder={lc.cmd.reorder}
            onRefresh={lc.cmd.refresh}
          />
        </section>

        <section className="pane center-pane">
          <NowPlaying song={activeSongObj} active={lc.active} transport={lc.transport} />
          <Notes song={activeSongObj} notes={lc.notes} onSave={lc.saveNotes} />
        </section>

        <section className={"pane lyrics-pane " + (view === "lyrics" ? "show" : "")}>
          <LyricsPanel
            song={activeSongObj}
            lyrics={lc.lyrics}
            activeSectionName={activeSectionName}
            onSave={lc.saveLyrics}
          />
        </section>
      </main>

      <Transport transport={lc.transport} cmd={lc.cmd} />

      {showSettings && (
        <Settings midi={midi} connection={lc.connection} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

function ConnBadge({ connection, online }) {
  let label = "Disconnected", cls = "off";
  if (!online) { label = "Server offline"; cls = "off"; }
  else if (connection.simulated) { label = "Simulation"; cls = "sim"; }
  else if (connection.connected) { label = "Ableton Live"; cls = "live"; }
  else { label = "Waiting for Live…"; cls = "sim"; }
  return <div className={"conn " + cls}>{label}</div>;
}
