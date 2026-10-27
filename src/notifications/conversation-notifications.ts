import * as Notifications from "expo-notifications";

import { pushMessagePartnerId } from "./push-target";

export async function dismissNotificationsForPartner(partnerId: string): Promise<void> {
  const presented = await Notifications.getPresentedNotificationsAsync();
  const matches = presented.filter((notification) =>
    pushMessagePartnerId(notification.request.content.data) === partnerId,
  );
  await Promise.all(matches.map((notification) =>
    Notifications.dismissNotificationAsync(notification.request.identifier),
  ));
}
