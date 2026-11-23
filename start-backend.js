const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const backendDir = path.join(__dirname, 'backend');
let pythonPath = 'python';
const venvPyWin = path.join(backendDir, 'venv', 'Scripts', 'python.exe');
const venvPyUnix = path.join(backendDir, 'venv', 'bin', 'python');
if (fs.existsSync(venvPyWin)) {
  pythonPath = venvPyWin;
} else if (fs.existsSync(venvPyUnix)) {
  pythonPath = venvPyUnix;
}

console.log(`Đang chạy FastAPI Backend trên http://localhost:8000 (Swagger: http://localhost:8000/docs)...`);
const proc = spawn(pythonPath, ['-m', 'uvicorn', 'app.main:app', '--reload', '--port', '8000'], {
  cwd: backendDir,
  shell: true,
  stdio: 'inherit'
});

proc.on('error', (err) => {
  console.error(`Lỗi khởi động backend: ${err.message}`);
});
