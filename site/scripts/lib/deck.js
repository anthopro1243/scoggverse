// Pure helpers for the deck import: picking the source PDF, titles from slide text, and the
// text safety check. Kept free of I/O so `node --test` can cover them.

const CONNECTORS = new Set(["of", "and", "the", "or", "a", "an", "to", "for", "in", "on", "with", "at", "from", "by", "is", "&", "vs", "vs."]);

/** Pick the deck: skip "Copy of" files and unreadable ones, most pages wins, ties go to the newest. */
export function pickDeck(candidates) {
  const usable = candidates.filter((c) => !/^copy of/i.test(c.name) && Number.isFinite(c.pages) && c.pages > 0);
  usable.sort((a, b) => b.pages - a.pages || b.mtimeMs - a.mtimeMs);
  return usable[0] || null;
}

const CREDIT_PATTERNS = [
  /\s*[-–—(]*\s*\b(made|created|edited|submitted|drawn|designed|credit(?:s|ed)?)\s*(by|to)?\s*[:\-]?\s+.*$/i,
  /\s+[-–—]\s*by\s+.*$/i,
  // trailing "by Name" (but not "Stand by Scogg": names with Scogg in them are part of the joke)
  /\s+\bby\s+(?![\w'’.-]*[Ss][Cc][Oo][Gg])[A-Z][\w'’.-]*(\s+(?![\w'’.-]*[Ss][Cc][Oo][Gg])[A-Z][\w'’.-]*)?\s*$/,
];

/** Strip author credits ("made by …", "- by Name", trailing "by Name") from a title. */
export function stripCredits(text) {
  let t = text;
  for (const re of CREDIT_PATTERNS) t = t.replace(re, "");
  return t.trim();
}

/** True when a piece of slide text is a "made by"-style credit naming someone. */
export function hasCredit(text) {
  return /\b(made|created|edited|submitted|drawn|designed)\s+by\s+\S+/i.test(text) || /\bcredit(s|ed)?\s*(to|:)\s*\S+/i.test(text);
}

export function trimTitle(text, max = 60) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,:;–—-]+$/, "") + "…";
}

/**
 * Title from the slide's first text block (the title placeholder): its first line, joined with the
 * next lines while a line ends on a connector word ("The Lost City of" + "Scogglantis") or the next
 * one starts lowercase. Lines that are only "Vines" are skipped (invisible label text in the deck).
 */
export function titleFromBlocks(blocks, page) {
  const lines = (blocks[0] || []).map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l && !/^vines$/i.test(l));
  let title = lines[0] || "";
  for (let i = 1; i < lines.length; i++) {
    const last = title.split(" ").pop().toLowerCase();
    if (CONNECTORS.has(last) || /^[a-z]/.test(lines[i]) || /[:&,-]$/.test(title)) title += " " + lines[i];
    else break;
  }
  title = stripCredits(title).replace(/^[-–—\s]+|[-–—\s]+$/g, "");
  if (title.replace(/[^\p{L}\p{N}]/gu, "").length < 2) return `Scogg #${page}`;
  return trimTitle(title);
}

/** Parse private-terms.txt: one term per line, "#" comments, "cs:" prefix = case-sensitive. */
export function parseTerms(text) {
  return text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).map((l) => {
    const cs = l.startsWith("cs:");
    const term = cs ? l.slice(3).trim() : l;
    const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    return { term, re: new RegExp(`(^|[^\\p{L}\\p{N}])${esc}(?=$|[^\\p{L}\\p{N}])`, cs ? "u" : "iu") };
  });
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE = /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/;

/**
 * Text safety check for one slide. Returns null when clean, or a reason category. The matched term
 * itself is never returned, so reports can be committed without leaking the private list.
 */
export function textSafety(text, terms) {
  if (terms.some((t) => t.re.test(text))) return "private term in slide text";
  if (EMAIL.test(text)) return "email address in slide text";
  if (PHONE.test(text)) return "phone number in slide text";
  if (hasCredit(text)) return "maker credit in slide text";
  return null;
}

export { fold } from "../../src/js/text.js";
