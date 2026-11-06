import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Keep esbuild's large-file transport in a project-owned temporary directory.
// The user's Windows system TEMP directory rejects cleanup of these files.
const temp = fileURLToPath(new URL('../.local/tmp/', import.meta.url));
mkdirSync(temp, { recursive: true });
const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const result = spawnSync(process.execPath, [vite, 'build'], {
  stdio: 'inherit',
  env: { ...process.env, TEMP: temp, TMP: temp, TMPDIR: temp },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
