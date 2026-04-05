function serializePayload(payload: unknown) {
  return JSON.stringify(payload).replace(/</g, "\\u003c");
}

export function ShellRouteDiagnosticsScript({
  payload,
  route,
}: {
  payload: unknown;
  route: string;
}) {
  return (
    <script
      type="application/json"
      data-founderos-route-diagnostics={route}
      dangerouslySetInnerHTML={{
        __html: serializePayload(payload),
      }}
    />
  );
}
