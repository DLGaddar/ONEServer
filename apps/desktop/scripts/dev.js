const { spawn } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

let electronStarted = false;
let electronProcess = null;
let tscProc = null;
let viteProc = null;

function startTsc() {
  console.log('[Dev] Starting TypeScript compiler (Watch mode) for Main/Preload...');
  tscProc = spawn('npx', ['tsc', '-p', 'tsconfig.main.json', '-w'], {
    cwd: projectRoot,
    shell: true,
    stdio: 'inherit'
  });
}

function startVite() {
  console.log('[Dev] Starting Vite Dev Server...');
  viteProc = spawn('npx', ['vite'], {
    cwd: projectRoot,
    shell: true
  });

  viteProc.stdout.on('data', (data) => {
    const output = data.toString();
    process.stdout.write(output);
    if (output.includes('5173') && !electronStarted) {
      electronStarted = true;
      // Wait a moment for TSC compiler to dump initial outputs
      setTimeout(() => {
        startElectron();
      }, 1500);
    }
  });

  viteProc.stderr.on('data', (data) => {
    process.stderr.write(data.toString());
  });
}

function startElectron() {
  console.log('[Dev] Launching Electron...');
  electronProcess = spawn('npx', ['electron', '.'], {
    cwd: projectRoot,
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development'
    }
  });

  electronProcess.on('exit', () => {
    console.log('[Dev] Electron exited. Shutting down dev services.');
    cleanup();
  });
}

function cleanup() {
  try { if (tscProc) tscProc.kill(); } catch (e) {}
  try { if (viteProc) viteProc.kill(); } catch (e) {}
  try { if (electronProcess) electronProcess.kill(); } catch (e) {}
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Start everything
startTsc();
startVite();
