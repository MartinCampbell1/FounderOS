import { buildDeprecatedShellRouteResponse } from "@/lib/deprecated-internal-routes";
import { SHELL_OPERATOR_PREFERENCES_ROUTE } from "@/lib/shell-browser-contract";

export const dynamic = "force-dynamic";

export async function GET() {
  return buildDeprecatedShellRouteResponse(
    "/api/operator-preferences",
    SHELL_OPERATOR_PREFERENCES_ROUTE
  );
}

export async function PUT() {
  return buildDeprecatedShellRouteResponse(
    "/api/operator-preferences",
    SHELL_OPERATOR_PREFERENCES_ROUTE
  );
}
