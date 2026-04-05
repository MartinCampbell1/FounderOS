import { proxyToUpstream } from "@/lib/gateway";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  return proxyToUpstream("quorum", request, [
    "orchestrate",
    "session",
    sessionId,
    "events",
  ]);
}
