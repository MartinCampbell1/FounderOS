import { NextResponse } from "next/server";

import {
  getShellNamespaceForUpstream,
  type UpstreamId,
} from "@/lib/gateway-contract";

function buildDeprecatedRouteResponse({
  legacyPath,
  shellNamespace,
  message,
  detail,
}: {
  legacyPath: string;
  shellNamespace: string;
  message: string;
  detail: string;
}) {
  return NextResponse.json(
    {
      status: "deprecated",
      legacyPath,
      shellNamespace,
      message,
      detail,
    },
    { status: 410 }
  );
}

export function buildDeprecatedInternalProxyResponse(
  upstream: UpstreamId,
  pathSegments: string[]
) {
  const shellNamespace = getShellNamespaceForUpstream(upstream);
  const legacyPath = `/api/_${upstream}/${pathSegments.join("/")}`;

  const response = buildDeprecatedRouteResponse({
    legacyPath,
    shellNamespace,
    message: `Legacy ${upstream} proxy routes are no longer browser-facing shell contracts.`,
    detail: `Use ${shellNamespace} routes instead.`,
  });
  response.headers.set("x-founderos-upstream", upstream);
  return response;
}

export function buildDeprecatedShellRuntimeFragmentResponse(
  legacyPath: "/api/settings" | "/api/health"
) {
  return buildDeprecatedRouteResponse({
    legacyPath,
    shellNamespace: "/api/shell/runtime",
    message:
      "Legacy shell runtime fragment routes are no longer browser-facing shell contracts.",
    detail: "Use /api/shell/runtime instead.",
  });
}

export function buildDeprecatedShellRouteResponse(
  legacyPath: string,
  shellNamespace: string
) {
  return buildDeprecatedRouteResponse({
    legacyPath,
    shellNamespace,
    message: "Legacy shell routes are no longer browser-facing shell contracts.",
    detail: `Use ${shellNamespace} instead.`,
  });
}
