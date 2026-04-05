"use client";

import { ShellRecordActionBar, ShellRecordSection } from "@/components/shell/shell-record-primitives";
import { ShellPillButton, ShellSectionCard } from "@/components/shell/shell-screen-primitives";

type ReviewMemorySectionProps = {
  sectionTitle?: string;
  memoryTargetLabel: string;
  rememberedLabel: string;
  currentLabel?: string;
  rememberLabel: string;
  activeRememberLabel?: string;
  remembered: boolean;
  busy: boolean;
  resetDisabled: boolean;
  onRemember: () => void;
  onReset: () => void;
  note?: string;
};

export function ReviewMemorySection({
  sectionTitle,
  memoryTargetLabel,
  rememberedLabel,
  currentLabel,
  rememberLabel,
  activeRememberLabel = "Current filter remembered",
  remembered,
  busy,
  resetDisabled,
  onRemember,
  onReset,
  note,
}: ReviewMemorySectionProps) {
  return (
    <>
      <ShellRecordSection title={sectionTitle}>
        <div>
          Memory target:{" "}
          <span className="font-semibold text-foreground">{memoryTargetLabel}</span>
        </div>
        <div>
          Saved default:{" "}
          <span className="font-semibold text-foreground">{rememberedLabel}</span>
        </div>
        {currentLabel ? (
          <div>
            Current filter maps to{" "}
            <span className="font-semibold text-foreground">{currentLabel}</span>
          </div>
        ) : null}
      </ShellRecordSection>
      <ShellRecordActionBar>
        <ShellPillButton
          type="button"
          tone="outline"
          active={remembered}
          onClick={onRemember}
          disabled={busy}
        >
          {remembered ? activeRememberLabel : rememberLabel}
        </ShellPillButton>
        <ShellPillButton
          type="button"
          tone="ghost"
          onClick={onReset}
          disabled={busy || resetDisabled}
        >
          Reset target default
        </ShellPillButton>
      </ShellRecordActionBar>
      {note ? <div className="text-sm leading-7 text-muted-foreground">{note}</div> : null}
    </>
  );
}

type ReviewMemoryCardProps = ReviewMemorySectionProps & {
  cardTitle: string;
  cardDescription: string;
};

export function ReviewMemoryCard({
  cardTitle,
  cardDescription,
  ...sectionProps
}: ReviewMemoryCardProps) {
  return (
    <ShellSectionCard
      title={cardTitle}
      description={cardDescription}
      contentClassName="space-y-3"
    >
        <ReviewMemorySection {...sectionProps} />
    </ShellSectionCard>
  );
}
