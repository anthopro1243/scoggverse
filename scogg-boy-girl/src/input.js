// Keyboard, gamepads (and, in tests, scripted keys) -> one input frame for both players.
// Pad 1 is Scogg Boy, pad 2 Scogg Girl: stick or d-pad to move, A (or d-pad up) to jump.
import Phaser from "phaser";

export const KEYS = {
  boy: { left: "A", right: "D", jump: "W" },
  girl: { left: "LEFT", right: "RIGHT", jump: "UP" },
};
const PADS = { boy: 0, girl: 1 };
const STICK = 0.4;

const empty = () => ({ left: false, right: false, jump: false });

export function createInput(scene) {
  const kb = scene.input.keyboard;
  const keys = {};
  for (const who of Object.keys(KEYS)) {
    keys[who] = {};
    for (const [act, code] of Object.entries(KEYS[who])) keys[who][act] = kb.addKey(Phaser.Input.Keyboard.KeyCodes[code], true, false);
  }
  let scripted = null; // set by tests: a Set of key names held this step
  const pad = (i) => {
    const gp = scene.input.gamepad;
    return gp && gp.total > i ? gp.getPad(i) : null;
  };
  return {
    /** Tests hold keys by name, e.g. ["D", "W", "LEFT"]; null hands control back to the players. */
    script(names) { scripted = names ? new Set(names.map((n) => n.toUpperCase())) : null; },
    get scripted() { return scripted !== null; },
    read() {
      const out = { boy: empty(), girl: empty() };
      for (const who of Object.keys(KEYS)) {
        for (const [act, code] of Object.entries(KEYS[who])) {
          out[who][act] = scripted ? scripted.has(code) : keys[who][act].isDown;
        }
        const p = scripted ? null : pad(PADS[who]);
        if (p) {
          const x = p.leftStick ? p.leftStick.x : 0;
          out[who].left ||= p.left || x < -STICK;
          out[who].right ||= p.right || x > STICK;
          out[who].jump ||= p.A || p.up;
        }
      }
      return out;
    },
    /** Start on either pad (for pause), edge-detected by the caller. */
    padStart() {
      return [0, 1].some((i) => { const p = pad(i); return p && p.buttons[9] && p.buttons[9].pressed; });
    },
  };
}
