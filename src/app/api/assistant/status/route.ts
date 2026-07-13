import { NextResponse } from "next/server";
import { isAssistantConfigured } from "@/lib/assistant/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { AssistantStatus } from "@/lib/assistant/protocol";

/**
 * Assistant availability for the editor panel. The client never reads env
 * vars — this is the single source of the "is it configured?" boolean.
 */
export function GET(): NextResponse {
  const status: AssistantStatus = {
    configured: isAssistantConfigured(),
    mode: isSupabaseConfigured() ? "cloud" : "local",
  };
  return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
}
