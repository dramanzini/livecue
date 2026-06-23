# LiveCue

**Setlist controller for Ableton Live.** Turn your arrangement's locators into a
navigable setlist you can drive from any phone, tablet, or laptop on the same
network — control transport, jump between songs and sections, and read synced
lyrics. An open-source take on the idea behind [AbleSet](https://ableset.com/).

> Works out of the box in **simulation mode** (a demo setlist) so you can try the
> whole interface without Ableton. Connect Live for the real thing.

## How it works

```
Ableton Live ──OSC──► LiveCue server (Node) ──WebSocket──► Web app (any browser)
 (AbletonOSC          reads locators/transport            setlist · transport
  remote script)      sends play/stop/locate              synced lyrics
```

- **AbletonOSC** ([github.com/ideoforms/AbletonOSC](https://github.com/ideoforms/AbletonOSC))
  is a free remote script that exposes Live's API over OSC. LiveCue talks to it.
- The **server** reads the arrangement's cue points (locators), builds a setlist,
  tracks playback position/tempo, and pushes real-time state to every connected
  browser over WebSocket.
- The **client** (React) shows the setlist, a big "now playing" view with section
  progress, a transport bar, and a per-song lyrics editor.

## Locator notation

LiveCue builds the setlist from your arrangement locators:

| Locator name        | Meaning                              |
|---------------------|--------------------------------------|
| `Song: Title`       | Starts a new song                    |
| `Verse`, `Chorus` … | A section of the current song        |

Name your locators in Live's Arrangement view accordingly, then hit **⟳** in the
app (or restart playback) to re-read them.

## Quick start

```bash
npm install          # installs server + client (workspaces)
npm run dev          # runs server (:3000) + client dev (:5173)
```

Open the printed URL on any device on your Wi-Fi. Without Ableton you'll see a
demo setlist (simulation mode). 

### Production build

```bash
npm run build        # builds the client into client/dist
npm start            # server serves the app + API on :3000
```

## Connecting Ableton Live

1. Install **AbletonOSC**: copy the `AbletonOSC` folder into Live's *Remote Scripts*
   directory (see its README), then enable it as a Control Surface in
   *Live → Settings → Link/MIDI*.
2. AbletonOSC listens on UDP **11000** and replies on **11001** — LiveCue's defaults.
3. Start LiveCue. The badge in the header switches from **Simulation** to
   **Ableton Live** once it gets a reply.

Override ports/host with env vars if needed:
`ABLETON_HOST`, `ABLETON_SEND_PORT`, `ABLETON_RECV_PORT`, `PORT`.

## Features

- **Setlist from locators** — songs and sections built automatically from your
  arrangement; tap to jump anywhere.
- **Drag-and-drop reordering** — tap *Reorder*, drag songs into a custom order
  (works on touch and desktop). Persisted on the server; navigation order can
  differ from the arrangement.
- **Loop a section** — the ↻ button on any section sets Live's loop region to
  that section so you can vamp until ready.
- **Synced lyrics** — enter lyrics with `[Section]` headers; the matching block
  highlights and auto-scrolls as Live moves through the song.
- **Per-song notes** — cues/reminders stored on the server, shared across devices.
- **Countdown** — time remaining until the next song, based on tempo and position.
- **MIDI & keyboard control** — map a footswitch/controller (Web MIDI) to
  play/stop/next/prev, or use <kbd>Space</kbd> / <kbd>←</kbd> / <kbd>→</kbd>.
- **Multi-machine redundancy** — set `BACKUP_HOSTS` to mirror every transport
  command to one or more backup rigs running AbletonOSC.

```bash
# Example: mirror commands to two backup machines
BACKUP_HOSTS="192.168.0.5,192.168.0.6" npm start
```

## License

MIT
