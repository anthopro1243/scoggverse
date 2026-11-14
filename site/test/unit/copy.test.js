import { test } from "node:test";
import assert from "node:assert/strict";
import { BANNED, sloganRun } from "../../scripts/lib/copy.js";

const banned = (s) => BANNED.some((re) => re.test(s));

test("slogan runs: three short verb-first sentences in a row fail", () => {
  assert.equal(sloganRun("Survive five nights. Close the doors. Watch your power."), "Survive five nights. Close the doors. Watch your power.");
  assert.ok(sloganRun("Basically FNAF. Survive five nights. Close the doors. Watch your power. Best on a laptop."));
});

test("must-not: plain sentences, two in a row, or long ones pass", () => {
  assert.equal(sloganRun("The FNAF one. Make it to 6 AM."), null);
  assert.equal(sloganRun("Two player. He grabs the Scogg Bucks, she grabs the Gavels."), null);
  assert.equal(sloganRun("Tap to flap. Works on your phone."), null);
  assert.equal(sloganRun("Fan-made, Dr. Scoggins said it's ok. Want something taken down? Ask him."), null);
  assert.equal(sloganRun("Basically FNAF but with Dr. Scoggins. Play it on a laptop if you can."), null);
  assert.equal(sloganRun("Close the doors. Watch your power."), null);
  assert.equal(sloganRun("Check the hall light before you close a door. Keep checking CAM 5 when you get the chance. Make it to 6 AM to win and get Scogg Bucks."), null);
  assert.equal(sloganRun("Fan-made. Not affiliated with Scott Cawthon or Five Nights at Freddy's. Dr. Scoggins said it's ok. To get something taken down, ask Dr. Scoggins."), null);
});

test("banned trailer lines", () => {
  for (const s of ["Plus a game where he comes for you at night.", "You know what's next.", "There's a fifth one. We're not telling."]) assert.ok(banned(s), s);
  for (const s of ["There's also a secret one.", "If your power runs out, it's pretty much over."]) assert.ok(!banned(s), s);
  for (const s of ["FNAF, but it's Dr. Scoggins.", "Lava boy and water girl, but it's Scogg.", "Flappy Bird, but it’s his stretched face."]) assert.ok(banned(s), s);
  assert.ok(!banned("Tap to flap. It's just his face."));
});
