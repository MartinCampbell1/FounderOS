"use client";

import { useEffect, useState } from "react";

import { Badge } from "@founderos/ui/components/badge";
import { cn } from "@founderos/ui/lib/utils";

import { SettingsSidebar } from "@/components/settings/settings-sidebar";
import {
  SettingsGroup,
  SettingsLayout,
  SettingsPageTitle,
  SettingsRow,
  SettingsSectionTitle,
  SettingsStatusIndicator,
} from "@/components/shell/shell-settings-primitives";

interface AccountEntry {
  name: string;
  provider: string;
  last_used?: string;
  [key: string]: unknown;
}

interface AccountHealth {
  account: string;
  provider: string;
  status: "healthy" | "cooldown" | "error" | string;
  [key: string]: unknown;
}

interface HealthMap {
  [accountName: string]: AccountHealth;
}

type SettingsSurfaceStatus = "online" | "degraded" | "offline";
type AccountStatus = "healthy" | "cooldown" | "error" | "unknown";

const PROVIDER_LABELS: Record<string, string> = {
  claude: "Claude",
  gemini: "Gemini",
  codex: "Codex",
};

const PROVIDER_ORDER = ["claude", "gemini", "codex"];

function prettyProviderLabel(provider: string) {
  return PROVIDER_LABELS[provider] ?? provider.replace(/[_-]+/g, " ");
}

function normalizeAccountStatus(status?: string): AccountStatus {
  if (status === "healthy" || status === "cooldown" || status === "error") {
    return status;
  }
  return "unknown";
}

function accountStatusTone(status: AccountStatus): SettingsSurfaceStatus {
  if (status === "healthy") return "online";
  if (status === "error") return "offline";
  return "degraded";
}

function accountStatusLabel(status: AccountStatus): string {
  if (status === "healthy") return "Healthy";
  if (status === "cooldown") return "Cooldown";
  if (status === "error") return "Error";
  return "Pending";
}

function providerStatusLabel(status: SettingsSurfaceStatus): string {
  if (status === "online") return "Healthy";
  if (status === "degraded") return "Partial";
  return "Blocked";
}

function summarizeAccounts(accounts: AccountEntry[], healthMap: HealthMap) {
  let healthy = 0;
  let cooldown = 0;
  let error = 0;
  let unknown = 0;

  for (const account of accounts) {
    const status = normalizeAccountStatus(healthMap[account.name]?.status);
    if (status === "healthy") healthy += 1;
    else if (status === "cooldown") cooldown += 1;
    else if (status === "error") error += 1;
    else unknown += 1;
  }

  const known = healthy + cooldown + error;
  const attention = cooldown + error;
  const overallStatus: SettingsSurfaceStatus =
    error > 0 ? "offline" : attention > 0 || unknown > 0 ? "degraded" : "online";

  return {
    healthy,
    cooldown,
    error,
    unknown,
    known,
    attention,
    overallStatus,
  };
}

function AccountStatTile({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: string;
  detail?: string;
  status?: {
    label: string;
    tone: SettingsSurfaceStatus;
  };
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/70 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            {label}
          </div>
          <div className="text-sm font-medium text-foreground">{value}</div>
        </div>
        {status ? (
          <SettingsStatusIndicator status={status.tone} label={status.label} />
        ) : null}
      </div>
      {detail ? (
        <div className="mt-3 text-[12px] leading-5 text-muted-foreground">
          {detail}
        </div>
      ) : null}
    </div>
  );
}

function LoadingTile() {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/70 p-4 shadow-sm">
      <div className="space-y-3 animate-pulse">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="h-2.5 w-20 rounded-full bg-muted/80" />
            <div className="h-4 w-14 rounded-full bg-muted/70" />
          </div>
          <div className="h-4 w-24 rounded-full bg-muted/70" />
        </div>
        <div className="h-3 w-40 rounded-full bg-muted/70" />
      </div>
    </div>
  );
}

function LoadingSection({ rows = 3 }: { rows?: number }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-2.5 w-24 rounded-full bg-muted/80 animate-pulse" />
          <div className="h-4 w-32 rounded-full bg-muted/70 animate-pulse" />
        </div>
        <div className="h-4 w-28 rounded-full bg-muted/70 animate-pulse" />
      </div>
      <SettingsGroup className="overflow-hidden">
        {Array.from({ length: rows }).map((_, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between gap-4 px-4 py-3"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-40 rounded-full bg-muted/80 animate-pulse" />
              <div className="h-2.5 w-56 rounded-full bg-muted/60 animate-pulse" />
            </div>
            <div className="h-4 w-20 rounded-full bg-muted/70 animate-pulse" />
          </div>
        ))}
      </SettingsGroup>
    </section>
  );
}

function ProviderSection({
  provider,
  accounts,
  healthMap,
}: {
  provider: string;
  accounts: AccountEntry[];
  healthMap: HealthMap;
}) {
  const summary = summarizeAccounts(accounts, healthMap);
  const providerTone = summary.overallStatus;

  return (
    <section id={`provider-${provider}`} className="scroll-mt-6 space-y-2">
      <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {provider}
            </div>
            <div className="mt-1 text-sm font-medium tracking-[-0.01em] text-foreground">
              {prettyProviderLabel(provider)}
            </div>
            <div className="mt-1 text-[12px] leading-5 text-muted-foreground">
              {accounts.length} account{accounts.length === 1 ? "" : "s"} ·{" "}
              {summary.healthy} healthy · {summary.attention} needing attention
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <SettingsStatusIndicator
              status={providerTone}
              label={providerStatusLabel(providerTone)}
            />
            <Badge tone="neutral">{accounts.length} accounts</Badge>
            <Badge tone="success">{summary.healthy} healthy</Badge>
            <Badge tone={summary.attention > 0 ? "warning" : "neutral"}>
              {summary.attention} attention
            </Badge>
          </div>
        </div>
      </div>

      <SettingsGroup>
        {accounts.map((account, idx) => {
          const health = healthMap[account.name];
          const status = normalizeAccountStatus(health?.status);
          const tone = accountStatusTone(status);
          const lastUsed = account.last_used ? `Last used ${account.last_used}` : "No recent use recorded";

          return (
            <SettingsRow
              key={account.name}
              title={account.name}
              description={lastUsed}
              control={
                <SettingsStatusIndicator
                  status={tone}
                  label={accountStatusLabel(status)}
                />
              }
              className={cn(idx === accounts.length - 1 && "rounded-b-[12px]")}
            />
          );
        })}
      </SettingsGroup>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-border/60 bg-muted/20 px-5 py-6 shadow-sm lg:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="h-2.5 w-40 rounded-full bg-muted/80 animate-pulse" />
            <div className="h-7 w-32 rounded-full bg-muted/70 animate-pulse" />
            <div className="h-4 w-[min(100%,32rem)] rounded-full bg-muted/60 animate-pulse" />
            <div className="h-3 w-64 rounded-full bg-muted/50 animate-pulse" />
          </div>
          <div className="h-5 w-24 rounded-full bg-muted/70 animate-pulse" />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <LoadingTile />
        <LoadingTile />
        <LoadingTile />
        <LoadingTile />
      </div>

      <div className="space-y-8">
        <LoadingSection rows={3} />
        <LoadingSection rows={2} />
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-3xl border border-border/60 bg-background/70 px-5 py-6 shadow-sm lg:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            Settings / Accounts
          </div>
          <SettingsPageTitle>Accounts unavailable</SettingsPageTitle>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            The account list could not be loaded from the autopilot API. Provider
            health is best-effort, so any stale status below should be treated as
            informational only.
          </p>
          <div className="text-[12px] text-red-500">{message}</div>
        </div>
        <SettingsStatusIndicator status="offline" label="Blocked" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-[12px] leading-5 text-muted-foreground">
          Primary source: <span className="font-mono text-foreground">/api/_autopilot/accounts</span>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-[12px] leading-5 text-muted-foreground">
          Health source:{" "}
          <span className="font-mono text-foreground">/api/_autopilot/accounts/health</span>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-border/60 bg-background/70 px-5 py-6 shadow-sm lg:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            Settings / Accounts
          </div>
          <SettingsPageTitle>No accounts configured</SettingsPageTitle>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Provider accounts will appear here once the autopilot account list is
            populated. Groups are rendered by provider so health and cooldown
            states stay easy to scan.
          </p>
        </div>
        <SettingsStatusIndicator status="degraded" label="Empty" />
      </div>

      <div className="mt-4 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-[12px] leading-5 text-muted-foreground">
        Waiting for provider entries from{" "}
        <span className="font-mono text-foreground">/api/_autopilot/accounts</span>.
      </div>
    </div>
  );
}

export default function SettingsAccountsPage() {
  const [accounts, setAccounts] = useState<AccountEntry[]>([]);
  const [healthMap, setHealthMap] = useState<HealthMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accountsPromise = fetch("/api/_autopilot/accounts")
      .then((r) => r.json())
      .then((data: AccountEntry[] | { accounts?: AccountEntry[] }) => {
        const list = Array.isArray(data) ? data : (data.accounts ?? []);
        setAccounts(list);
      })
      .catch(() => {
        setError("Failed to load accounts");
      });

    const healthPromise = fetch("/api/_autopilot/accounts/health")
      .then((r) => r.json())
      .then((data: AccountHealth[] | { accounts?: AccountHealth[] }) => {
        const list = Array.isArray(data) ? data : (data.accounts ?? []);
        const map: HealthMap = {};
        for (const entry of list) {
          map[entry.account] = entry;
        }
        setHealthMap(map);
      })
      .catch(() => {
        // health is best-effort; don't block the page
      });

    Promise.all([accountsPromise, healthPromise]).finally(() => {
      setLoading(false);
    });
  }, []);

  const grouped = accounts.reduce<Record<string, AccountEntry[]>>((acc, account) => {
    const provider = account.provider ?? "unknown";
    if (!acc[provider]) acc[provider] = [];
    acc[provider].push(account);
    return acc;
  }, {});

  const orderedProviders = [
    ...PROVIDER_ORDER.filter((p) => grouped[p]),
    ...Object.keys(grouped).filter((p) => !PROVIDER_ORDER.includes(p)),
  ];

  const totals = summarizeAccounts(accounts, healthMap);
  const coverageLabel = `${totals.known}/${accounts.length || 0}`;
  const coverageTone: SettingsSurfaceStatus =
    accounts.length > 0 && totals.known === accounts.length ? "online" : "degraded";
  const attentionTone: SettingsSurfaceStatus =
    totals.error > 0 ? "offline" : totals.attention > 0 || totals.unknown > 0 ? "degraded" : "online";
  const overallLabel =
    totals.error > 0
      ? "Blocked"
      : totals.attention > 0 || totals.unknown > 0
        ? "Partial"
        : "Healthy";

  return (
    <SettingsLayout sidebar={<SettingsSidebar activeView="accounts" />}>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : orderedProviders.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">
          <div
            id="overview"
            className="rounded-3xl border border-border/60 bg-muted/20 px-5 py-6 shadow-sm lg:px-6"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Settings / Accounts
                </div>
                <SettingsPageTitle>Accounts</SettingsPageTitle>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  Track provider accounts, expose cooldown and error states, and keep
                  last-used signals grouped by provider so the satellite reads like
                  the rest of the settings cluster.
                </p>
                <div className="text-[12px] text-muted-foreground">
                  Sources:{" "}
                  <span className="font-mono text-foreground">
                    /api/_autopilot/accounts
                  </span>{" "}
                  and{" "}
                  <span className="font-mono text-foreground">
                    /api/_autopilot/accounts/health
                  </span>
                </div>
              </div>
              <SettingsStatusIndicator
                status={overallLabel === "Healthy" ? "online" : overallLabel === "Partial" ? "degraded" : "offline"}
                label={overallLabel}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <AccountStatTile
              label="Accounts"
              value={String(accounts.length)}
              detail="All provider entries returned by the account API."
            />
            <AccountStatTile
              label="Providers"
              value={String(orderedProviders.length)}
              detail="Grouped by provider so each rail stays readable."
            />
            <AccountStatTile
              label="Health coverage"
              value={coverageLabel}
              detail="Accounts with a live health snapshot."
              status={{
                tone: coverageTone,
                label: coverageTone === "online" ? "Complete" : "Partial",
              }}
            />
            <AccountStatTile
              label="Attention"
              value={String(totals.attention)}
              detail="Cooldown and error entries that need review."
              status={{
                tone: attentionTone,
                label:
                  attentionTone === "online"
                    ? "Clear"
                    : totals.error > 0
                      ? "Needs review"
                      : "Partial",
              }}
            />
          </div>

          <div className="space-y-8" id="health">
            <SettingsSectionTitle>Provider groups</SettingsSectionTitle>
            {orderedProviders.map((provider) => (
              <ProviderSection
                key={provider}
                provider={provider}
                accounts={grouped[provider] ?? []}
                healthMap={healthMap}
              />
            ))}
          </div>
        </div>
      )}
    </SettingsLayout>
  );
}
