/** Canonical semantic node; locators are independent of attribute order and comments. */
export interface StaticSvgNode {
    /** Unique id anchor or structural element-index path. */
    readonly locator: string;
    /** Supported SVG element. */
    readonly tag: string;
    /** Parent identity remains semantic even when an XML id anchors this node. */
    readonly parent: string | null;
    /** Canonical attribute and text values. */
    readonly fields: Record<string, string>;
    /** Retained direct children in source order; grouped glyphs are represented by their outline digest. */
    readonly children: string[];
}
/** Distinguish XML/limit failures from well-formed constructs outside the comparison domain. */
export interface StaticSvgRefusal {
    /** Malformed XML or exceeded limits, versus unsupported semantic interpretation. */
    readonly code: 'unsupported_svg' | 'unsupported_semantics';
}
/** Read XML 1.0 with a maintained parser, then project the bounded static SVG domain. */
export declare function parseStaticSvg(source: string): StaticSvgNode[] | StaticSvgRefusal;
