import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiFetch } from "./api";

export type PushRegistrationResult =
  | { ok: true; token: string }
  | { ok: false; reason: "web" | "permission" | "projectId" | "registration"; message?: string };

export async function registerForPushNotifications(): Promise<PushRegistrationResult> {
  if (Platform.OS === "web") {
    return { ok: false, reason: "web" };
  }

  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.granted ? existing : await Notifications.requestPermissionsAsync();

  if (!permission.granted) {
    return { ok: false, reason: "permission" };
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Sunpatch offers",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId = getEasProjectId();

  if (!projectId) {
    return {
      ok: false,
      reason: "projectId",
      message: "Expo push registration needs EXPO_PUBLIC_EAS_PROJECT_ID or extra.eas.projectId in mobile/app.json.",
    };
  }

  let token: string;

  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch (error) {
    return {
      ok: false,
      reason: "registration",
      message: error instanceof Error ? error.message : "Unable to get an Expo push token.",
    };
  }

  try {
    await registerPushToken(token);
  } catch (error) {
    return {
      ok: false,
      reason: "registration",
      message: error instanceof Error ? error.message : "Unable to save the Expo push token.",
    };
  }

  return { ok: true, token };
}

export async function registerPushToken(token: string) {
  await apiFetch<{ ok: boolean }>("/api/notifications/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      platform: Platform.OS,
      deviceName: Constants.deviceName ?? undefined,
    }),
  });
}

function getEasProjectId() {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string }; projectId?: string }
    | undefined;

  return (
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() ||
    Constants.easConfig?.projectId ||
    extra?.eas?.projectId ||
    extra?.projectId ||
    ""
  );
}
