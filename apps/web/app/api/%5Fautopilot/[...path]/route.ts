import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  if (
    request.method.toUpperCase() === "GET" &&
    path.length === 1 &&
    path[0] === "projects"
  ) {
    return NextResponse.redirect(
      new URL("/api/shell/execution/workspace", request.url),
      { status: 308 },
    );
  }

  const target = new URL(
    `/api/shell/execution/actions/${path.map(encodeURIComponent).join("/")}`,
    request.url,
  );
  return NextResponse.redirect(target, { status: 308 });
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
