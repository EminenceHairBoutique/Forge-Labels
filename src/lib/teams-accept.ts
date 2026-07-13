/**
 * Pure decision logic for invitation acceptance (unit-tested; the API route
 * feeds it real rows). Kept free of Supabase types on purpose.
 */

export interface InvitationEvaluation {
  invitation: {
    email: string;
    acceptedAt: string | null;
    orgExists: boolean;
  } | null;
  userEmail: string;
  alreadyMember: boolean;
  /** Current seats in use, including the owner. */
  memberCount: number;
  /** The owner's plan seat limit. */
  maxTeamMembers: number;
  planName: string;
}

export type AcceptDecision =
  | { ok: true; alreadyMember: boolean }
  | { ok: false; status: number; error: string };

export function evaluateInvitation(input: InvitationEvaluation): AcceptDecision {
  const { invitation } = input;
  if (!invitation || !invitation.orgExists) {
    return {
      ok: false,
      status: 404,
      error: "This invitation doesn't exist or was revoked.",
    };
  }
  if (invitation.acceptedAt) {
    return { ok: false, status: 409, error: "This invitation was already used." };
  }
  if (invitation.email.trim().toLowerCase() !== input.userEmail.trim().toLowerCase()) {
    return {
      ok: false,
      status: 403,
      error: `This invitation was issued to ${invitation.email}. Sign in with that address to accept it.`,
    };
  }
  if (input.alreadyMember) {
    return { ok: true, alreadyMember: true };
  }
  if (input.memberCount >= input.maxTeamMembers) {
    return {
      ok: false,
      status: 403,
      error: `The team has reached its ${input.maxTeamMembers}-seat limit on the ${input.planName} plan.`,
    };
  }
  return { ok: true, alreadyMember: false };
}
