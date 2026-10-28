#!/usr/bin/env node
/** Read-only standalone command; normal package resolution works through global and runner installs. */
import { open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { renderAccessibilityReport } from './accessibility-report.js';
import { renderFontCoverageReport } from './font-coverage.js';
/** Emit a small, sanitized JSON refusal for command/file boundary errors. */
function fail(code, remedy) {
    console.log(JSON.stringify({ ok: false, code, path: '$', remedy }));
    process.exitCode = 2;
}
/** Bound file reads to 4 MiB before parsing; never echo paths or raw parser errors. */
async function run() {
    const [command, file, ...rest] = process.argv.slice(2);
    if (command === '--help' && file === undefined) {
        console.log('Usage: pm-brand diagnose <components.json> | font-coverage <labels.json> [--format json|toon] [--budget 512..1000000]');
        return;
    }
    if ((command !== 'diagnose' && command !== 'font-coverage') || !file) {
        fail('usage', 'Run pm-brand diagnose <components.json> or pm-brand font-coverage <labels.json> [--format json|toon] [--budget 512..1000000].');
        return;
    }
    const overrides = {};
    for (let index = 0; index < rest.length; index += 2) {
        const flag = rest[index];
        const value = rest[index + 1];
        if ((flag !== '--format' && flag !== '--budget') || value === undefined || Object.hasOwn(overrides, flag.slice(2))) {
            fail('usage', 'Use each of --format and --budget at most once, with a value.');
            return;
        }
        overrides[flag.slice(2)] = flag === '--budget' ? (/^\d+$/u.test(value) ? Number(value) : null) : value;
    }
    let input;
    try {
        const handle = await open(file, constants.O_RDONLY | constants.O_NONBLOCK);
        try {
            const stat = await handle.stat();
            if (!stat.isFile()) {
                fail('input_unreadable', 'Supply a regular UTF-8 JSON file no larger than 4 MiB.');
                return;
            }
            const buffer = Buffer.alloc(4 * 1024 * 1024 + 1);
            let bytesRead = 0;
            while (bytesRead < buffer.length) {
                const part = await handle.read(buffer, bytesRead, buffer.length - bytesRead, bytesRead);
                if (part.bytesRead === 0)
                    break;
                bytesRead += part.bytesRead;
            }
            if (bytesRead > 4 * 1024 * 1024) {
                fail('input_unreadable', 'Supply a regular UTF-8 JSON file no larger than 4 MiB.');
                return;
            }
            input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, bytesRead)));
        }
        finally {
            await handle.close();
        }
    }
    catch {
        fail('input_unreadable', 'Supply a readable UTF-8 file containing valid request JSON for the chosen command.');
        return;
    }
    // Non-object JSON still reaches the one schema instead of being spread into an accidental object.
    if (input !== null && typeof input === 'object' && !Array.isArray(input))
        input = { ...input, ...overrides };
    const report = command === 'font-coverage' ? await renderFontCoverageReport(input) : await renderAccessibilityReport(input);
    process.stdout.write(report.text);
    process.exitCode = report.result.ok ? (report.result.summary.failed === 0 ? 0 : 1) : 2;
}
await run();
