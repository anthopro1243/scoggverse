// Collects console errors and failed requests for a page so tests can assert there are none.
export function watchErrors(page) {
  const errors = [];
  // Vercel injects its feedback toolbar (vercel.live) on preview deployments only; our CSP blocks
  // it there, which is expected and never happens in production.
  page.on("console", (msg) => { if (msg.type() === "error" && !/vercel\.live/.test(msg.text())) errors.push(`console: ${msg.text()}`); });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}
