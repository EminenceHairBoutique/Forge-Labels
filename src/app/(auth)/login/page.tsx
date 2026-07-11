import type { Metadata } from "next";
import { AuthShell, CloudRequiredNotice, cloudModeActive } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your Forge Labels account.">
      {cloudModeActive() ? <LoginForm /> : <CloudRequiredNotice />}
    </AuthShell>
  );
}
