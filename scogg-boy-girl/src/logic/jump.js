// Jump feel, with no Phaser: coyote time (jump just after leaving a ledge), jump buffering (a jump
// pressed just before landing still happens) and a jump cut (let go early for a short hop).
import { MOVE } from "./config.js";

export function createJump(cfg = MOVE) {
  let sinceGround = Infinity; // s since last standing on something
  let sincePress = Infinity;  // s since jump was last pressed (edge, not held)
  let wasHeld = false;
  let rising = false;         // in a jump we started, still going up
  return {
    /**
     * One fixed step. Returns { jump: true } to launch, { cut: true } to shorten a rising jump.
     * @param {{grounded: boolean, held: boolean, vy: number, dt: number}} s vy < 0 is up
     */
    step({ grounded, held, vy, dt }) {
      const pressed = held && !wasHeld;
      wasHeld = held;
      sinceGround = grounded ? 0 : sinceGround + dt;
      sincePress = pressed ? 0 : sincePress + dt;
      if (vy >= 0) rising = false;
      if (sincePress <= cfg.jumpBuffer && sinceGround <= cfg.coyote && !rising) {
        sincePress = sinceGround = Infinity;
        rising = true;
        return { jump: true, cut: false };
      }
      if (rising && !held && vy < 0) {
        rising = false;
        return { jump: false, cut: true };
      }
      return { jump: false, cut: false };
    },
  };
}
