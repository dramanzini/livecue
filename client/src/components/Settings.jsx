// Settings drawer: MIDI mapping for footswitch/controller control, keyboard
// shortcut reference, and multi-machine redundancy status.
const LABELS = { toggle: "Play / Stop", play: "Play", stop: "Stop", next: "Next section", prev: "Previous section" };

export default function Settings({ midi, connection, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="pane-head">
          <h2>Settings</h2>
          <button className="ghost" onClick={onClose}>✕</button>
        </div>

        <div className="settings-body">
          <section>
            <h3>MIDI control</h3>
            {!midi.supported && <p className="empty">Web MIDI isn't available in this browser. Use Chrome/Edge over HTTPS or localhost.</p>}
            {midi.supported && !midi.enabled && (
              <button className="primary-sm" onClick={midi.enable}>Enable MIDI</button>
            )}
            {midi.enabled && (
              <>
                <p className="hint">Inputs: {midi.inputs.length ? midi.inputs.map((i) => i.name).join(", ") : "none detected"}</p>
                <table className="map-table">
                  <tbody>
                    {midi.actions.map((a) => (
                      <tr key={a}>
                        <td>{LABELS[a]}</td>
                        <td className="map-sig">{midi.mappings[a] || "—"}</td>
                        <td>
                          <button className="ghost" onClick={() => midi.startLearn(a)}>
                            {midi.learning === a ? "Press a pad…" : "Learn"}
                          </button>
                          {midi.mappings[a] && <button className="ghost" onClick={() => midi.clearMapping(a)}>Clear</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>

          <section>
            <h3>Keyboard shortcuts</h3>
            <ul className="kbd-list">
              <li><kbd>Space</kbd> Play / Stop</li>
              <li><kbd>→</kbd> Next section</li>
              <li><kbd>←</kbd> Previous section</li>
            </ul>
            <p className="hint">Many footswitches send keystrokes — map them to these keys.</p>
          </section>

          <section>
            <h3>Redundancy</h3>
            {connection.backups > 0 ? (
              <p className="hint">Mirroring transport to <b>{connection.backups}</b> backup rig{connection.backups > 1 ? "s" : ""}.</p>
            ) : (
              <p className="hint">No backup rigs. Set <code>BACKUP_HOSTS</code> on the server
                (e.g. <code>192.168.0.5,192.168.0.6</code>) to mirror commands to redundant machines.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
