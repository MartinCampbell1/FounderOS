import {
  ShellHero,
  ShellPage,
} from "@/components/shell/shell-screen-primitives";

import { NAV_ITEMS, type SectionKey } from "@/lib/navigation";

export function SectionPage({ sectionKey }: { sectionKey: SectionKey }) {
  const navItem = NAV_ITEMS.find((item) => item.key === sectionKey);
  const label = navItem?.label ?? sectionKey;

  return (
    <ShellPage className="max-w-7xl gap-6 py-6">
      <ShellHero title={label} />
    </ShellPage>
  );
}
