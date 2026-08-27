import { ActivityIndicator, View } from "react-native";

import { colors } from "../theme/palette";

/** Shown while SecureStore is read at boot. Deliberately not a spinner-on-white. */
export function Splash() {
  return (
    <View className="flex-1 items-center justify-center bg-bg">
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}
