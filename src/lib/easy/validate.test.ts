import { describe, expect, it } from "vitest";
import { EASY_TEMPLATES } from "./templates";
import { validateAllTemplates, validationSizes } from "./validate";

/**
 * The shipping gate: no template enters the registry unless the whole
 * quality matrix passes. `npm run validate:templates` runs this same
 * suite with a verbose per-template report.
 */

describe("template quality gates (§21)", () => {
  it("exercises real vial geometries plus the edge shapes", () => {
    const ids = validationSizes().map((s) => s.id);
    expect(ids).toContain("10ml-serum");
    expect(ids).toContain("20ml-serum");
    expect(ids).toContain("30ml-serum");
    expect(ids).toContain("narrow");
    expect(ids).toContain("wide-wrap");
    expect(ids).toContain("short");
    expect(ids).toContain("tall");
  });

  it("every template passes the full validation matrix", () => {
    const issues = validateAllTemplates();
    const errors = issues.filter((i) => i.severity === "error");
    const lines = errors
      .slice(0, 40)
      .map((i) => `${i.templateId} [${i.context}]: ${i.message}`);
    expect(
      errors.length,
      `\n${lines.join("\n")}${errors.length > 40 ? `\n…and ${errors.length - 40} more` : ""}\n`,
    ).toBe(0);
  });

  it("warnings are visible but bounded", () => {
    const warnings = validateAllTemplates().filter((i) => i.severity === "warning");
    // Warnings are honest signals, not failures — but a flood means a
    // systemic design problem slipped into the registry.
    expect(warnings.length).toBeLessThanOrEqual(EASY_TEMPLATES.length * 3);
  });
});
