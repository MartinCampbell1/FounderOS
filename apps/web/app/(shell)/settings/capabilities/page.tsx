import { ShellPage, ShellHero } from "@/components/shell/shell-screen-primitives";

export default function SettingsCapabilitiesPage() {
  return (
    <ShellPage>
      <ShellHero title="Capabilities" />
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="text-[14px] font-medium text-foreground">Coming soon</div>
          <div className="mt-1 text-[13px] text-muted-foreground">
            This section is under development.
          </div>
        </div>
      </div>
    </ShellPage>
  );
}
