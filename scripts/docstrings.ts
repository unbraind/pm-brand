/** Enforce documentation for source declarations using the fleet's published analyzer. */
import { analyzeDocstringCoverage } from 'pm-ops/docstrings';
const report = analyzeDocstringCoverage({ root: process.cwd() });
for (const violation of report.violations) console.error(`${violation.file}:${violation.line} ${violation.symbol}: ${violation.reason}`);
console.log(`${report.declarations_checked} declarations across ${report.files_scanned} files`);
if (report.violations.length > 0) process.exit(1);
