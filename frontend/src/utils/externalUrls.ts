import { Linking } from "react-native";

export function validExternalUrl(value?: string): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "https:") return parsed.toString();
    const localDevelopmentUrl = __DEV__
      && parsed.protocol === "http:"
      && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
    return localDevelopmentUrl ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export async function openExternalUrl(value?: string): Promise<boolean> {
  const url = validExternalUrl(value);
  if (!url) return false;
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
