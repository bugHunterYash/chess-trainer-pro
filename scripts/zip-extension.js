import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const extDir = path.resolve('extension');
const outZip = path.resolve('public', 'chess-trainer-extension.zip');

try {
  if (process.platform === 'win32') {
    execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${extDir}\\*' -DestinationPath '${outZip}' -Force"`);
  } else {
    execSync(`cd "${extDir}" && zip -r "${outZip}" .`);
  }
  console.log('✓ Extension packaged to public/chess-trainer-extension.zip');
} catch (err) {
  console.warn('Warning: Failed to auto-zip extension:', err.message);
}

