import type { Metadata } from "next";
import { AuthShell, CloudRequiredNotice, cloudModeActive } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Choose a new password">
      {cloudModeActive() ? <ResetPasswordForm /> : <CloudRequiredNotice />}
    </AuthShell>
  );
}
