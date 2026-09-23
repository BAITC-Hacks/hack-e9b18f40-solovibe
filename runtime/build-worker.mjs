import { build } from "esbuild";
await Promise.all([
  build({ entryPoints: ["runtime/city-worker.ts"], bundle: true, platform: "node", target: "node22", format: "cjs", outfile: ".next/city-worker.cjs", logLevel: "warning" }),
  build({ entryPoints: ["runtime/worker-health.ts"], bundle: true, platform: "node", target: "node22", format: "cjs", outfile: ".next/worker-health.cjs", logLevel: "warning" }),
]);
console.log("City worker and health helper bundled.");
