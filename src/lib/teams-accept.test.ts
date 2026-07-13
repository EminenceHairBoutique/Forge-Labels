import { describe, expect, it } from "vitest";
import { evaluateInvitation, type InvitationEvaluation } from "./teams-accept";

function base(overrides: Partial<InvitationEvaluation> = {}): InvitationEvaluation {
  return {
    invitation: { email: "invitee@example.com", acceptedAt: null, orgExists: true },
    userEmail: "invitee@example.com",
    alreadyMember: false,
    memberCount: 2,
    maxTeamMembers: 5,
    planName: "Business",
    ...overrides,
  };
}

describe("evaluateInvitation", () => {
  it("accepts a valid invitation", () => {
    expect(evaluateInvitation(base())).toEqual({ ok: true, alreadyMember: false });
  });

  it("404s unknown or org-less tokens", () => {
    expect(evaluateInvitation(base({ invitation: null }))).toMatchObject({
      ok: false,
      status: 404,
    });
    expect(
      evaluateInvitation(
        base({ invitation: { email: "x@y.z", acceptedAt: null, orgExists: false } }),
      ),
    ).toMatchObject({ ok: false, status: 404 });
  });

  it("409s reused invitations", () => {
    expect(
      evaluateInvitation(
        base({
          invitation: {
            email: "invitee@example.com",
            acceptedAt: "2026-07-01T00:00:00Z",
            orgExists: true,
          },
        }),
      ),
    ).toMatchObject({ ok: false, status: 409 });
  });

  it("403s a signed-in email that doesn't match (case-insensitively)", () => {
    expect(
      evaluateInvitation(base({ userEmail: "other@example.com" })),
    ).toMatchObject({ ok: false, status: 403 });
    expect(
      evaluateInvitation(base({ userEmail: "  INVITEE@Example.COM " })),
    ).toEqual({ ok: true, alreadyMember: false });
  });

  it("is idempotent for existing members even at the seat limit", () => {
    expect(
      evaluateInvitation(base({ alreadyMember: true, memberCount: 5 })),
    ).toEqual({ ok: true, alreadyMember: true });
  });

  it("403s when the owner's plan is out of seats, naming the plan", () => {
    const decision = evaluateInvitation(base({ memberCount: 5 }));
    expect(decision).toMatchObject({ ok: false, status: 403 });
    if (!decision.ok) expect(decision.error).toContain("Business");
  });
});
