import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { color, radius, size, textStyle, type } from "../theme/tokens";
import { Tappable } from "./Tappable";

export function NoticeDialog({
  visible,
  title,
  body,
  icon,
  onDismiss,
}: {
  visible: boolean;
  title: string;
  body: string;
  icon: React.ReactNode;
  onDismiss: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable
        style={s.scrim}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <Pressable onPress={() => {}} style={s.card} accessible={false}>
          <View style={s.badge}>{icon}</View>

          <Text style={[textStyle(type.errorHeadline), s.title]} accessibilityRole="header">
            {title}
          </Text>
          <Text style={[textStyle(type.emptyBody), s.body]}>{body}</Text>

          <Tappable
            onPress={onDismiss}
            accessibilityRole="button"
            style={s.ok}
            pressedStyle={s.okPressed}
          >
            <Text style={[textStyle(type.primaryButton), { color: color.onGreen }]}>OK</Text>
          </Tappable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: color.captionFill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: color.surface,
    borderRadius: radius.sheet,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: "center",
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: color.greenWash,
    borderWidth: 1,
    borderColor: color.greenLine,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: { color: color.ink, textAlign: "center" },
  body: { color: color.inkSecondary, textAlign: "center", marginTop: 8 },
  ok: {
    alignSelf: "stretch",
    height: size.control.primaryButton,
    borderRadius: radius.primaryButton,
    backgroundColor: color.green,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  okPressed: { opacity: 0.85 },
});
