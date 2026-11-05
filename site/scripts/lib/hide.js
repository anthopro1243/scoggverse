// Hides one slide right away, without re-importing: records it in content/hidden.json (so every
// future import skips it), removes it from src/data/memes.json and deletes its images.
import { existsSync, readFileSync, unlinkSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const read = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : d);
const write = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + "\n");

export function hideSlide(root, page, reason) {
  if (!Number.isInteger(page) || page < 1) throw new Error("page must be a positive whole number");
  if (!reason || !reason.trim()) throw new Error("give a reason, e.g. npm run hide -- 42 \"Dr. Scoggins asked\"");
  const hiddenPath = join(root, "content/hidden.json");
  const hidden = read(hiddenPath, []).filter((h) => h.page !== page);
  hidden.push({ page, reason: reason.trim() });
  hidden.sort((a, b) => a.page - b.page);
  write(hiddenPath, hidden);

  const memesPath = join(root, "src/data/memes.json");
  const memes = read(memesPath, []);
  const gone = memes.filter((m) => m.page === page);
  write(memesPath, memes.filter((m) => m.page !== page));
  for (const m of gone) for (const f of [m.thumb, m.full, m.og]) if (f && existsSync(join(root, "public", f))) unlinkSync(join(root, "public", f));
  // Remove any leftover image or share page for that page number, whatever its hash.
  for (const sub of ["memes/full", "memes/thumb", "memes/og"]) {
    const dir = join(root, "public", sub);
    if (existsSync(dir)) for (const f of readdirSync(dir)) if (f.startsWith(`${page}-`)) unlinkSync(join(dir, f));
  }
  const share = join(root, "public/s", String(page));
  if (existsSync(share)) rmSync(share, { recursive: true });

  const deckPath = join(root, "src/data/deck.json");
  if (existsSync(deckPath)) { const d = read(deckPath, {}); d.shown = memes.length - gone.length; write(deckPath, d); }
  const reportPath = join(root, "content/import-report.json");
  if (existsSync(reportPath)) {
    const r = read(reportPath, {});
    r.hidden = (r.hidden || []).filter((h) => h.page !== page).concat({ page, reason: reason.trim(), by: "hidden.json" }).sort((a, b) => a.page - b.page);
    r.shown = memes.length - gone.length;
    write(reportPath, r);
  }
  return { removed: gone.length };
}
