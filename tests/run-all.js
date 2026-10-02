// tests/run-all.js - runs every test suite in the project:  npm test
import { spawnSync } from 'node:child_process';

const suites = [
  ['game engine (rules, scoring, determinism)', 'game/tests/run-tests.js'],
  ['NASA data pipeline (normalize, cache, mock server)', 'data/test_ingest.js'],
  ['CSV / MEDA / MCS converters', 'data/src/convert/selftest_convert.js'],
  ['glue: env feed, scenarios, session, full missions', 'tests/session.test.js'],
  ['UI: real page driven in a headless DOM', 'tests/ui.test.js'],
];

let failed = 0;
for (const [name, file] of suites) {
  console.log(`\n=== ${name}  (${file})`);
  const r = spawnSync(process.execPath, [file], { stdio: 'inherit' });
  if (r.status !== 0) { failed++; console.log(`>>> FAILED: ${file}`); }
}
console.log(failed ? `\n${failed} suite(s) FAILED` : '\nAll suites passed.');
process.exit(failed ? 1 : 0);
