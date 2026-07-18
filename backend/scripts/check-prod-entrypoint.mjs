import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

const entrypoint = process.env.BACKEND_PROD_ENTRYPOINT ?? 'dist/main.js';
if (!existsSync(entrypoint)) {
  const find = spawn('find', ['dist', '-maxdepth', '5', '-type', 'f', '-print'], {
    stdio: 'inherit',
  });
  await new Promise((resolve) => find.on('close', resolve));
  throw new Error(`Backend production entrypoint not found: ${entrypoint}`);
}
