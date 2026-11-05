// Every level file, bundled. Game levels live in levels/, small test rooms in levels/test/.
import order from "../levels/order.json";

const files = import.meta.glob(["../levels/**/*.json", "!../levels/order.json"], { eager: true, import: "default" });

export const LEVELS = Object.fromEntries(Object.entries(files).map(([path, def]) => [path.replace(/^.*levels\//, "").replace(/\.json$/, ""), def]));

/** The playable levels in order (levels/order.json; G2 adds 1 to 8). */
export const ORDER = order;
