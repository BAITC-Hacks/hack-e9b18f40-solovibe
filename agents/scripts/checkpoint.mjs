import "./context.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { runQuiet, pnpmCommand } from "./quiet.mjs";

function fingerprint() {
  const files = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" }).split("\0").filter(Boolean).sort();
  const hash = createHash("sha256");
  for (const file of files) {
    if (/^(?:README\.md$|AGENTS\.md$|TESTING\.md$|agents\/|\.codex\/|video\/)/i.test(file)) continue;
    hash.update(file);
    if (existsSync(file) && statSync(file).isFile()) hash.update(readFileSync(file));
    else hash.update("<deleted>");
  }
  if (existsSync(".env")) hash.update(readFileSync(".env"));
  hash.update(process.version + process.platform);
  return hash.digest("hex");
}

async function check() {
  mkdirSync(".checks/logs", { recursive: true });
  const before = fingerprint();
  for (const script of ["typecheck", "lint", "build"]) {
    const [command, args] = pnpmCommand(script);
    await runQuiet(script, command, args);
  }
  if (fingerprint() !== before) throw new Error("Files changed during checks; finish the writing batch and retry.");
}

async function main() {
  const args = process.argv.slice(2).filter(arg => arg !== "--");
  const message = args.shift();
  const paths = args;
  if (!message || !paths.length) throw new Error('Usage: node agents/scripts/checkpoint.mjs "Concrete message" -- ready/path another/path');
  if (paths.some(path => path.startsWith("-") || path.includes("..") || /^[A-Za-z]:/.test(path) || path.startsWith("/"))) throw new Error("Use relative paths inside the workspace.");
  const status = execFileSync("git", ["status", "--porcelain", "--", ...paths], { encoding: "utf8" });
  if (!status.trim()) { console.log("checkpoint: no changes in the selected paths"); return; }
  const treeBefore = fingerprint();
  await check();
  if (fingerprint() !== treeBefore) throw new Error("Files changed during checks; checkpoint stopped.");
  await runQuiet("stage", "git", ["add", "-A", "--", ...paths], { printSuccess: false });
  await runQuiet("commit", "git", ["commit", "--only", "-m", message, "--", ...paths], { printSuccess: false });
  const sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  if (process.env.CHECKPOINT_NO_PUSH === "1") { console.log("checkpoint: committed " + sha + "; push intentionally disabled"); return; }
  try {
    await runQuiet("push", "git", ["push", "origin", "HEAD"], { printSuccess: false });
    await runQuiet("deploy", process.execPath, ["agents/scripts/manual-deploy.mjs"], { printSuccess: false });
    console.log("checkpoint: committed, pushed and deployed " + sha);
  } catch {
    console.error("checkpoint: commit " + sha + " is saved locally; push or deploy failed. Retry the failed step.");
    process.exitCode = 1;
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
