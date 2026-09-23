import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join, delimiter } from "node:path";

export function briefFailure(text, limit = 18) {
  const lines = text.replace(/\u001b\[[0-9;]*m/g, "").split(/\r?\n/);
  const selected = new Set();
  for (let i = 0; i < lines.length; i++) {
    if (/error|failed|fatal|TS\d{4}|:\d+:\d+|\.tsx?\(/i.test(lines[i])) {
      for (let j = Math.max(0, i - 1); j <= Math.min(lines.length - 1, i + 2); j++) selected.add(j);
    }
  }
  const result = [...selected].sort((a, b) => a - b).map(i => lines[i]).filter(Boolean);
  return (result.length ? result.slice(0, limit) : lines.filter(Boolean).slice(-limit)).join("\n");
}

export function runQuiet(label, command, args, { printSuccess = true } = {}) {
  mkdirSync(".checks/logs", { recursive: true });
  const path = join(".checks/logs", label + ".log");
  return new Promise((resolve, reject) => {
    const log = createWriteStream(path, { flags: "w" });
    // pnpm's JS entry avoids Windows .cmd shell quoting and keeps arguments separate.
    const child = spawn(command, args, { shell: false, windowsHide: true, env: process.env });
    child.stdin.end();
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    child.once("error", error => { log.end(); reject(error); });
    child.once("close", code => log.end(() => {
      if (code !== 0) {
        console.error(label + ": FAILED\n" + briefFailure(readFileSync(path, "utf8")) + "\nFull log: " + path);
        reject(new Error(label + " failed"));
      } else {
        if (printSuccess) console.log(label + ": OK");
        resolve();
      }
    }));
  });
}

export function pnpmCommand(script) {
  const candidates = [process.env.npm_execpath, ...(process.env.PATH || '').split(delimiter).flatMap(dir => [join(dir, 'node_modules/pnpm/bin/pnpm.cjs'), join(dir, 'node_modules/corepack/dist/pnpm.js'), join(dir, 'pnpm.cjs')])];
  const cli = candidates.find(candidate => candidate && /pnpm.*\.(?:c?js)$/i.test(candidate) && existsSync(candidate));
  if (!cli) throw new Error("Cannot locate the installed pnpm JS entry; install pnpm 10.32.1 and expose it on PATH.");
  return [process.execPath, [cli, "run", script]];
}
