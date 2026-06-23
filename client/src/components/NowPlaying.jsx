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
  const tempo = transport.tempo || 120;
  // Progress across the active section, or across the whole song if it has none.
  const span = section
    ? { start: section.time, end: section.endTime }
    : { start: song.startTime, end: song.endTime };
  let progress = 0;
  if (span.end != null && span.end > span.start) {
    progress = Math.min(1, Math.max(0, (t - span.start) / (span.end - span.start)));
  }

  // Countdown to the next song (end of current song), in seconds.
  const loop = transport.loop;
  let countdown = null;
  if (!loop?.enabled && song.endTime != null && song.endTime > t) {
    const seconds = ((song.endTime - t) / tempo) * 60;
    countdown = formatTime(seconds);
  }

  return (
    <div className="nowplaying">
      <div className={"np-label" + (transport.isPlaying ? " playing" : "")}>
        {transport.isPlaying ? "Now playing" : "Ready to play"}
      </div>
      <h1 className="np-title">{song.title}</h1>
      <div className="np-section">
        {section ? section.name : "—"}
        {loop?.enabled && loop?.sectionId && section?.id === loop.sectionId && (
          <span className="loop-tag">↻ loop</span>
        )}
      </div>

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
        <span>{Math.round(tempo)} BPM</span>
        <span>bar {Math.floor(t / 4) + 1}</span>
        {countdown && <span className="np-countdown">next in {countdown}</span>}
      </div>
    </div>
  );
}

function formatTime(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
