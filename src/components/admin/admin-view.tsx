"use client";

import * as React from "react";
import Link from "next/link";
import { ShieldAlert, UploadCloud } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { ALL_TEMPLATES } from "@/lib/templates/registry";
import { useAuthStore } from "@/stores/auth-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toaster";

/**
 * Admin dashboard (cloud mode; requires the admin platform role, which is
 * granted via SQL — see docs/SETUP.md). Client-side queries run under RLS:
 * a non-admin gets empty/denied results even if they reach this page.
 */

interface TemplateRow {
  id: string;
  slug: string;
  name: string;
  brand: string;
  premium: boolean;
  status: "draft" | "published";
  updated_at: string;
}

interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  current_period_end: string | null;
}

export function AdminView() {
  const status = useAuthStore((s) => s.status);
  const isAdmin = useAuthStore((s) => s.isAdmin);

  if (status === "local") {
    return (
      <Gate>
        <Callout variant="info" title="Admin requires cloud mode">
          The admin dashboard manages database content (templates, plans,
          users) and activates once Supabase is configured. See{" "}
          <code>docs/SETUP.md</code>.
        </Callout>
      </Gate>
    );
  }
  if (status === "loading") {
    return (
      <Gate>
        <Skeleton className="h-40" />
      </Gate>
    );
  }
  if (status === "signed-out" || !isAdmin) {
    return (
      <Gate>
        <Callout variant="warning" title="Administrators only">
          <span className="inline-flex items-center gap-1">
            <ShieldAlert className="size-3.5" aria-hidden /> This area needs the
            admin role.
          </span>{" "}
          Admins are granted via SQL:{" "}
          <code>insert into user_roles (user_id, role) values (…, &apos;admin&apos;)</code>{" "}
          using the service role (see docs/SETUP.md).{" "}
          <Link href="/dashboard" className="text-primary underline-offset-2 hover:underline">
            Back to the studio
          </Link>
        </Callout>
      </Gate>
    );
  }

  return (
    <Gate>
      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
        </TabsList>
        <TabsContent value="templates">
          <TemplatesAdmin />
        </TabsContent>
        <TabsContent value="users">
          <UsersAdmin />
        </TabsContent>
        <TabsContent value="subscriptions">
          <SubscriptionsAdmin />
        </TabsContent>
      </Tabs>
    </Gate>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Platform content and account overview.
        </p>
      </div>
      {children}
    </div>
  );
}

function TemplatesAdmin() {
  const [rows, setRows] = React.useState<TemplateRow[] | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    getSupabaseBrowser()
      ?.from("templates")
      .select("id,slug,name,brand,premium,status,updated_at")
      .order("updated_at", { ascending: false })
      .then(({ data, error }: { data: unknown; error: { message: string } | null }) => {
        if (!alive) return;
        if (error) toast.error("Couldn't load templates", error.message);
        setRows((data as TemplateRow[]) ?? []);
      });
    return () => {
      alive = false;
    };
  }, [tick]);

  async function seedFromCode() {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    setBusy("seed");
    try {
      const payload = ALL_TEMPLATES.map((t) => ({
        slug: t.id,
        name: t.name,
        brand: t.brand,
        description: t.description,
        categories: t.categories,
        premium: t.premium,
        preset_id: t.presetId,
        doc: t.doc,
        status: "published",
      }));
      const { error } = await supabase
        .from("templates")
        .upsert(payload, { onConflict: "slug" });
      if (error) throw new Error(error.message);
      toast.success(`Seeded ${payload.length} templates from the code registry`);
      setTick((t) => t + 1);
    } catch (err) {
      toast.error("Seeding failed", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(row: TemplateRow, next: "draft" | "published") {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    setBusy(row.id);
    const { error } = await supabase
      .from("templates")
      .update({ status: next })
      .eq("id", row.id);
    if (error) toast.error("Update failed", error.message);
    setBusy(null);
    setTick((t) => t + 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Database templates power the gallery in cloud mode. Seed them from
          the built-in library, then publish/unpublish individually.
        </p>
        <Button loading={busy === "seed"} onClick={() => void seedFromCode()}>
          <UploadCloud className="size-4" aria-hidden />
          Seed from code registry
        </Button>
      </div>
      {rows === null ? (
        <Skeleton className="h-40" />
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          No database templates yet — seed from the code registry above.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{row.name}</p>
                <p className="text-xs text-muted-foreground">
                  {row.brand} · {row.slug}
                </p>
              </div>
              {row.premium && <Badge variant="accent">Pro</Badge>}
              <Badge variant={row.status === "published" ? "success" : "secondary"}>
                {row.status}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                loading={busy === row.id}
                onClick={() =>
                  void setStatus(row, row.status === "published" ? "draft" : "published")
                }
              >
                {row.status === "published" ? "Unpublish" : "Publish"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UsersAdmin() {
  const [rows, setRows] = React.useState<UserRow[] | null>(null);

  React.useEffect(() => {
    let alive = true;
    getSupabaseBrowser()
      ?.from("profiles")
      .select("id,email,display_name,created_at")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data, error }: { data: unknown; error: { message: string } | null }) => {
        if (!alive) return;
        if (error) toast.error("Couldn't load users", error.message);
        setRows((data as UserRow[]) ?? []);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (rows === null) return <Skeleton className="h-40" />;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{rows.length} users</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between py-2 text-sm">
              <span>{row.email}</span>
              <span className="text-xs text-muted-foreground">
                joined {new Date(row.created_at).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function SubscriptionsAdmin() {
  const [rows, setRows] = React.useState<SubscriptionRow[] | null>(null);

  React.useEffect(() => {
    let alive = true;
    getSupabaseBrowser()
      ?.from("subscriptions")
      .select("id,user_id,plan_id,status,current_period_end")
      .order("updated_at", { ascending: false })
      .limit(200)
      .then(({ data, error }: { data: unknown; error: { message: string } | null }) => {
        if (!alive) return;
        if (error) toast.error("Couldn't load subscriptions", error.message);
        setRows((data as SubscriptionRow[]) ?? []);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (rows === null) return <Skeleton className="h-40" />;
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
        No subscriptions yet.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
          <span className="flex-1 font-mono text-xs">{row.id}</span>
          <Badge variant="secondary" className="capitalize">
            {row.plan_id}
          </Badge>
          <Badge variant={row.status === "active" ? "success" : "warning"}>
            {row.status}
          </Badge>
          {row.current_period_end && (
            <span className="text-xs text-muted-foreground">
              → {new Date(row.current_period_end).toLocaleDateString()}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
