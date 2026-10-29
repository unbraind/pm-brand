/** Canonical semantic node; locators are independent of attribute order and comments. */
export interface StaticSvgNode {
    /** Unique id anchor or structural element-index path. */
    readonly locator: string;
    /** Supported SVG element. */
    readonly tag: string;
    /** Canonical attribute and text values. */
    readonly fields: Record<string, string>;
    /** Direct element children in paint order, excluding descriptive metadata. */
    readonly children: string[];
}
/** Read strict XML into at most 4096 nodes and 32 levels; no forgiving HTML parsing. */
export declare function parseStaticSvg(source: string): StaticSvgNode[] | null;
