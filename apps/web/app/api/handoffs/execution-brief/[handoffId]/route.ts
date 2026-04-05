import { buildDeprecatedShellRouteResponse } from "@/lib/deprecated-internal-routes";
import { buildShellExecutionBriefHandoffRoute } from "@/lib/shell-browser-contract";

export async function GET(
  _request: Request,
  context: { params: Promise<{ handoffId: string }> }
) {
  const { handoffId } = await context.params;
  return buildDeprecatedShellRouteResponse(
    `/api/handoffs/execution-brief/${encodeURIComponent(handoffId)}`,
    buildShellExecutionBriefHandoffRoute(handoffId)
  );
}
