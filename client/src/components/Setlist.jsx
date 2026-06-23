// The setlist: songs derived from Ableton locators, each expandable to its
// sections. Tapping a song or section jumps the arrangement playhead there.
export default function Setlist({ songs, active, onSong, onSection, onRefresh }) {
  return (
    <div className="setlist">
      <div className="pane-head">
        <h2>Setlist</h2>
        <button className="ghost" onClick={onRefresh} title="Re-read locators from Live">⟳</button>
      </div>

      {songs.length === 0 && (
        <p className="empty">No songs yet. Add locators in your Ableton arrangement
          (name one <code>Song: Title</code> to start a song).</p>
      )}

      <ol className="songs">
        {songs.map((song, i) => {
          const isActive = active.activeSong === song.id;
          return (
            <li key={song.id} className={"song" + (isActive ? " active" : "")}>
              <button className="song-row" onClick={() => onSong(song.id)}>
                <span className="num">{i + 1}</span>
                <span className="title">{song.title}</span>
                {isActive && <span className="playing-dot" />}
              </button>
              <ul className="sections">
                {song.sections.map((sec) => (
                  <li key={sec.id}>
                    <button
                      className={"section" + (active.activeSection === sec.id ? " active" : "")}
                      onClick={() => onSection(sec.id)}
                    >
                      {sec.name}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
