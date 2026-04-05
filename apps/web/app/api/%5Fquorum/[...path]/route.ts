import { buildDeprecatedInternalProxyResponse } from "@/lib/deprecated-internal-routes";

export const dynamic = "force-dynamic";

async function handle(
  _request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return buildDeprecatedInternalProxyResponse("quorum", path);
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
  handle as OPTIONS,
  handle as HEAD,
};
