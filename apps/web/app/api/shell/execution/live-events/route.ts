import { proxyToUpstream } from "@/lib/gateway";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return proxyToUpstream("autopilot", request, ["events"]);
}
