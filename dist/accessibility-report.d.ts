import type { attachOutputTokenAccounting } from '@unbrained/pm-cli/sdk';
import type { AccessibilityResult } from './accessibility.js';
/** Hosts can inject the real SDK capability instead of loading a second host instance. */
export interface AccessibilityOutputSdk {
    /** Core owns the canonical byte/token estimator and renderer accounting. */
    readonly attachOutputTokenAccounting: typeof attachOutputTokenAccounting;
}
/** Encoded report and typed value; only text is the budgeted wire payload. */
export interface AccessibilityReport {
    /** Complete diagnosis or explicit refusal, never shortened fault coordinates. */
    readonly result: AccessibilityResult;
    /** Exact CLI bytes, including the final newline. */
    readonly text: string;
    /** Actual chosen encoding; invalid requests are refused as JSON. */
    readonly format: 'json' | 'toon';
}
/** Obtain the SDK through its supported public module entry point, independent of argv and symlinks. */
export declare function loadAccessibilityOutputSdk(): Promise<AccessibilityOutputSdk>;
/** Produce a complete report or a budget refusal retaining every failure count. */
export declare function renderAccessibilityReport(input: unknown, sdk?: AccessibilityOutputSdk): Promise<AccessibilityReport>;
