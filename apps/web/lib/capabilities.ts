import {
  formatUpstreamErrorMessage,
  requestUpstreamJson,
} from "@/lib/upstream";

export interface CapabilityProvider {
  id: string;
  name?: string;
  status?: string;
  models?: string[];
  [key: string]: unknown;
}

export interface CapabilityConnector {
  id?: string;
  name: string;
  type?: string;
  status?: string;
  [key: string]: unknown;
}

export interface CapabilityTool {
  name: string;
  provider?: string;
  description?: string;
  [key: string]: unknown;
}

export interface CapabilityPlugin {
  name?: string;
  id?: string;
  status?: string;
  commands?: string[];
  [key: string]: unknown;
}

export interface CapabilityLaunchPreset {
  id: string;
  label?: string;
  description?: string;
  [key: string]: unknown;
}

export interface CapabilitiesCatalog {
  providers?: CapabilityProvider[];
  connectors?: CapabilityConnector[];
  tools?: CapabilityTool[];
  plugins?: CapabilityPlugin[];
  launch_presets?: CapabilityLaunchPreset[];
  [key: string]: unknown;
}

export interface ShellCapabilitiesSnapshot {
  generatedAt: string;
  catalog: CapabilitiesCatalog | null;
  catalogError: string | null;
  catalogLoadState: "ready" | "error";
  providers: CapabilityProvider[];
  providersError: string | null;
  providersLoadState: "ready" | "error";
  connectors: CapabilityConnector[];
  connectorsError: string | null;
  connectorsLoadState: "ready" | "error";
  tools: CapabilityTool[];
  toolsError: string | null;
  toolsLoadState: "ready" | "error";
  plugins: CapabilityPlugin[];
  pluginsError: string | null;
  pluginsLoadState: "ready" | "error";
  launchPresets: CapabilityLaunchPreset[];
  launchPresetsError: string | null;
  launchPresetsLoadState: "ready" | "error";
}

export function emptyCapabilitiesSnapshot(): ShellCapabilitiesSnapshot {
  return {
    generatedAt: "",
    catalog: null,
    catalogError: null,
    catalogLoadState: "ready",
    providers: [],
    providersError: null,
    providersLoadState: "ready",
    connectors: [],
    connectorsError: null,
    connectorsLoadState: "ready",
    tools: [],
    toolsError: null,
    toolsLoadState: "ready",
    plugins: [],
    pluginsError: null,
    pluginsLoadState: "ready",
    launchPresets: [],
    launchPresetsError: null,
    launchPresetsLoadState: "ready",
  };
}

export async function buildCapabilitiesSnapshot(): Promise<ShellCapabilitiesSnapshot> {
  const [
    catalogResult,
    providersResult,
    connectorsResult,
    toolsResult,
    pluginsResult,
    launchPresetsResult,
  ] = await Promise.allSettled([
    requestUpstreamJson<CapabilitiesCatalog>("autopilot", "capabilities/catalog"),
    requestUpstreamJson<{ providers: CapabilityProvider[] }>("autopilot", "capabilities/providers"),
    requestUpstreamJson<{ connectors: CapabilityConnector[] }>("autopilot", "capabilities/connectors"),
    requestUpstreamJson<{ tools: CapabilityTool[] }>("autopilot", "capabilities/tools"),
    requestUpstreamJson<{ plugins: CapabilityPlugin[] }>("autopilot", "capabilities/plugins"),
    requestUpstreamJson<{ launch_presets: CapabilityLaunchPreset[] }>("autopilot", "capabilities/launch-presets"),
  ]);

  const catalog =
    catalogResult.status === "fulfilled" ? catalogResult.value : null;

  return {
    generatedAt: new Date().toISOString(),
    catalog,
    catalogError:
      catalogResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage("Capabilities catalog", catalogResult.reason),
    catalogLoadState: catalogResult.status === "fulfilled" ? "ready" : "error",
    providers:
      providersResult.status === "fulfilled"
        ? providersResult.value.providers
        : catalog?.providers ?? [],
    providersError:
      providersResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage("Capabilities providers", providersResult.reason),
    providersLoadState: providersResult.status === "fulfilled" ? "ready" : "error",
    connectors:
      connectorsResult.status === "fulfilled"
        ? connectorsResult.value.connectors
        : catalog?.connectors ?? [],
    connectorsError:
      connectorsResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage("Capabilities connectors", connectorsResult.reason),
    connectorsLoadState: connectorsResult.status === "fulfilled" ? "ready" : "error",
    tools:
      toolsResult.status === "fulfilled"
        ? toolsResult.value.tools
        : catalog?.tools ?? [],
    toolsError:
      toolsResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage("Capabilities tools", toolsResult.reason),
    toolsLoadState: toolsResult.status === "fulfilled" ? "ready" : "error",
    plugins:
      pluginsResult.status === "fulfilled"
        ? pluginsResult.value.plugins
        : catalog?.plugins ?? [],
    pluginsError:
      pluginsResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage("Capabilities plugins", pluginsResult.reason),
    pluginsLoadState: pluginsResult.status === "fulfilled" ? "ready" : "error",
    launchPresets:
      launchPresetsResult.status === "fulfilled"
        ? launchPresetsResult.value.launch_presets
        : catalog?.launch_presets ?? [],
    launchPresetsError:
      launchPresetsResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage("Capabilities launch presets", launchPresetsResult.reason),
    launchPresetsLoadState: launchPresetsResult.status === "fulfilled" ? "ready" : "error",
  };
}
