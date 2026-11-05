// Fold case and accents so search is forgiving ("Scoggé" matches "scogge"). Shared with the import.
export function fold(s) {
  return String(s).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Filter + sort the memes for the gallery. Query matches the title, or "#12"/"12" matches page 12. */
export function selectMemes(memes, query, sort) {
  const q = fold(query.trim());
  const num = /^#?(\d+)$/.exec(q)?.[1];
  const list = q ? memes.filter((m) => fold(m.title).includes(q) || (num && String(m.page) === num)) : memes.slice();
  list.sort((a, b) => (sort === "oldest" ? a.page - b.page : b.page - a.page));
  return list;
}

/** The typed label on a file card: page 128 -> "FILE 0128". */
export function fileNo(page) {
  return `FILE ${String(page).padStart(4, "0")}`;
}
