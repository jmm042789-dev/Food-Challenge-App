const isHttpsUrl = (value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

module.exports = ({ config }) => {
  if (
    process.env.EAS_BUILD_PROFILE === "production" &&
    !isHttpsUrl(process.env.EXPO_PUBLIC_BACKEND_URL || "")
  ) {
    throw new Error(
      "Production builds require EXPO_PUBLIC_BACKEND_URL to be set to a valid HTTPS URL.",
    );
  }

  return config;
};
