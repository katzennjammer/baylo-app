import Constants from "expo-constants";

type NotificationsModule = typeof import("expo-notifications");

const isExpoGo = Constants.executionEnvironment === "storeClient";
let nativeNotifications: NotificationsModule | null = null;

if (!isExpoGo) {
  try {
    nativeNotifications = require("expo-notifications") as NotificationsModule;
  } catch {
    nativeNotifications = null;
  }
}

const noopNotifications = {
  AndroidImportance: { MAX: 5 as NotificationsModule["AndroidImportance"]["MAX"] },
  setNotificationHandler: () => undefined,
  setNotificationChannelAsync: async () => null,
  deleteNotificationChannelAsync: async () => undefined,
  getPermissionsAsync: async () => ({ status: "undetermined" }),
  requestPermissionsAsync: async () => ({ status: "undetermined" }),
  getExpoPushTokenAsync: async () => ({ data: "" }),
  useLastNotificationResponse: () => null,
  addNotificationReceivedListener: () => ({ remove: () => undefined }),
  getPresentedNotificationsAsync: async () => [],
  dismissNotificationAsync: async () => undefined,
} as unknown as NotificationsModule;

export const notificationsAvailable = nativeNotifications !== null;
export const Notifications = nativeNotifications ?? noopNotifications;
