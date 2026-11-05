// Parses `pdftotext -bbox-layout` output into pages → blocks → lines (strings), in reading order.
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");

export function parseLayout(html) {
  return html.split(/<page\b/).slice(1).map((page) =>
    [...page.matchAll(/<block\b[^>]*>([\s\S]*?)<\/block>/g)].map(([, block]) =>
      [...block.matchAll(/<line\b[^>]*>([\s\S]*?)<\/line>/g)].map(([, line]) =>
        [...line.matchAll(/<word\b[^>]*>([^<]*)<\/word>/g)].map(([, w]) => decode(w)).join(" "),
      ).filter(Boolean),
    ).filter((b) => b.length),
  );
}
