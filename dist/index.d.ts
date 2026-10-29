/** Typed Triplicate tokens and CSS variable references. */
export { tokens, cssVar } from './tokens.js';
export type { TokenName, Theme } from './tokens.js';
export { diagnoseAccessibility } from './accessibility.js';
export type { AccessibilityRequest, AccessibilityResult, AccessibilityDiagnosis, AccessibilityFault, AccessibilityRefusal, AccessibilitySummary, BrandColorTokenName, RenderedAccessibilityPair, ResolvedBrandRole } from './accessibility.js';
export { preflightFontCoverage } from './font-coverage.js';
export type { FontCoverageLabel, FontCoverageRequest, FontCoverageSummary, FontCoverageIssue, FontCoverageRow, FontCoverageDiagnosis, FontCoverageRefusal, FontCoverageResult, FontCoverageReport } from './font-coverage.js';
