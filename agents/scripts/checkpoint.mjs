import "./context.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync,writeFileSync } from "node:fs";
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
  try {
    const verified=JSON.parse(readFileSync('.checks/verified.json','utf8'));
    if(verified.fingerprint===before&&['typecheck','lint','build'].every(name=>verified.checks?.includes(name))){console.log('checks: reused verified unchanged application');return;}
  } catch { /* Missing or invalid local evidence requires fresh checks. */ }
  for (const script of ["typecheck", "lint", "build"]) {
    const [command, args] = pnpmCommand(script);
    await runQuiet(script, command, args);
  }
  if (fingerprint() !== before) throw new Error("Files changed during checks; finish the writing batch and retry.");
  writeFileSync('.checks/verified.json',JSON.stringify({fingerprint:before,checks:['typecheck','lint','build']}));
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
  const removedFromIndex = new Set(execFileSync("git", ["diff", "--cached", "--diff-filter=D", "--name-only", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean));
  const stagePaths = paths.filter(path => !removedFromIndex.has(path));
  if (stagePaths.length) await runQuiet("stage", "git", ["add", "-A", "--", ...stagePaths], { printSuccess: false });
  const staged = execFileSync("git", ["diff", "--cached", "--name-only", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
  const selected = new Set(execFileSync("git", ["diff", "--cached", "--name-only", "-z", "--", ...paths], { encoding: "utf8" }).split("\0").filter(Boolean));
  if (staged.some(file => !selected.has(file))) throw new Error("Staged changes outside the selected package; reconcile ownership before committing.");
  // Commit the checked index. --only reconstructs it from HEAD/worktree and can
  // re-add a locally retained file intentionally removed with git rm --cached.
  await runQuiet("commit", "git", ["commit", "-m", message], { printSuccess: false });
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
