/** Measure all four coverage dimensions across every authored source file. */
import { execFileSync } from 'node:child_process';
execFileSync('node', ['node_modules/c8/bin/c8.js', '--all', '--include=dist/**/*.js', '--reporter=text', '--reporter=json-summary', '--check-coverage', '--statements=100', '--branches=100', '--functions=100', '--lines=100', 'node', '--test', 'test/*.test.ts'], { stdio: 'inherit' });
