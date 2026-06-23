import { useMemo, useState } from "react";
import { useLiveCue } from "./useLiveCue.js";
import Setlist from "./components/Setlist.jsx";
import NowPlaying from "./components/NowPlaying.jsx";
import Transport from "./components/Transport.jsx";
import LyricsPanel from "./components/LyricsPanel.jsx";

export default function App() {
  const lc = useLiveCue();
  const [view, setView] = useState("setlist"); // mobile tab: setlist | lyrics

  const activeSongObj = useMemo(
    () => lc.setlist.find((s) => s.id === lc.active.activeSong) || null,
    [lc.setlist, lc.active.activeSong]
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="dot" />
          LiveCue
        </div>
        <ConnBadge connection={lc.connection} online={lc.online} />
        <div className="tempo">{Math.round(lc.transport.tempo)} BPM</div>
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
            onSong={lc.cmd.gotoSong}
            onSection={lc.cmd.gotoSection}
            onRefresh={lc.cmd.refresh}
          />
        </section>

        <section className="pane center-pane">
          <NowPlaying song={activeSongObj} active={lc.active} transport={lc.transport} />
        </section>

        <section className={"pane lyrics-pane " + (view === "lyrics" ? "show" : "")}>
          <LyricsPanel
            song={activeSongObj}
            lyrics={lc.lyrics}
            onSave={lc.saveLyrics}
          />
        </section>
      </main>

      <Transport transport={lc.transport} cmd={lc.cmd} />
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
