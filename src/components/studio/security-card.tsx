"use client";

import * as React from "react";
import { CloudOff, KeyRound, ShieldCheck, Trash2 } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";

/**
 * Two-factor authentication (TOTP) via Supabase MFA. Cloud + signed-in
 * only; local demo mode gets an honest explanation instead of dead
 * controls. Enrollment: enroll → scan QR (secret shown as fallback) →
 * verify a code → factor active. Sign-in then requires a code (see the
 * MFA step in auth-forms.tsx).
 */

interface Factor {
  id: string;
  friendly_name?: string | null;
  factor_type: string;
  status: "verified" | "unverified";
  created_at: string;
}

interface Enrollment {
  factorId: string;
  qrCode: string; // data:image/svg+xml… from Supabase
  secret: string;
}

export function SecurityCard() {
  const status = useAuthStore((s) => s.status);
  const [factors, setFactors] = React.useState<Factor[] | null>(null);
  const [enrollment, setEnrollment] = React.useState<Enrollment | null>(null);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [removeTarget, setRemoveTarget] = React.useState<Factor | null>(null);

  const [reloadTick, setReloadTick] = React.useState(0);

  const supabase = getSupabaseBrowser();
  const refreshFactors = () => setReloadTick((t) => t + 1);

  React.useEffect(() => {
    if (status !== "signed-in" || !supabase) return;
    let alive = true;
    supabase.auth.mfa
      .listFactors()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          toast.error("Couldn't load your security settings", error.message);
          return;
        }
        setFactors((data.totp as Factor[]).filter((f) => f.status === "verified"));
      })
      .catch(() => {
        if (alive) toast.error("Couldn't load your security settings");
      });
    return () => {
      alive = false;
    };
  }, [status, supabase, reloadTick]);

  async function startEnrollment() {
    if (!supabase) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Authenticator (${new Date().toISOString().slice(0, 10)})`,
      });
      if (error) throw error;
      setCode("");
      setEnrollment({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
    } catch (err) {
      toast.error(
        "Couldn't start enrollment",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnrollment() {
    if (!supabase || !enrollment || code.trim().length < 6) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrollment.factorId,
        code: code.trim(),
      });
      if (error) throw error;
      setEnrollment(null);
      setCode("");
      toast.success("Two-factor authentication is on", "Codes are required at sign-in.");
      refreshFactors();
    } catch (err) {
      toast.error(
        "That code didn't verify",
        err instanceof Error ? err.message : "Check your authenticator app and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function cancelEnrollment() {
    if (!supabase || !enrollment) return;
    // Clean up the unverified factor so it doesn't linger in the list.
    await supabase.auth.mfa.unenroll({ factorId: enrollment.factorId }).catch(() => {});
    setEnrollment(null);
    setCode("");
  }

  async function removeFactor() {
    if (!supabase || !removeTarget) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: removeTarget.id });
      if (error) throw error;
      setRemoveTarget(null);
      toast.success("Two-factor authentication removed");
      refreshFactors();
    } catch (err) {
      toast.error(
        "Couldn't remove the factor",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Security</CardTitle>
        <CardDescription>
          Two-factor authentication with an authenticator app (TOTP).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "local" && (
          <Callout variant="info" title="Requires cloud mode">
            <span className="inline-flex items-center gap-1">
              <CloudOff className="size-3.5" aria-hidden /> Local demo mode has no
              accounts,
            </span>{" "}
            so there is nothing to protect with a second factor. Configure
            Supabase (see <code>docs/SETUP.md</code>) to enable sign-in and MFA.
          </Callout>
        )}
        {status === "signed-out" && (
          <p className="text-sm text-muted-foreground">
            Sign in to manage two-factor authentication for your account.
          </p>
        )}

        {status === "signed-in" && (
          <>
            {factors !== null && factors.length > 0 && (
              <ul className="space-y-2" aria-label="Enrolled factors">
                {factors.map((factor) => (
                  <li
                    key={factor.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <ShieldCheck className="size-4 text-success" aria-hidden />
                      {factor.friendly_name || "Authenticator app"}
                      <span className="text-xs text-muted-foreground">
                        added {new Date(factor.created_at).toLocaleDateString()}
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${factor.friendly_name || "authenticator"}`}
                      onClick={() => setRemoveTarget(factor)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {enrollment ? (
              <div className="space-y-3 rounded-lg border border-border p-4">
                <p className="text-sm font-medium">Scan with your authenticator app</p>
                {/* eslint-disable-next-line @next/next/no-img-element -- Supabase returns the QR as a data URL */}
                <img
                  src={enrollment.qrCode}
                  alt="TOTP enrollment QR code"
                  className="size-40 rounded bg-white p-2"
                />
                <p className="text-xs text-muted-foreground">
                  Can&apos;t scan? Enter this secret manually:{" "}
                  <code className="select-all break-all">{enrollment.secret}</code>
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="mfa-enroll-code">6-digit code from the app</Label>
                  <Input
                    id="mfa-enroll-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={8}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void confirmEnrollment();
                    }}
                    className="w-36 tracking-widest"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    loading={busy}
                    disabled={code.trim().length < 6}
                    onClick={() => void confirmEnrollment()}
                  >
                    Verify & activate
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void cancelEnrollment()}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                loading={busy}
                onClick={() => void startEnrollment()}
                disabled={factors === null}
              >
                <KeyRound className="size-4" aria-hidden />
                {factors && factors.length > 0
                  ? "Add another authenticator"
                  : "Set up two-factor authentication"}
              </Button>
            )}
          </>
        )}
      </CardContent>

      <Dialog open={removeTarget !== null} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove two-factor authentication?</DialogTitle>
            <DialogDescription>
              Sign-in will no longer ask for a code from{" "}
              {removeTarget?.friendly_name || "this authenticator"}. You can re-enroll
              at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" loading={busy} onClick={() => void removeFactor()}>
              Remove factor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
