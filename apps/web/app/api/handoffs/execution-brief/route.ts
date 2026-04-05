import { buildDeprecatedShellRouteResponse } from "@/lib/deprecated-internal-routes";
import { SHELL_EXECUTION_BRIEF_HANDOFF_ROUTE } from "@/lib/shell-browser-contract";

export async function POST() {
  return buildDeprecatedShellRouteResponse(
    "/api/handoffs/execution-brief",
    SHELL_EXECUTION_BRIEF_HANDOFF_ROUTE
  );
}
