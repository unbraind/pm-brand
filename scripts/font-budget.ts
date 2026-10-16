/** Enforce the decimal 120 KB payload ceiling on all distributed font binaries. */
import { readdirSync, statSync } from 'node:fs';
/** Per-file bytes make a failing budget actionable in CI. */
const files = readdirSync('fonts').filter(file => /\.(woff2?|ttf|otf)$/i.test(file));
const rows = files.map(file => ({ file, bytes: statSync(`fonts/${file}`).size }));
console.table(rows);
const total = rows.reduce((sum, row) => sum + row.bytes, 0);
console.log(`Font payload: ${total} / 120000 bytes`);
if (files.length !== 3 || total > 120_000) process.exit(1);
