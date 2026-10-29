const isHttpsUrl = (value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

// No staging endpoint is approved. An explicit non-production HTTPS URL is required.
const stagingBackend = (value) => {
  let url;
  try { url = new URL(value); } catch { throw new Error("Staging requires an explicit valid HTTPS backend URL."); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("Staging requires an explicit HTTPS backend URL without credentials, query or fragment.");
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (["fire-feast-api.onrender.com", "firefeast-backend.onrender.com"].includes(host)) throw new Error("Staging must not use the production backend.");
};

module.exports = ({ config }) => {
  const staging = process.env.EAS_BUILD_PROFILE === "staging" || process.env.EXPO_PUBLIC_APP_ENV === "staging";
  if (staging) stagingBackend(process.env.EXPO_PUBLIC_BACKEND_URL || "");
  if (
    process.env.EAS_BUILD_PROFILE === "production" &&
    !isHttpsUrl(process.env.EXPO_PUBLIC_BACKEND_URL || "")
  ) {
    throw new Error(
      "Production builds require EXPO_PUBLIC_BACKEND_URL to be set to a valid HTTPS URL.",
    );
  }

  return {
    ...config,
    ...(staging ? {
      name: "Fire Feast Staging",
      scheme: "firefeast-staging",
      android: { ...config.android, package: "com.firefeast.app.staging" },
      // No OTA updates until an independently approved staging update setup exists.
      updates: { ...config.updates, enabled: false, checkAutomatically: "NEVER" },
    } : {}),
    extra: {
      ...config.extra,
      ...(staging ? { releaseEnvironment: "staging" } : {}),
      build: {
        authImplementation: "guest-auth-state-v6",
        easBuildId: process.env.EAS_BUILD_ID || "local",
        gitCommit: process.env.EAS_BUILD_GIT_COMMIT_HASH || "local",
      },
    },
  };
};
