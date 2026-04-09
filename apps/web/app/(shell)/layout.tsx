import { cookies } from "next/headers";
import { Suspense, type ReactNode } from "react";

import {
  buildShellPreferencesBootstrapScript,
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";
import {
  UnifiedShellFrame,
  UnifiedShellFrameFallback,
} from "@/components/unified-shell-frame";
import { buildShellRuntimeSnapshot } from "@/lib/runtime";

export default async function ShellLayout({
  children,
}: {
  children: ReactNode;
}) {
  const cookieStore = await cookies();
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value,
  );
  const initialRuntimeSnapshot =
    await buildShellRuntimeSnapshot(operatorControls);

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: buildShellPreferencesBootstrapScript(
            operatorControls.preferences,
          ),
        }}
      />
      <Suspense
        fallback={
          <UnifiedShellFrameFallback
            initialRuntimeSnapshot={initialRuntimeSnapshot}
            initialPreferences={operatorControls.preferences}
          >
            {children}
          </UnifiedShellFrameFallback>
        }
      >
        <UnifiedShellFrame
          initialRuntimeSnapshot={initialRuntimeSnapshot}
          initialPreferences={operatorControls.preferences}
        >
          {children}
        </UnifiedShellFrame>
      </Suspense>
    </>
  );
}
