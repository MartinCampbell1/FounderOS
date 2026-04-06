import { Inbox } from "lucide-react";

import {
  ShellEmptyState,
  ShellPage,
} from "@/components/shell/shell-screen-primitives";
import { NAV_ITEMS, type SectionKey } from "@/lib/navigation";

export function SectionPage({ sectionKey }: { sectionKey: SectionKey }) {
  const navItem = NAV_ITEMS.find((item) => item.key === sectionKey);
  const label = navItem?.label ?? sectionKey;
  const Icon = navItem?.icon ?? Inbox;

  return (
    <ShellPage className="max-w-7xl gap-6 py-6">
      <ShellEmptyState
        centered
        className="py-20"
        icon={<Icon className="h-5 w-5" />}
        title={label}
        description={`This section is being set up. Connect your services to see ${label.toLowerCase()} data here.`}
      />
    </ShellPage>
  );
}
