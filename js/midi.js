// Web MIDI input: auto-detects devices and reports note-on events.

export async function initMIDI({ onNote, onStatus }) {
  if (!navigator.requestMIDIAccess) {
    onStatus({ supported: false, devices: [] });
    return;
  }

  let access;
  try {
    access = await navigator.requestMIDIAccess({ sysex: false });
  } catch (err) {
    onStatus({ supported: true, denied: true, devices: [] });
    return;
  }

  const handle = (e) => {
    const [status, note, velocity] = e.data;
    const cmd = status & 0xf0;
    // Note-on with velocity 0 is a note-off; ignore releases entirely.
    if (cmd === 0x90 && velocity > 0) onNote(note);
  };

  const refresh = () => {
    const devices = [];
    access.inputs.forEach((input) => {
      input.onmidimessage = handle;
      if (input.state === 'connected') devices.push(input.name || 'MIDI device');
    });
    onStatus({ supported: true, devices });
  };

  access.onstatechange = refresh;
  refresh();
}
