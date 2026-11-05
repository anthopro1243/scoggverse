// Deploy size budget: the game plus the gallery at the class goal must stay well under the limit.
// Vercel Hobby (docs checked 2026-10-05): "Static File uploads: 100 MB" (vercel.com/docs/limits) is
// the only size cap Vercel publishes. It's written for CLI uploads, and Git deployments like ours
// aren't capped there, but it's the only number on record, so the site is held to it with 15%
// headroom. Details in PROGRESS.md "Room to grow".
export const BUDGET = { limitBytes: 100e6, headroom: 0.15, slides: 1000 };
export const budgetBytes = (b = BUDGET) => b.limitBytes * (1 - b.headroom);

// Files that grow with the number of shown slides (paths relative to dist/, starting with "/").
export const perSlide = (p) => /^\/(memes\/(full|thumb|og)\/|s\/\d+\/)/.test(p) || /^\/assets\/memes-[^/]*\.json$/.test(p);

// files: [{ p, size }] from dist/. Returns the bytes per part and the projection at `slides`.
export function project(files, shown, slides = BUDGET.slides) {
  const sum = (list) => list.reduce((a, f) => a + f.size, 0);
  const slideFiles = files.filter((f) => perSlide(f.p));
  const fixed = sum(files.filter((f) => !perSlide(f.p)));
  const slideBytes = sum(slideFiles);
  const each = shown ? slideBytes / shown : 0;
  const total = fixed + slideBytes;
  const projected = fixed + each * slides;
  return { total, fixed, slideBytes, each, shown, slides, projected, budget: budgetBytes(), fits: projected <= budgetBytes(), roomFor: each ? Math.floor((budgetBytes() - fixed) / each) : Infinity };
}
