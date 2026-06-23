// Big "now playing" display: current song, active section, and a progress bar
// for the section based on the arrangement beat position.
export default function NowPlaying({ song, active, transport }) {
  if (!song) {
    return (
      <div className="nowplaying empty">
        <p>Select a song to begin</p>
      </div>
    );
  }

  const section = song.sections.find((s) => s.id === active.activeSection);
  const t = transport.songTime;
  let progress = 0;
  if (section && section.endTime != null && section.endTime > section.time) {
    progress = Math.min(1, Math.max(0, (t - section.time) / (section.endTime - section.time)));
  }

  return (
    <div className="nowplaying">
      <div className="np-label">Now playing</div>
      <h1 className="np-title">{song.title}</h1>
      <div className="np-section">{section ? section.name : "—"}</div>

      <div className="np-progress">
        <div className="np-progress-fill" style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="np-sections">
        {song.sections.map((s) => (
          <span key={s.id} className={"chip" + (s.id === active.activeSection ? " on" : "")}>
            {s.name}
          </span>
        ))}
      </div>

      <div className="np-meta">
        <span>{transport.isPlaying ? "▶ Playing" : "⏸ Stopped"}</span>
        <span>{Math.round(transport.tempo)} BPM</span>
        <span>bar {Math.floor(t / 4) + 1}</span>
      </div>
    </div>
  );
}
