import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const publicDir = join(appDir, 'public');

function assert(condition, message) {
  if (!condition) {
    throw new Error(`debug-client smoke failed - ${message}`);
  }
}

const html = readFileSync(join(publicDir, 'index.html'), 'utf8');
const js = readFileSync(join(publicDir, 'app.js'), 'utf8');
const css = readFileSync(join(publicDir, 'styles.css'), 'utf8');

for (const action of [
  'loadState',
  'startTutorial',
  'driveTick',
  'simulateOffline',
  'claimReport',
  'completeLandmark',
  'refuel',
  'completeRoute',
  'unlockShortRoute',
  'runDemo',
]) {
  assert(html.includes(`data-action="${action}"`), `missing ${action} button`);
}

for (const endpoint of [
  '/player/state',
  '/routes/start',
  '/debug/prime-drive-tick',
  '/trip/drive-tick',
  '/debug/simulate-offline',
  '/trip/claim-offline-report',
  '/trip/complete-landmark',
  '/vehicle/refuel',
  '/trip/complete-route',
  '/routes/unlock',
]) {
  assert(js.includes(endpoint), `missing API call ${endpoint}`);
}

assert(css.includes('.drive-stage'), 'missing driving stage styles');
assert(html.includes('/assets/art/scene_packs/california_hwy_1/bigsur_sunset/review/'), 'missing Big Sur visual asset');

console.log('debug-client smoke ok - required controls, API calls, and visual anchor are present.');
