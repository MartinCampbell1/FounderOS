import { NextResponse } from "next/server";
import type { QuorumDiscoveryInboxFeed } from "@founderos/api-clients";

import { buildUpstreamQuery, requestUpstreamJson } from "@/lib/upstream";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawLimit = url.searchParams.get("limit");
  const status = url.searchParams.get("status");
  const limit =
    rawLimit && Number.isFinite(Number(rawLimit))
      ? Math.max(1, Math.min(Math.trunc(Number(rawLimit)), 500))
      : 50;

  try {
    const feed = await requestUpstreamJson<QuorumDiscoveryInboxFeed>(
      "quorum",
      "orchestrate/discovery/inbox",
      buildUpstreamQuery({
        limit,
        status: status === "open" || status === "resolved" ? status : null,
      })
    );
    return NextResponse.json(feed);
  } catch (error) {
    return NextResponse.json(
      {
        detail:
          error instanceof Error
            ? error.message
            : "Discovery inbox request failed.",
      },
      { status: 502 }
    );
  }
}
