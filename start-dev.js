const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = __dirname;
const backendDir = path.join(rootDir, 'backend');
const frontendDir = path.join(rootDir, 'ktx5s-frontend');

console.log('='.repeat(60));
console.log('  🚀 HỆ THỐNG KTX 5S AI — ĐANG KHỞI ĐỘNG CẢ 2 HỆ THỐNG');
console.log('  🔹 Backend AI:   http://localhost:8000 (Swagger: /docs)');
console.log('  🔹 Web Frontend: http://localhost:3000');
console.log('='.repeat(60));

// Giải phóng cổng bị chiếm dụng trước khi khởi động
function freePort(port) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr :${port}`, { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
      const lines = out.split('\n').filter(l => l.includes('LISTENING'));
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(pid) && pid !== '0' && pid !== process.pid.toString()) {
          console.log(`[Cổng ${port}] Đang giải phóng tiến trình cũ PID ${pid}...`);
          try {
            execSync(`taskkill /pid ${pid} /F`, { stdio: 'ignore' });
          } catch {}
        }
      }
    }
  } catch {}
}

freePort(3000);
freePort(8000);

// 1. Tìm đường dẫn Python môi trường ảo (venv)
let pythonPath = 'python';
const venvPyWin = path.join(backendDir, 'venv', 'Scripts', 'python.exe');
const venvPyUnix = path.join(backendDir, 'venv', 'bin', 'python');
if (fs.existsSync(venvPyWin)) {
  pythonPath = venvPyWin;
} else if (fs.existsSync(venvPyUnix)) {
  pythonPath = venvPyUnix;
}

// 2. Chạy Backend FastAPI (:8000)
console.log(`\n[1/2] Đang khởi động Backend FastAPI...`);
const backendProc = spawn(pythonPath, ['-m', 'uvicorn', 'app.main:app', '--reload', '--port', '8000'], {
  cwd: backendDir,
  stdio: 'inherit'
});

backendProc.on('error', (err) => {
  console.warn(`[Backend Warning] Không thể khởi động backend tự động: ${err.message}`);
});

// 3. Chạy Frontend Next.js (:3000)
console.log(`[2/2] Đang khởi động Web Frontend Next.js...`);
const nextCacheDir = path.join(frontendDir, '.next');
if (fs.existsSync(nextCacheDir)) {
  try {
    fs.rmSync(nextCacheDir, { recursive: true, force: true });
  } catch (e) {}
}
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const frontendProc = spawn(npmCmd, ['run', 'dev'], {
  cwd: frontendDir,
  shell: process.platform === 'win32',
  stdio: 'inherit'
});

frontendProc.on('error', (err) => {
  console.error(`[Frontend Error] Không thể khởi động frontend: ${err.message}`);
});

// Dọn dẹp tiến trình an toàn khi tắt (Ctrl + C)
function cleanExit() {
  console.log('\nĐang tắt hệ thống KTX 5S AI...');
  try {
    if (process.platform === 'win32') {
      if (backendProc.pid) spawn('taskkill', ['/pid', backendProc.pid.toString(), '/T', '/F']);
      if (frontendProc.pid) spawn('taskkill', ['/pid', frontendProc.pid.toString(), '/T', '/F']);
    } else {
      backendProc.kill();
      frontendProc.kill();
    }
  } catch {}
  process.exit(0);
}

process.on('SIGINT', cleanExit);
process.on('SIGTERM', cleanExit);
