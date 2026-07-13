"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Client action for a signed-in invitee: POST the token, then go to /team. */
export function AcceptInvitation({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/team/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = (await res.json()) as { error?: string; orgName?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      router.push("/team");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join the team</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          You’re signed in as <strong>{email}</strong>. Accepting adds this
          account to the team that invited you; you’ll see the team’s projects
          on your dashboard.
        </p>
        {error && (
          <Callout variant="warning" title="Couldn't accept the invitation">
            {error}
          </Callout>
        )}
        <Button loading={busy} onClick={() => void accept()}>
          <Users className="size-4" aria-hidden />
          Accept invitation
        </Button>
      </CardContent>
    </Card>
  );
}
