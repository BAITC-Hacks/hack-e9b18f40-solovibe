import { execFileSync, execFile } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { repo } from './context.mjs';
import path from 'node:path';
import { runQuiet } from './quiet.mjs';

process.chdir(repo);
const configPath = process.env.DEPLOY_CONFIG || path.resolve(repo, '.private/deploy.json');
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
try {
  const c = JSON.parse(readFileSync(configPath, 'utf8'));
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(c.host || '') || !/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(c.user || '')) throw new Error('Invalid SSH host/user');
  if (!Number.isInteger(c.port) || c.port < 1 || c.port > 65535) throw new Error('Invalid SSH port');
  if (!/^\/[a-zA-Z0-9_/-]+$/.test(c.root || '') || c.root === '/' || c.root.includes('..')) throw new Error('Invalid deployment root');
  if (git('status', '--porcelain')) throw new Error('Commit all code changes before deployment.');
  const sha = git('rev-parse', 'HEAD');
  process.env.APP_REVISION = sha;
  if (git('ls-remote', '--exit-code', 'origin', 'refs/heads/main').split(/\s/)[0] !== sha) throw new Error('HEAD must equal pushed origin/main.');
  const options = ['-p', String(c.port), '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ServerAliveInterval=30', '-o', 'RequestTTY=no'];
  if (c.key) options.push('-i', c.key, '-o', 'IdentitiesOnly=yes');
  if (c.knownHosts) options.push('-o', `UserKnownHostsFile=${c.knownHosts}`);
  if (c.wslDistribution && !/^[A-Za-z0-9_.-]+$/.test(c.wslDistribution)) throw new Error('Invalid WSL distribution');
  const script = readFileSync(new URL('./deploy-ssh.sh', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
  const origin = new URL(c.origin);
  if (origin.protocol !== 'https:') throw new Error('Public origin must use HTTPS.');
  const archive = execFileSync('git', ['archive', '--format=tar', sha], { cwd: repo, maxBuffer: 256 * 1024 * 1024 });
  async function uploadArchive() {
    const args = [...options, `${c.user}@${c.host}`, `umask 077; mkdir -p ${c.root}; cat > ${c.root}/upload-${sha}.tar`];
    await new Promise((resolve, reject) => {
      const child = execFile(c.wslDistribution ? 'wsl.exe' : 'ssh', c.wslDistribution ? ['-d', c.wslDistribution, '--', 'ssh', ...args] : args, { windowsHide: true }, error => error ? reject(new Error('Release archive upload failed: ' + error.message)) : resolve());
      child.stdin.on('error', () => {});
      child.stdin.end(archive);
    });
  }
  async function remoteDeploy() {
  await uploadArchive();
  await new Promise((resolve, reject) => {
    const sshArgs = [...options, `${c.user}@${c.host}`, `bash -s -- ${sha} ${c.root}`];
    const child = execFile(c.wslDistribution ? 'wsl.exe' : 'ssh', c.wslDistribution ? ['-d', c.wslDistribution, '--', 'ssh', ...sshArgs] : sshArgs, { windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      mkdirSync('.checks/logs', { recursive: true });
      writeFileSync('.checks/logs/deploy-server.log', stdout + stderr);
      if (error) reject(new Error(`Server SSH release failed (${error.code}); see .checks/logs/deploy-server.log`));
      else resolve();
    });
    child.stdin.on('error', () => {}); // Process completion reports a failed SSH connection.
    child.stdin.end(script);
  });
  const response = await fetch(new URL('/api/health', origin), { signal: AbortSignal.timeout(20000) });
  const health = await response.json();
  if (!response.ok || health.status !== 'ok' || health.revision !== sha || health.worker?.status !== 'ok' || health.worker?.revision !== sha) throw new Error('Public health does not confirm matching app and worker revisions.');
  }
  async function localDeploy() {
    const run = (args) => runQuiet('deploy-local', 'docker', ['compose', ...args], { printSuccess: false });
    await run(['build', 'app']);
    await run(['up', '-d', '--wait', '--wait-timeout', '120', 'db']);
    await run(['run', '-T', '--rm', '--no-deps', 'migrate']);
    await run(['up', '-d', '--no-deps', '--no-build', '--wait', '--wait-timeout', '120', 'app', 'worker']);
    await run(['exec', '-T', 'worker', 'node', 'worker-health.cjs']);
    await run(['exec', '-T', 'app', 'node', '-e', 'fetch("http://127.0.0.1:3000/api/health").then(async r=>{const h=await r.json();if(!r.ok||h.revision!==process.env.APP_REVISION||h.worker?.revision!==process.env.APP_REVISION||h.worker?.status!=="ok")process.exit(1)}).catch(()=>process.exit(1))']);
  }
  const results = await Promise.allSettled([localDeploy(), remoteDeploy()]);
  const failures = results.flatMap((result, index) => result.status === 'rejected' ? [`${index === 0 ? 'local' : 'server'}: ${result.reason.message}`] : []);
  if (failures.length) throw new Error(failures.join('; '));
  console.log(`Deployment OK: local app healthy; server revision ${sha} verified`);
} catch (error) {
  console.error(`Deployment failed: ${error.message}`);
  process.exitCode = 1;
}
