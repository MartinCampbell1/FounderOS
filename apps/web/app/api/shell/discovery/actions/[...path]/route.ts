import { proxyToUpstream } from "@/lib/gateway";
import { enforceShellAdminRequest } from "@/lib/shell-security";

export const dynamic = "force-dynamic";

async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const denial = enforceShellAdminRequest(request);
  if (denial) {
    return denial;
  }

  const { path } = await context.params;
  return proxyToUpstream("quorum", request, path);
}

export { handle as POST, handle as PUT };
