import { ActivityIndicator, View } from "react-native";

import { color } from "../theme/tokens";

/**
 * Shown while SecureStore is read at boot.
 *
 * On the Direction 1 surface rather than the older canvas: this is the first
 * frame of the signed-in app, and it is followed immediately by the header
 * painting the same colour. A different near-white here would show up as a
 * flash at exactly the moment the app is trying to look settled.
 */
export function Splash() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color.surface }}>
      <ActivityIndicator color={color.green} />
    </View>
  );
}
