export const PRODUCTION_API_BASE = "https://firefeast-backend.onrender.com";

export type ApiBaseResolutionOptions = {
  explicitUrl?: string;
  expoHostUris?: readonly unknown[];
  isDevelopment: boolean;
};

function normalizeExplicitUrl(value: string, isDevelopment: boolean): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("EXPO_PUBLIC_BACKEND_URL must be a valid absolute HTTP(S) URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("EXPO_PUBLIC_BACKEND_URL must use HTTP or HTTPS.");
  }
  if (!isDevelopment && url.protocol !== "https:") {
    throw new Error("Fire Feast production API URLs must use HTTPS.");
  }
  return value.replace(/\/+$/, "");
}

function isValidHostname(hostname: string): boolean {
  if (hostname === "localhost") return true;
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    return hostname.split(".").every((part) => Number(part) <= 255);
  }
  return hostname
    .split(".")
    .every((label) => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label));
}

export function metroHostname(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const candidate = value.trim();
  try {
    const parsed = new URL(candidate.includes("://") ? candidate : `http://${candidate}`);
    if (!parsed.hostname || !isValidHostname(parsed.hostname)) return null;
    return parsed.hostname;
  } catch {
    return null;
  }
}

export function resolveApiBase({
  explicitUrl,
  expoHostUris = [],
  isDevelopment,
}: ApiBaseResolutionOptions): string {
  const configured = explicitUrl?.trim();
  if (configured) return normalizeExplicitUrl(configured, isDevelopment);
  if (!isDevelopment) return PRODUCTION_API_BASE;

  for (const candidate of expoHostUris) {
    const hostname = metroHostname(candidate);
    if (hostname) return `http://${hostname}:8000`;
  }

  throw new Error(
    "Fire Feast could not derive the Metro host for the development API. " +
      "Set EXPO_PUBLIC_BACKEND_URL to an explicit backend URL and restart Metro.",
  );
}

export function joinApiPath(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
