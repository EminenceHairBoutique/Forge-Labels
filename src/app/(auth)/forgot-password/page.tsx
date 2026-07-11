import type { Metadata } from "next";
import { AuthShell, CloudRequiredNotice, cloudModeActive } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a secure reset link."
    >
      {cloudModeActive() ? <ForgotPasswordForm /> : <CloudRequiredNotice />}
    </AuthShell>
  );
}
