import {
  applyDiffSegmentDecisions,
  buildLatexDiff,
  buildLatexDiffSegments,
} from "@/lib/latex-diff";

describe("latex-diff", () => {
  it("builds a simple line diff", () => {
    const result = buildLatexDiff("a+b\nc+d", "a+b\nc + d\ne");
    expect(result).toContain("  a+b");
    expect(result).toContain("- c+d");
    expect(result).toContain("+ c + d");
    expect(result).toContain("+ e");
  });

  it("handles identical text", () => {
    const result = buildLatexDiff("x^2", "x^2");
    expect(result).toBe("  x^2");
  });

  it("splits diff into unchanged and changed segments", () => {
    const segments = buildLatexDiffSegments("a\nb\nc", "a\nb+1\nc");
    expect(segments).toHaveLength(3);
    expect(segments[0]?.kind).toBe("unchanged");
    expect(segments[1]?.kind).toBe("changed");
    expect(segments[1]?.beforeLines).toEqual(["b"]);
    expect(segments[1]?.afterLines).toEqual(["b+1"]);
  });

  it("applies segment decisions", () => {
    const segments = buildLatexDiffSegments("x+y\nz", "x + y\nz");
    const changed = segments.find((segment) => segment.kind === "changed");

    const accepted = applyDiffSegmentDecisions(segments, {
      [changed?.id ?? ""]: "accepted",
    });
    const rejected = applyDiffSegmentDecisions(segments, {
      [changed?.id ?? ""]: "rejected",
    });

    expect(accepted).toBe("x + y\nz");
    expect(rejected).toBe("x+y\nz");
  });
});
