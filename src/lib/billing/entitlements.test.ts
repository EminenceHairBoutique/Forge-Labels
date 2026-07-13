import { describe, expect, it } from "vitest";
import { resolveFromState } from "./entitlements";

describe("resolveFromState", () => {
  it("unlocks everything in local demo mode", () => {
    const demo = resolveFromState({ mode: "local", signedIn: false, planId: null });
    expect(demo.source).toBe("demo");
    expect(demo.entitlements.csvBatch).toBe(true);
    expect(demo.entitlements.productionLayers).toBe(true);
    expect(demo.entitlements.maxProjects).toBeNull();
  });

  it("gives cloud guests and no-plan users the free tier", () => {
    const guest = resolveFromState({ mode: "cloud", signedIn: false, planId: null });
    expect(guest.source).toBe("free");
    expect(guest.entitlements.csvBatch).toBe(false);
    const noPlan = resolveFromState({ mode: "cloud", signedIn: true, planId: null });
    expect(noPlan.planId).toBe("free");
  });

  it("resolves seed entitlements for a subscription plan", () => {
    const business = resolveFromState({
      mode: "cloud",
      signedIn: true,
      planId: "business",
    });
    expect(business.source).toBe("subscription");
    expect(business.entitlements.csvBatch).toBe(true);
    const pro = resolveFromState({ mode: "cloud", signedIn: true, planId: "pro" });
    expect(pro.entitlements.csvBatch).toBe(false);
    expect(pro.entitlements.svgExport).toBe(true);
  });

  it("lets database entitlements override the seed", () => {
    const custom = resolveFromState({
      mode: "cloud",
      signedIn: true,
      planId: "pro",
      dbEntitlements: { csvBatch: true },
      dbPlanName: "Pro (grandfathered)",
    });
    expect(custom.entitlements.csvBatch).toBe(true);
    expect(custom.planName).toBe("Pro (grandfathered)");
    // Unspecified flags keep their seed values.
    expect(custom.entitlements.brandKits).toBe(true);
  });

  it("falls back to free for unknown plan ids", () => {
    const unknown = resolveFromState({
      mode: "cloud",
      signedIn: true,
      planId: "legacy-gold",
    });
    expect(unknown.entitlements.csvBatch).toBe(false);
  });
});
