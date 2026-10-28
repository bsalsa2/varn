import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';

// Which commit this build is, so Systems can say which deployment is serving.
// Cloudflare Pages sets CF_PAGES_COMMIT_SHA; local builds fall back to git.
function commit() {
  if (process.env.CF_PAGES_COMMIT_SHA) return process.env.CF_PAGES_COMMIT_SHA;
  try { return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return null; }
}

export default defineConfig({
  plugins: [react()],
  base: '/',
  define: { __BUILD__: JSON.stringify({ sha: commit(), at: new Date().toISOString() }) },
  // The Command Center reads docs/MASTER_PLAN.md, bom.csv and other docs from the repository root.
  server: { fs: { allow: ['..'] } },
});
