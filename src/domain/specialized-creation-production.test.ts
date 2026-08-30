import { describe, expect, it } from "vitest";
import { createProductionSpec, validateProductionSpec } from "./specialized-creation-production";

describe("specialized creation production", () => {
  it("assigns production artifact capabilities by office mode", () => {
    const comic = createProductionSpec("comic-book", { widthInches: 6.625, heightInches: 10.25, bleedInches: 0.125, safeMarginInches: 0.25, dpi: 300, colorProfile: "CMYK" });
    expect(comic.allowedArtifacts).toContain("cbz");
    expect(comic.allowedArtifacts).toContain("print-pdf");

    const cards = createProductionSpec("trading-card-game", { widthInches: 2.5, heightInches: 3.5, bleedInches: 0.125, safeMarginInches: 0.25, dpi: 300, colorProfile: "CMYK" });
    expect(cards.allowedArtifacts).toContain("data");
    expect(cards.allowedArtifacts).toContain("svg");
  });

  it("blocks unsafe print specifications", () => {
    const spec = createProductionSpec("flyer", { widthInches: 8.5, heightInches: 11, bleedInches: 0.125, safeMarginInches: 0.1, dpi: 150, colorProfile: "sRGB" });
    const issues = validateProductionSpec(spec, "print-pdf");
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["INVALID_SAFE_MARGIN", "INVALID_DPI"]));
    expect(issues.every((issue) => issue.blocking)).toBe(true);
  });
});
