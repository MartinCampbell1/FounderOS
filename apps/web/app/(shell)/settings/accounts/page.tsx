"use client";

import { useEffect, useState } from "react";

import { Badge } from "@founderos/ui/components/badge";
import { cn } from "@founderos/ui/lib/utils";

import { ShellPage, ShellHero } from "@/components/shell/shell-screen-primitives";

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

const PROVIDER_LABELS: Record<string, string> = {
  claude: "Claude",
  gemini: "Gemini",
  codex: "Codex",
};

const PROVIDER_ORDER = ["claude", "gemini", "codex"];

function statusDotClass(status: string): string {
  if (status === "healthy") return "bg-green-500";
  if (status === "cooldown") return "bg-amber-500";
  return "bg-red-500";
}

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn("inline-block size-[7px] shrink-0 rounded-full", statusDotClass(status))}
      aria-hidden="true"
    />
  );
}

function statusTone(status: string): "success" | "warning" | "danger" {
  if (status === "healthy") return "success";
  if (status === "cooldown") return "warning";
  return "danger";
}

function statusLabel(status: string): string {
  if (status === "healthy") return "Healthy";
  if (status === "cooldown") return "Cooldown";
  return "Error";
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
  const label = PROVIDER_LABELS[provider] ?? provider;
  return (
    <div className="space-y-1">
      <div className="text-[13px] font-medium text-foreground">{label}</div>
      <div className="rounded-md border border-border">
        {accounts.map((account, idx) => {
          const health = healthMap[account.name];
          const status = health?.status ?? "unknown";
          return (
            <div
              key={account.name}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5",
                idx < accounts.length - 1 && "border-b border-border"
              )}
            >
              <StatusDot status={status} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                {account.name}
              </span>
              <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>
              {account.last_used ? (
                <span className="shrink-0 text-[12px] text-muted-foreground">
                  Last used: {account.last_used}
                </span>
              ) : null}
            </div>
          );
        })}
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
    setLoading(true);

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

  return (
    <ShellPage>
      <ShellHero title="Accounts" />

      {loading && (
        <div className="text-[13px] text-muted-foreground">Loading accounts...</div>
      )}

      {!loading && error && (
        <div className="text-[13px] text-red-500">{error}</div>
      )}

      {!loading && !error && orderedProviders.length === 0 && (
        <div className="flex min-h-[200px] items-center justify-center">
          <div className="text-[13px] text-muted-foreground">No accounts configured.</div>
        </div>
      )}

      {!loading && orderedProviders.length > 0 && (
        <div className="space-y-6">
          {orderedProviders.map((provider) => (
            <ProviderSection
              key={provider}
              provider={provider}
              accounts={grouped[provider] ?? []}
              healthMap={healthMap}
            />
          ))}
        </div>
      )}
    </ShellPage>
  );
}
