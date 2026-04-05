import type {
  DiscoveryAttentionRecord,
  ShellAttentionRecord,
  ShellExecutionAttentionRecord,
} from "@/lib/attention-records";
import type { ShellChainRecord } from "@/lib/chain-graph";
import type { ShellDiscoveryReviewRecord } from "@/lib/discovery-review";
import type { ShellExecutionSourceContext } from "@/lib/execution-source";
import {
  normalizeShellSettingsParityTargets,
  type ShellSettingsParityTargets,
} from "@/lib/route-scope";

export function mergeShellSettingsParityTargets(
  ...targets: Array<Partial<ShellSettingsParityTargets> | null | undefined>
): ShellSettingsParityTargets {
  const merged: ShellSettingsParityTargets = {
    discoverySessionId: "",
    discoveryIdeaId: "",
  };

  for (const target of targets) {
    const normalized = normalizeShellSettingsParityTargets(target);
    if (!merged.discoverySessionId && normalized.discoverySessionId) {
      merged.discoverySessionId = normalized.discoverySessionId;
    }
    if (!merged.discoveryIdeaId && normalized.discoveryIdeaId) {
      merged.discoveryIdeaId = normalized.discoveryIdeaId;
    }
  }

  return merged;
}

export function shellSettingsParityTargetsFromChainRecord(
  record?: ShellChainRecord | null
): ShellSettingsParityTargets {
  if (!record || record.kind !== "linked") {
    return {
      discoverySessionId: "",
      discoveryIdeaId: "",
    };
  }

  return {
    discoverySessionId: "",
    discoveryIdeaId: record.idea.idea_id,
  };
}

export function shellSettingsParityTargetsFromExecutionSourceContext(
  source?: Pick<ShellExecutionSourceContext, "discoveryIdeaId"> | null
): ShellSettingsParityTargets {
  return {
    discoverySessionId: "",
    discoveryIdeaId: (source?.discoveryIdeaId || "").trim(),
  };
}

export function shellSettingsParityTargetsFromExecutionAttentionRecord(
  record?: ShellExecutionAttentionRecord | null
): ShellSettingsParityTargets {
  return shellSettingsParityTargetsFromExecutionSourceContext(record?.source);
}

export function shellSettingsParityTargetsFromDiscoveryReviewRecord(
  record?: ShellDiscoveryReviewRecord | null
): ShellSettingsParityTargets {
  return {
    discoverySessionId: record?.trace?.linkedSessionIds[0] || "",
    discoveryIdeaId: record?.dossier.idea.idea_id || "",
  };
}

export function shellSettingsParityTargetsFromDiscoveryAttentionRecord(
  record?: DiscoveryAttentionRecord | null
): ShellSettingsParityTargets {
  return {
    discoverySessionId: "",
    discoveryIdeaId:
      (record?.item.idea_id || "").trim() || record?.chain?.ideaId || "",
  };
}

export function shellSettingsParityTargetsFromAttentionRecord(
  record?: ShellAttentionRecord | null
): ShellSettingsParityTargets {
  if (!record) {
    return {
      discoverySessionId: "",
      discoveryIdeaId: "",
    };
  }

  if (record.type === "discovery") {
    return shellSettingsParityTargetsFromDiscoveryAttentionRecord(record);
  }

  return shellSettingsParityTargetsFromExecutionAttentionRecord(record);
}
