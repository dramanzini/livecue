import { useEffect, useState } from "react";

// Lyrics view for the active song. You enter your own lyrics; they're stored
// per song on the server (Ableton doesn't hold lyrics). Lines starting with
// "[" are treated as section headers and highlighted.
export default function LyricsPanel({ song, lyrics, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const title = song?.title;
  const text = (title && lyrics[title]) || "";

  useEffect(() => { setEditing(false); setDraft(text); }, [title]); // reset when song changes

  if (!song) return <div className="lyrics empty"><p>No song selected</p></div>;

  if (editing) {
    return (
      <div className="lyrics editing">
        <div className="pane-head">
          <h2>{title} — lyrics</h2>
          <div>
            <button className="ghost" onClick={() => setEditing(false)}>Cancel</button>
            <button className="primary-sm" onClick={() => { onSave(title, draft); setEditing(false); }}>Save</button>
          </div>
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={"Type or paste your lyrics here.\nUse [Section] lines to mark sections."}
          autoFocus
        />
      </div>
    );
  }

  return (
    <div className="lyrics">
      <div className="pane-head">
        <h2>{title}</h2>
        <button className="ghost" onClick={() => { setDraft(text); setEditing(true); }}>Edit</button>
      </div>
      {text ? (
        <pre className="lyrics-body">
          {text.split("\n").map((line, i) => (
            <span key={i} className={line.trim().startsWith("[") ? "lyric-section" : "lyric-line"}>
              {line || " "}{"\n"}
            </span>
          ))}
        </pre>
      ) : (
        <p className="empty">No lyrics yet for this song. Tap <b>Edit</b> to add them.</p>
      )}
    </div>
  );
}
