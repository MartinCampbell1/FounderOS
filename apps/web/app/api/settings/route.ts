import { buildDeprecatedShellRuntimeFragmentResponse } from "@/lib/deprecated-internal-routes";

export const dynamic = "force-dynamic";

export async function GET() {
  return buildDeprecatedShellRuntimeFragmentResponse("/api/settings");
}
