import { spawn } from 'node:child_process';

const children = [];

function run(label, args, extraEnv = {}) {
  const child = spawn('npm', args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);

  child.stdout.on('data', (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[${label}] ${chunk}`));
  child.on('exit', (code, signal) => {
    if (signal) {
      return;
    }
    if (code !== 0) {
      process.exitCode = code ?? 1;
      shutdown();
    }
  });
}

function shutdown() {
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }
}

process.on('SIGINT', () => {
  shutdown();
  process.exit(130);
});
process.on('SIGTERM', shutdown);

run('backend', ['run', 'dev', '-w', '@newtrip/backend'], { NODE_ENV: 'development' });
run('debug', ['run', 'dev', '-w', '@newtrip/debug-client']);

console.log('NewTrip demo starting: backend http://localhost:3000, debug client http://localhost:5173');
