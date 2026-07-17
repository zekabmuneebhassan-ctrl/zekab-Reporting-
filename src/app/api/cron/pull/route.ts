import { NextResponse, type NextRequest } from "next/server";
import { pullAdMob } from "@/lib/integrations/admob";
import { pullPlayConsole } from "@/lib/integrations/playConsole";
import { pullGoogleAds } from "@/lib/integrations/googleAds";
import type { PullResult } from "@/lib/integrations/types";

export const dynamic = "force-dynamic";

/**
 * Scheduled data pull. Protected by CRON_SECRET.
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; a manual call can use
 * ?secret=… as well.
 *
 *   GET /api/cron/pull?source=admob|play|google_ads|all
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const provided =
    auth?.replace("Bearer ", "") ?? req.nextUrl.searchParams.get("secret");

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const source = req.nextUrl.searchParams.get("source") ?? "all";
  const results: PullResult[] = [];

  try {
    if (source === "admob" || source === "all") results.push(await pullAdMob());
    if (source === "play" || source === "all") results.push(await pullPlayConsole());
    if (source === "google_ads" || source === "all") results.push(await pullGoogleAds());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "pull failed", results },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, results });
}
