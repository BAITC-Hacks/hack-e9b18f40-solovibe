import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
export const repo = fileURLToPath(new URL("../../", import.meta.url));
export const requireProduct = createRequire(new URL("../../package.json", import.meta.url));
process.chdir(repo);
