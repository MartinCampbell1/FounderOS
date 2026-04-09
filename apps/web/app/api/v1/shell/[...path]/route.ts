import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const target = new URL(
    `/api/shell/${path.map(encodeURIComponent).join("/")}`,
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
