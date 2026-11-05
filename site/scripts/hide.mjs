#!/usr/bin/env node
// Hide a slide (Dr. Scoggins' veto, or anything inappropriate):  npm run hide -- <page> "<reason>"
// Then build, test and open a PR. The slide stays hidden on every future import.
import { resolve } from "node:path";
import { hideSlide } from "./lib/hide.js";

const [page, ...rest] = process.argv.slice(2);
try {
  const { removed } = hideSlide(resolve(import.meta.dirname, ".."), Number(page), rest.join(" "));
  console.log(removed ? `Hid slide #${page}.` : `Slide #${page} wasn't showing; it's now on the hidden list for future imports.`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
