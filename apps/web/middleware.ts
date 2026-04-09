import type { NextRequest } from "next/server";

import { buildShellSecurityResponse } from "@/lib/shell-security";

export function middleware(request: NextRequest) {
  return buildShellSecurityResponse(request);
}

export const config = {
  matcher: ["/api/shell/:path*"],
};
