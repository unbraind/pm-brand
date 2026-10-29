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
/** Read strict XML into at most 4096 nodes and 32 levels; no forgiving HTML parsing. */
export declare function parseStaticSvg(source: string): StaticSvgNode[] | null;
