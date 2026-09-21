const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Static-export build for the Tauri desktop and Capacitor Android targets.
 *
 * `output: 'export'` (next.config.ts) renders everything ahead of time, so any route that needs a
 * running server cannot exist in the tree at build time. The app has two kinds:
 *   src/app/api/*      — POST handlers (resolve-email, forgot-password, supervisor/add-leave)
 *   src/app/updater/*  — the update manifest proxy, which fetches live and sets force-dynamic
 * Neither ships inside the app anyway: the desktop and Android builds reach them over the network
 * at chuti.bnfcorporate.com. So they are moved aside for the build and restored afterwards.
 *
 * Leaving one behind fails the build with "Failed to collect page data" — after the Rust toolchain
 * has already installed on the 2x Windows and 10x macOS runners.
 */
const SERVER_ONLY_ROUTES = ['api', 'updater'];
const BACKUP_ROOT = path.join(__dirname, '..', 'src', '.route-backup');

const isCapacitor = process.env.IS_CAPACITOR_BUILD === 'true';
const moved = [];
let failed = false;

try {
  fs.mkdirSync(BACKUP_ROOT, { recursive: true });

  for (const name of SERVER_ONLY_ROUTES) {
    const from = path.join(__dirname, '..', 'src', 'app', name);
    const to = path.join(BACKUP_ROOT, name);
    if (!fs.existsSync(from)) continue;

    console.log(`Temporarily moving src/app/${name} out of the tree for static export...`);
    try {
      fs.renameSync(from, to);
      moved.push({ from, to });
    } catch (renameError) {
      if (renameError.code === 'EPERM' || renameError.code === 'EBUSY') {
        console.error(`\n❌ ERROR: Cannot move src/app/${name} — it is locked by another process.`);
        console.error('👉 Stop the dev server (npm run dev) if it is running, then try again.\n');
      } else {
        console.error('Rename error:', renameError);
      }
      failed = true;
      throw renameError;
    }
  }

  // Tauri pins webpack; the Android path keeps whatever `next build` defaults to, so this script
  // can serve both without silently changing the bundler Android has always shipped.
  const buildCmd = isCapacitor ? 'npx next build' : 'npx next build --webpack';
  console.log(`Running Next.js production build (${isCapacitor ? 'capacitor' : 'tauri'})...`);
  execSync(buildCmd, {
    env: { ...process.env, ...(isCapacitor ? {} : { IS_TAURI_BUILD: 'true' }) },
    stdio: 'inherit',
  });

  console.log('Static export build completed successfully.');
} catch (error) {
  console.error('Next.js build failed:', error && error.message ? error.message : error);
  failed = true;
} finally {
  // Restore in reverse so a partial move still unwinds cleanly.
  for (const { from, to } of moved.reverse()) {
    if (fs.existsSync(to)) {
      console.log(`Restoring ${path.relative(path.join(__dirname, '..'), from)}...`);
      fs.renameSync(to, from);
    }
  }
  if (fs.existsSync(BACKUP_ROOT) && fs.readdirSync(BACKUP_ROOT).length === 0) {
    fs.rmdirSync(BACKUP_ROOT);
  }
}

if (failed) {
  process.exit(1);
}
