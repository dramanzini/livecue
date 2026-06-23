import { useEffect, useRef, useState, useCallback } from "react";

// Web MIDI control for transport. Map MIDI notes or CC messages (from a
// footswitch, pad, or controller) to actions: toggle / play / stop / next / prev.
// Mappings persist in localStorage. Many footswitches also send keystrokes —
// keyboard shortcuts are handled in App.jsx as a complement.

const ACTIONS = ["toggle", "play", "stop", "next", "prev"];
const LS_KEY = "livecue.midi.map";

function loadMap() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; }
}

export function useMidi(handlers) {
  const [supported, setSupported] = useState(typeof navigator !== "undefined" && !!navigator.requestMIDIAccess);
  const [enabled, setEnabled] = useState(false);
  const [inputs, setInputs] = useState([]);
  const [mappings, setMappings] = useState(loadMap);
  const [learning, setLearning] = useState(null); // action name currently learning
  const accessRef = useRef(null);
  const handlersRef = useRef(handlers);
  const learningRef = useRef(null);
  const mapRef = useRef(mappings);

  useEffect(() => { handlersRef.current = handlers; });
  useEffect(() => { learningRef.current = learning; }, [learning]);
  useEffect(() => { mapRef.current = mappings; localStorage.setItem(LS_KEY, JSON.stringify(mappings)); }, [mappings]);

  const onMidiMessage = useCallback((e) => {
    const [status, data1] = e.data;
    const cmd = status & 0xf0;
    // note-on (0x90) with velocity>0, or CC (0xb0)
    const kind = cmd === 0x90 && e.data[2] > 0 ? "note" : cmd === 0xb0 && e.data[2] > 0 ? "cc" : null;
    if (!kind) return;
    const sig = `${kind}:${data1}`;

    if (learningRef.current) {
      const action = learningRef.current;
      setMappings((m) => ({ ...m, [action]: sig }));
      setLearning(null);
      return;
    }
    for (const [action, mapped] of Object.entries(mapRef.current)) {
      if (mapped === sig) handlersRef.current?.[action]?.();
    }
  }, []);

  const enable = useCallback(async () => {
    if (!navigator.requestMIDIAccess) { setSupported(false); return; }
    try {
      const access = await navigator.requestMIDIAccess();
      accessRef.current = access;
      const bind = () => {
        const ins = [...access.inputs.values()];
        setInputs(ins.map((i) => ({ id: i.id, name: i.name })));
        ins.forEach((i) => { i.onmidimessage = onMidiMessage; });
      };
      bind();
      access.onstatechange = bind;
      setEnabled(true);
    } catch {
      setSupported(false);
    }
  }, [onMidiMessage]);

  const startLearn = useCallback((action) => setLearning(action), []);
  const clearMapping = useCallback((action) => {
    setMappings((m) => { const n = { ...m }; delete n[action]; return n; });
    setLearning((l) => (l === action ? null : l));
  }, []);

  return { supported, enabled, enable, inputs, mappings, learning, startLearn, clearMapping, actions: ACTIONS };
}
