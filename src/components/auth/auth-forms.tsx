"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/toaster";

const credentialsSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "At least 8 characters"),
});
const emailSchema = z.object({ email: z.email("Enter a valid email address") });

type Credentials = z.infer<typeof credentialsSchema>;
type EmailOnly = z.infer<typeof emailSchema>;

/**
 * Post-auth destination: honors a same-origin ?next= path (e.g. team
 * invitations) and falls back to the dashboard. Read at submit time so the
 * statically prerendered auth pages need no Suspense boundary.
 */
function nextPath(): string {
  const next = new URLSearchParams(location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

function OAuthButton({
  provider,
  label,
}: {
  provider: "google" | "apple";
  label: string;
}) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      loading={busy}
      onClick={async () => {
        const supabase = getSupabaseBrowser();
        if (!supabase) return;
        setBusy(true);
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(nextPath())}`,
          },
        });
        if (error) {
          toast.error("Sign-in failed", error.message);
          setBusy(false);
        }
      }}
    >
      {label}
    </Button>
  );
}

/**
 * OAuth provider buttons. Apple appears only behind NEXT_PUBLIC_AUTH_APPLE=1
 * because the provider needs Apple Developer + Supabase dashboard setup
 * first — an unconfigured button would be a dead end.
 */
function OAuthButtons({ mode }: { mode: "in" | "up" }) {
  return (
    <>
      <OAuthButton provider="google" label={`Sign ${mode} with Google`} />
      {process.env.NEXT_PUBLIC_AUTH_APPLE === "1" && (
        <OAuthButton provider="apple" label={`Sign ${mode} with Apple`} />
      )}
    </>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [magicSent, setMagicSent] = React.useState(false);
  const [mfaFactorId, setMfaFactorId] = React.useState<string | null>(null);
  const [mfaCode, setMfaCode] = React.useState("");
  const [mfaBusy, setMfaBusy] = React.useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Credentials>({ resolver: zodResolver(credentialsSchema) });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error("Sign-in failed", error.message);
      return;
    }
    // Accounts with a verified TOTP factor stop at aal1 until a code passes.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel) {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp.find((f) => f.status === "verified");
      if (totp) {
        setMfaFactorId(totp.id);
        return;
      }
    }
    router.push(nextPath());
  });

  async function verifyMfa() {
    const supabase = getSupabaseBrowser();
    if (!supabase || !mfaFactorId || mfaCode.trim().length < 6) return;
    setMfaBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: mfaFactorId,
      code: mfaCode.trim(),
    });
    setMfaBusy(false);
    if (error) {
      toast.error("That code didn't verify", "Check your authenticator app and try again.");
      setMfaCode("");
      return;
    }
    router.push(nextPath());
  }

  if (mfaFactorId) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This account is protected with two-factor authentication. Enter the
          6-digit code from your authenticator app.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="login-mfa-code">Authentication code</Label>
          <Input
            id="login-mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            autoFocus
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void verifyMfa();
            }}
            className="tracking-widest"
          />
        </div>
        <Button
          className="w-full"
          loading={mfaBusy}
          disabled={mfaCode.trim().length < 6}
          onClick={() => void verifyMfa()}
        >
          Verify & sign in
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => {
            setMfaFactorId(null);
            setMfaCode("");
          }}
        >
          Back to sign-in
        </Button>
      </div>
    );
  }

  async function sendMagicLink() {
    const supabase = getSupabaseBrowser();
    const email = getValues("email");
    if (!supabase || !z.email().safeParse(email).success) {
      toast.error("Enter your email first");
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(nextPath())}`,
      },
    });
    if (error) toast.error("Couldn't send the link", error.message);
    else setMagicSent(true);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="login-email">Email</Label>
        <Input id="login-email" type="email" autoComplete="email" {...register("email")} />
        <FieldError message={errors.email?.message} />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-xs text-primary underline-offset-2 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
        />
        <FieldError message={errors.password?.message} />
      </div>
      <Button type="submit" className="w-full" loading={isSubmitting}>
        Sign in
      </Button>
      <Separator />
      <OAuthButtons mode="in" />
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        disabled={magicSent}
        onClick={() => void sendMagicLink()}
      >
        {magicSent ? "Magic link sent — check your inbox" : "Email me a magic link"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/signup" className="text-primary underline-offset-2 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function SignupForm() {
  const [sent, setSent] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Credentials>({ resolver: zodResolver(credentialsSchema) });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(nextPath())}`,
      },
    });
    if (error) {
      toast.error("Sign-up failed", error.message);
      return;
    }
    setSent(email);
  });

  if (sent) {
    return (
      <p className="text-sm text-muted-foreground">
        We sent a confirmation link to{" "}
        <span className="font-medium text-foreground">{sent}</span>. Open it to
        activate your account — then your local projects can be imported to the
        cloud.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="signup-email">Email</Label>
        <Input id="signup-email" type="email" autoComplete="email" {...register("email")} />
        <FieldError message={errors.email?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-password">Password</Label>
        <Input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          {...register("password")}
        />
        <FieldError message={errors.password?.message} />
      </div>
      <Button type="submit" className="w-full" loading={isSubmitting}>
        Create account
      </Button>
      <Separator />
      <OAuthButtons mode="up" />
      <p className="text-center text-sm text-muted-foreground">
        Already registered?{" "}
        <Link href="/login" className="text-primary underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [sent, setSent] = React.useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailOnly>({ resolver: zodResolver(emailSchema) });

  const onSubmit = handleSubmit(async ({ email }) => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?next=/reset-password`,
    });
    if (error) {
      toast.error("Couldn't send the reset email", error.message);
      return;
    }
    setSent(true);
  });

  if (sent) {
    return (
      <p className="text-sm text-muted-foreground">
        If that address has an account, a reset link is on its way.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="forgot-email">Email</Label>
        <Input id="forgot-email" type="email" autoComplete="email" {...register("email")} />
        <FieldError message={errors.email?.message} />
      </div>
      <Button type="submit" className="w-full" loading={isSubmitting}>
        Send reset link
      </Button>
    </form>
  );
}

const newPasswordSchema = z.object({
  password: z.string().min(8, "At least 8 characters"),
});

export function ResetPasswordForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof newPasswordSchema>>({
    resolver: zodResolver(newPasswordSchema),
  });

  const onSubmit = handleSubmit(async ({ password }) => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error("Couldn't update the password", error.message);
      return;
    }
    toast.success("Password updated");
    router.push("/dashboard");
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="reset-password">New password</Label>
        <Input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          {...register("password")}
        />
        <FieldError message={errors.password?.message} />
      </div>
      <Button type="submit" className="w-full" loading={isSubmitting}>
        Set new password
      </Button>
    </form>
  );
}
