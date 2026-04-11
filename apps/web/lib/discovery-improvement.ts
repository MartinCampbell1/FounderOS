import type {
  QuorumPromptEvolutionProfile,
  QuorumPromptSelfPlayMatch,
  QuorumReflectiveEvalReport,
} from "@founderos/api-clients";

import type { ShellDiscoveryImprovementSnapshot } from "@/lib/discovery-improvement-model";
import {
  buildUpstreamQuery,
  formatUpstreamErrorMessage,
  requestUpstreamJson,
} from "@/lib/upstream";

function isActiveProfile(profile: QuorumPromptEvolutionProfile) {
  return Boolean(profile.metadata?.active);
}

function sortProfiles(items: QuorumPromptEvolutionProfile[]) {
  return [...items].sort((left, right) => {
    if (isActiveProfile(left) !== isActiveProfile(right)) {
      return isActiveProfile(left) ? -1 : 1;
    }
    const leftTime = Date.parse(left.last_updated || "") || 0;
    const rightTime = Date.parse(right.last_updated || "") || 0;
    return rightTime - leftTime;
  });
}

function sortReflections(items: QuorumReflectiveEvalReport[]) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.created_at || "") || 0;
    const rightTime = Date.parse(right.created_at || "") || 0;
    return rightTime - leftTime;
  });
}

function sortMatches(items: QuorumPromptSelfPlayMatch[]) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.created_at || "") || 0;
    const rightTime = Date.parse(right.created_at || "") || 0;
    return rightTime - leftTime;
  });
}

export async function buildDiscoveryImprovementSnapshot(
  profileId: string | null,
  options?: {
    limit?: number | null;
  }
): Promise<ShellDiscoveryImprovementSnapshot> {
  const limit =
    typeof options?.limit === "number"
      ? Math.max(1, Math.min(Math.trunc(options.limit), 48))
      : 16;
  const [profilesResult, reflectionsResult, matchesResult] =
    await Promise.allSettled([
      requestUpstreamJson<{ items: QuorumPromptEvolutionProfile[] }>(
        "quorum",
        "orchestrate/improvement/prompt-profiles",
        buildUpstreamQuery({ limit })
      ),
      requestUpstreamJson<{ items: QuorumReflectiveEvalReport[] }>(
        "quorum",
        "orchestrate/improvement/reflections",
        buildUpstreamQuery({ limit })
      ),
      requestUpstreamJson<{ items: QuorumPromptSelfPlayMatch[] }>(
        "quorum",
        "orchestrate/improvement/self-play/matches",
        buildUpstreamQuery({ limit })
      ),
    ]);

  const profiles =
    profilesResult.status === "fulfilled"
      ? sortProfiles(profilesResult.value.items)
      : [];
  const requestedProfileId = (profileId || "").trim();
  const selectedProfileId = requestedProfileId || profiles[0]?.profile_id || null;
  const selectedProfileResult =
    selectedProfileId
      ? await Promise.allSettled([
          requestUpstreamJson<QuorumPromptEvolutionProfile>(
            "quorum",
            `orchestrate/improvement/prompt-profiles/${encodeURIComponent(selectedProfileId)}`
          ),
        ]).then((results) => results[0])
      : null;

  return {
    generatedAt: new Date().toISOString(),
    profiles,
    profilesError:
      profilesResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage(
            "Improvement prompt profiles",
            profilesResult.reason
          ),
    profilesLoadState: profilesResult.status === "fulfilled" ? "ready" : "error",
    reflections:
      reflectionsResult.status === "fulfilled"
        ? sortReflections(reflectionsResult.value.items)
        : [],
    reflectionsError:
      reflectionsResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage(
            "Improvement reflections",
            reflectionsResult.reason
          ),
    reflectionsLoadState:
      reflectionsResult.status === "fulfilled" ? "ready" : "error",
    matches:
      matchesResult.status === "fulfilled" ? sortMatches(matchesResult.value.items) : [],
    matchesError:
      matchesResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage(
            "Improvement self-play matches",
            matchesResult.reason
          ),
    matchesLoadState: matchesResult.status === "fulfilled" ? "ready" : "error",
    selectedProfileId,
    selectedProfile:
      selectedProfileResult && selectedProfileResult.status === "fulfilled"
        ? selectedProfileResult.value
        : null,
    selectedProfileError:
      !selectedProfileId
        ? null
        : selectedProfileResult && selectedProfileResult.status === "rejected"
          ? formatUpstreamErrorMessage(
              "Improvement prompt profile",
              selectedProfileResult.reason
            )
          : null,
    selectedProfileLoadState:
      !selectedProfileId
        ? "idle"
        : selectedProfileResult && selectedProfileResult.status === "fulfilled"
          ? "ready"
          : "error",
  };
}
