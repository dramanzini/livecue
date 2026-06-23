import { useEffect, useState } from "react";

// Per-song performance notes (cues, patch changes, reminders). Stored on the
// server so every device sees the same notes.
export default function Notes({ song, notes, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const title = song?.title;
  const text = (title && notes[title]) || "";

  useEffect(() => { setEditing(false); setDraft(text); }, [title]);

  if (!song) return null;

  if (editing) {
    return (
      <div className="notes editing">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Notes for this song…"
          autoFocus
        />
        <div className="notes-actions">
          <button className="ghost" onClick={() => setEditing(false)}>Cancel</button>
          <button className="primary-sm" onClick={() => { onSave(title, draft); setEditing(false); }}>Save</button>
        </div>
      </div>
    );
  }

  return (
    <div className="notes" onClick={() => { setDraft(text); setEditing(true); }}>
      <div className="notes-label">Notes ✎</div>
      {text ? <p>{text}</p> : <p className="empty">Tap to add notes…</p>}
    </div>
  );
}
