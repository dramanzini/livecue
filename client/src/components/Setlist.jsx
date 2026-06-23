import { useEffect, useRef, useState } from "react";

// The setlist: songs derived from Ableton locators, each expandable to its
// sections. Tap a song/section to jump there. Toggle "Reorder" to drag songs
// into a custom order (persisted on the server). Each section can be looped.
export default function Setlist({ songs, active, loop, onSong, onSection, onLoop, onLoopOff, onReorder, onRefresh }) {
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState(songs);
  const [dragId, setDragId] = useState(null);
  const rowRefs = useRef(new Map());
  const itemsRef = useRef(items);
  const dragIdRef = useRef(null);

  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { dragIdRef.current = dragId; }, [dragId]);

  // Keep local list in sync with server unless we're mid-drag.
  useEffect(() => { if (!dragId) setItems(songs); }, [songs, dragId]);

  function startDrag(e, id) {
    e.preventDefault();
    setDragId(id);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", endDrag, { once: true });
  }

  function onMove(e) {
    setItems((cur) => {
      const fromIndex = cur.findIndex((s) => s.id === dragIdRef.current);
      if (fromIndex < 0) return cur;
      // Find target index by comparing pointer Y against row midpoints.
      let target = cur.length - 1;
      for (let i = 0; i < cur.length; i++) {
        const el = rowRefs.current.get(cur[i].id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) { target = i; break; }
      }
      if (target === fromIndex) return cur;
      const next = cur.slice();
      const [moved] = next.splice(fromIndex, 1);
      next.splice(target, 0, moved);
      return next;
    });
  }

  function endDrag() {
    window.removeEventListener("pointermove", onMove);
    setDragId(null);
    onReorder(itemsRef.current.map((s) => s.id));
  }

  const list = editing ? items : songs;

  return (
    <div className="setlist">
      <div className="pane-head">
        <h2>Setlist</h2>
        <div>
          <button className={"ghost" + (editing ? " on" : "")} onClick={() => setEditing((v) => !v)}>
            {editing ? "Done" : "Reorder"}
          </button>
          <button className="ghost" onClick={onRefresh} title="Re-read locators from Live">⟳</button>
        </div>
      </div>

      {list.length === 0 && (
        <p className="empty">No songs yet. Add locators in your Ableton arrangement
          (name one <code>Song: Title</code> to start a song).</p>
      )}

      <ol className="songs">
        {list.map((song, i) => {
          const isActive = active.activeSong === song.id;
          return (
            <li
              key={song.id}
              ref={(el) => { if (el) rowRefs.current.set(song.id, el); else rowRefs.current.delete(song.id); }}
              className={"song" + (isActive ? " active" : "") + (dragId === song.id ? " dragging" : "")}
            >
              <div className="song-row">
                {editing && (
                  <span
                    className="drag-handle"
                    onPointerDown={(e) => startDrag(e, song.id)}
                    title="Drag to reorder"
                  >⠿</span>
                )}
                <button className="song-main" onClick={() => !editing && onSong(song.id)}>
                  <span className="num">{i + 1}</span>
                  <span className="title">{song.title}</span>
                  {isActive && <span className="playing-dot" />}
                </button>
              </div>
              {!editing && (
                <ul className="sections">
                  {song.sections.map((sec) => {
                    const looped = loop?.enabled && loop?.sectionId === sec.id;
                    return (
                      <li key={sec.id} className="section-item">
                        <button
                          className={"section" + (active.activeSection === sec.id ? " active" : "")}
                          onClick={() => onSection(sec.id)}
                        >
                          {sec.name}
                        </button>
                        <button
                          className={"loop-btn" + (looped ? " on" : "")}
                          title={looped ? "Stop loop" : "Loop this section"}
                          onClick={() => (looped ? onLoopOff() : onLoop(sec.id))}
                        >↻</button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
