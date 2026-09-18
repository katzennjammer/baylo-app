import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { color, radius, textStyle, type } from "../src/theme/tokens";

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Go back" style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={color.ink} />
        </Pressable>
        <Text style={[textStyle(type.sectionHeading), styles.title]}>Settings</Text>
      </View>

      <View style={styles.card}>
        <Text style={[textStyle(type.itemTitle), styles.cardTitle]}>Account</Text>
        <Text style={[textStyle(type.detailBody), styles.emptyText]}>More account settings are coming soon.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface },
  content: { padding: 20, gap: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { color: color.ink },
  card: {
    backgroundColor: color.inset,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.divider,
    padding: 18,
    gap: 10,
  },
  cardTitle: { color: color.ink },
  emptyText: { color: color.inkSecondary },
});
