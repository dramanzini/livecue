import { useEffect, useRef, useState, useMemo } from "react";

// Lyrics view for the active song. You enter your own lyrics; they're stored
// per song on the server. Lines like "[Verse]" are section headers — when that
// section is playing in Live, its block is highlighted and scrolled into view,
// keeping the lyrics synced to the arrangement position.
export default function LyricsPanel({ song, lyrics, activeSectionName, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const containerRef = useRef(null);
  const activeRef = useRef(null);

  const title = song?.title;
  const text = (title && lyrics[title]) || "";

  useEffect(() => { setEditing(false); setDraft(text); }, [title]); // reset on song change

  // Group lyrics into [{ name, lines }] blocks split on [Section] headers.
  const blocks = useMemo(() => parseBlocks(text), [text]);
  const activeKey = (activeSectionName || "").trim().toLowerCase();

  // Auto-scroll the active block into view.
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeKey, text]);

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
          placeholder={"Type or paste your lyrics here.\nUse [Section] lines (e.g. [Verse], [Chorus]) to sync blocks to your arrangement sections."}
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
        <div className="lyrics-body" ref={containerRef}>
          {blocks.map((block, bi) => {
            const isActive = block.name && block.name.trim().toLowerCase() === activeKey && activeKey;
            return (
              <div
                key={bi}
                ref={isActive ? activeRef : null}
                className={"lyric-block" + (isActive ? " current" : "")}
              >
                {block.name && <div className="lyric-section">[{block.name}]</div>}
                {block.lines.map((line, li) => (
                  <div key={li} className="lyric-line">{line || " "}</div>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="empty">No lyrics yet for this song. Tap <b>Edit</b> to add them.</p>
      )}
    </div>
  );
}

function parseBlocks(text) {
  const blocks = [];
  let current = { name: null, lines: [] };
  for (const raw of text.split("\n")) {
    const m = raw.trim().match(/^\[(.+)\]$/);
    if (m) {
      if (current.name !== null || current.lines.length) blocks.push(current);
      current = { name: m[1].trim(), lines: [] };
    } else {
      current.lines.push(raw);
    }
  }
  blocks.push(current);
  return blocks;
}
