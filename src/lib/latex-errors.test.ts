import { getErrorLocation, parseErrorPosition } from "@/lib/latex-errors";

describe("latex-errors", () => {
  it("extracts position from render errors", () => {
    const offset = parseErrorPosition("ParseError: ... at position 15: ...");
    expect(offset).toBe(15);
  });

  it("returns null for messages without position", () => {
    expect(parseErrorPosition("bad input")).toBeNull();
  });

  it("maps offset to line and column", () => {
    const location = getErrorLocation("a+b\n\\frac{1}{", 9);
    expect(location).toEqual({
      offset: 9,
      line: 2,
      column: 5,
    });
  });
});
