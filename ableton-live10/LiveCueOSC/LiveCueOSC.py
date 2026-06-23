# -*- coding: utf-8 -*-
# LiveCueOSC - minimal OSC bridge for Ableton Live 10 (Python 2.7).
#
# AbletonOSC only supports Live 11+. This script gives Live 10 the small subset
# of the same OSC API that LiveCue needs, so the LiveCue server works unchanged.
#
# Protocol (matches AbletonOSC addresses LiveCue uses):
#   Listens on UDP 11000, sends replies to 127.0.0.1:11001.
#   In:  /live/song/start_playing | stop_playing | continue_playing
#        /live/song/set/tempo <f> | set/current_song_time <f>
#        /live/song/jump_to_next_cue | jump_to_prev_cue
#        /live/song/set/loop_start <f> | set/loop_length <f> | set/loop <i>
#        /live/song/get/{is_playing,tempo,current_song_time,
#                        signature_numerator,signature_denominator,cue_points}
#   Out: /live/song/get/<x> with the value(s); cue_points as [name,time,...].

import socket
import select
import struct

from _Framework.ControlSurface import ControlSurface

RECV_PORT = 11000
SEND_HOST = "127.0.0.1"
SEND_PORT = 11001


# ---- tiny OSC codec (Python 2) --------------------------------------------

def _osc_string(s):
    if isinstance(s, unicode):  # noqa: F821 (py2)
        s = s.encode("utf-8")
    else:
        s = str(s)
    s = s + "\0"
    while len(s) % 4 != 0:
        s += "\0"
    return s


def encode_message(address, args):
    out = _osc_string(address)
    types = ","
    data = ""
    for a in args:
        if isinstance(a, float):
            types += "f"
            data += struct.pack(">f", a)
        elif isinstance(a, bool):
            types += "T" if a else "F"
        elif isinstance(a, (int, long)):  # noqa: F821 (py2)
            types += "i"
            data += struct.pack(">i", a)
        else:
            types += "s"
            data += _osc_string(a)
    out += _osc_string(types) + data
    return out


def _read_str(data, start):
    end = data.index("\0", start)
    s = data[start:end]
    total = (end - start) + 1
    while total % 4 != 0:
        total += 1
    return s, start + total


def decode_message(data):
    if data[:8].startswith("#bundle"):
        return None, []  # bundles unused by LiveCue
    address, idx = _read_str(data, 0)
    args = []
    if idx < len(data) and data[idx:idx + 1] == ",":
        types, idx = _read_str(data, idx)
        for t in types[1:]:
            if t == "i":
                args.append(struct.unpack(">i", data[idx:idx + 4])[0]); idx += 4
            elif t == "f":
                args.append(struct.unpack(">f", data[idx:idx + 4])[0]); idx += 4
            elif t == "s":
                s, idx = _read_str(data, idx); args.append(s)
            elif t in ("T", "F"):
                args.append(t == "T")
    return address, args


# ---- control surface -------------------------------------------------------

class LiveCueOSC(ControlSurface):
    def __init__(self, c_instance):
        ControlSurface.__init__(self, c_instance)
        self._last_time = -1.0
        self._sock = None
        with self.component_guard():
            self._setup_socket()
            self._add_listeners()
        self.log_message("LiveCueOSC: listening on UDP %d -> %s:%d" % (RECV_PORT, SEND_HOST, SEND_PORT))
        self._push_all()

    def _setup_socket(self):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.setblocking(0)
            s.bind(("0.0.0.0", RECV_PORT))
            self._sock = s
        except Exception, e:  # noqa: E722 (py2 syntax)
            self.log_message("LiveCueOSC: socket error: %s" % e)
            self._sock = None

    def _add_listeners(self):
        song = self.song()
        try:
            song.add_is_playing_listener(self._on_is_playing)
            song.add_tempo_listener(self._on_tempo)
        except Exception, e:  # noqa
            self.log_message("LiveCueOSC: listener error: %s" % e)
        try:
            song.add_cue_points_listener(self._on_cues)
        except Exception:
            pass  # not all builds expose this; the server re-polls anyway

    # ---- outgoing ----------------------------------------------------------

    def _send(self, address, args):
        if not self._sock:
            return
        try:
            self._sock.sendto(encode_message(address, args), (SEND_HOST, SEND_PORT))
        except Exception:
            pass

    def _send_cue_points(self):
        song = self.song()
        flat = []
        try:
            for cp in song.cue_points:
                flat.append(cp.name)
                flat.append(float(cp.time))
        except Exception, e:  # noqa
            self.log_message("LiveCueOSC: cue_points error: %s" % e)
        self._send("/live/song/get/cue_points", flat)

    def _push_all(self):
        song = self.song()
        self._send("/live/song/get/is_playing", [1 if song.is_playing else 0])
        self._send("/live/song/get/tempo", [float(song.tempo)])
        self._send("/live/song/get/current_song_time", [float(song.current_song_time)])
        self._send_cue_points()

    def _on_is_playing(self):
        self._send("/live/song/get/is_playing", [1 if self.song().is_playing else 0])

    def _on_tempo(self):
        self._send("/live/song/get/tempo", [float(self.song().tempo)])

    def _on_cues(self):
        self._send_cue_points()

    # ---- incoming ----------------------------------------------------------

    def _poll(self):
        if not self._sock:
            return
        for _ in range(64):  # drain up to 64 packets per tick
            try:
                r, _w, _e = select.select([self._sock], [], [], 0)
                if not r:
                    return
                data, _addr = self._sock.recvfrom(8192)
            except Exception:
                return
            try:
                addr, args = decode_message(data)
                if addr:
                    self._dispatch(addr, args)
            except Exception, e:  # noqa
                self.log_message("LiveCueOSC: decode error: %s" % e)

    def _dispatch(self, addr, args):
        song = self.song()
        if addr == "/live/song/start_playing":
            song.start_playing()
        elif addr == "/live/song/stop_playing":
            song.stop_playing()
        elif addr == "/live/song/continue_playing":
            song.continue_playing()
        elif addr == "/live/song/set/tempo" and args:
            song.tempo = float(args[0])
        elif addr == "/live/song/set/current_song_time" and args:
            song.current_song_time = max(0.0, float(args[0]))
        elif addr == "/live/song/jump_to_next_cue":
            song.jump_to_next_cue()
        elif addr == "/live/song/jump_to_prev_cue":
            song.jump_to_prev_cue()
        elif addr == "/live/song/set/loop_start" and args:
            song.loop_start = float(args[0])
        elif addr == "/live/song/set/loop_length" and args:
            song.loop_length = float(args[0])
        elif addr == "/live/song/set/loop" and args:
            song.loop = bool(args[0])
        elif addr == "/live/song/get/is_playing":
            self._send(addr, [1 if song.is_playing else 0])
        elif addr == "/live/song/get/tempo":
            self._send(addr, [float(song.tempo)])
        elif addr == "/live/song/get/current_song_time":
            self._send(addr, [float(song.current_song_time)])
        elif addr == "/live/song/get/signature_numerator":
            self._send(addr, [int(song.signature_numerator)])
        elif addr == "/live/song/get/signature_denominator":
            self._send(addr, [int(song.signature_denominator)])
        elif addr == "/live/song/get/cue_points":
            self._send_cue_points()
        # /live/song/start_listen/* — ignored; we push updates proactively.

    # ---- Live callbacks ----------------------------------------------------

    def update_display(self):
        # Called by Live ~10x/sec. Poll the socket and stream the playhead.
        ControlSurface.update_display(self)
        self._poll()
        try:
            t = self.song().current_song_time
            if t != self._last_time:
                self._last_time = t
                self._send("/live/song/get/current_song_time", [float(t)])
        except Exception:
            pass

    def disconnect(self):
        song = self.song()
        for remove, cb in (
            (getattr(song, "remove_is_playing_listener", None), self._on_is_playing),
            (getattr(song, "remove_tempo_listener", None), self._on_tempo),
            (getattr(song, "remove_cue_points_listener", None), self._on_cues),
        ):
            try:
                if remove:
                    remove(cb)
            except Exception:
                pass
        if self._sock:
            try:
                self._sock.close()
            except Exception:
                pass
            self._sock = None
        ControlSurface.disconnect(self)
