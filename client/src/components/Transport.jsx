// Bottom transport bar: prev/next section, play/stop, tempo nudge.
export default function Transport({ transport, cmd }) {
  return (
    <footer className="transport">
      <button className="t-btn" onClick={cmd.prevCue} title="Previous section">⏮</button>
      {transport.isPlaying ? (
        <button className="t-btn primary stop" onClick={cmd.stop} title="Stop">⏹</button>
      ) : (
        <button className="t-btn primary play" onClick={cmd.play} title="Play">▶</button>
      )}
      <button className="t-btn" onClick={cmd.nextCue} title="Next section">⏭</button>

      <div className="t-tempo">
        <button className="ghost" onClick={() => cmd.setTempo(Math.round(transport.tempo) - 1)}>–</button>
        <span>{Math.round(transport.tempo)}</span>
        <button className="ghost" onClick={() => cmd.setTempo(Math.round(transport.tempo) + 1)}>+</button>
      </div>
    </footer>
  );
}
