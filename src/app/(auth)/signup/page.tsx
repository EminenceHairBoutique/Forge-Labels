import type { Metadata } from "next";
import { AuthShell, CloudRequiredNotice, cloudModeActive } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Save projects to the cloud and unlock plan features."
    >
      {cloudModeActive() ? <SignupForm /> : <CloudRequiredNotice />}
    </AuthShell>
  );
}
