import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { HowTradingWorksSheet } from "../src/components/offer/OfferSheet";
import { resetReachExplainerSeen } from "../src/lib/reach-flag";
import { color, radius, textStyle, type } from "../src/theme/tokens";

export default function SettingsScreen() {
  const router = useRouter();
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Go back" style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={color.ink} />
        </Pressable>
        <Text style={[textStyle(type.sectionHeading), styles.title]}>Settings</Text>
      </View>

      <View style={styles.card}>
        <Text style={[textStyle(type.itemTitle), styles.cardTitle]}>Trading</Text>
        <SettingsRow
          label="How trading works"
          sub="Brackets, bridging fees and your tier's ceiling"
          onPress={() => setExplainerOpen(true)}
        />
      </View>

      <View style={styles.card}>
        <Text style={[textStyle(type.itemTitle), styles.cardTitle]}>Account</Text>
        <Text style={[textStyle(type.detailBody), styles.emptyText]}>More account settings are coming soon.</Text>
      </View>

      {/* Dev builds only. `__DEV__` is a compile-time constant, so the release
          minifier drops this block and the reset never ships. */}
      {__DEV__ ? (
        <View style={styles.card}>
          <Text style={[textStyle(type.itemTitle), styles.cardTitle]}>Developer</Text>
          <SettingsRow
            label="Reset “How trading works” seen flag"
            sub={
              resetDone
                ? "Reset. It will open again on the next marketplace visit with a faded tile."
                : "Shows the first-run sheet again on the marketplace"
            }
            onPress={() => {
              resetReachExplainerSeen();
              setResetDone(true);
            }}
          />
        </View>
      ) : null}

      {/* Reopened from here, `Got it` only closes it: the seen flag is the
          marketplace's to write, and it is already set by the time anyone
          finds this row. */}
      {explainerOpen ? <HowTradingWorksSheet onGotIt={() => setExplainerOpen(false)} /> : null}
    </ScrollView>
  );
}

function SettingsRow({ label, sub, onPress }: { label: string; sub: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowText}>
        <Text style={[textStyle(type.detailSection), styles.rowLabel]}>{label}</Text>
        <Text style={[textStyle(type.sectionSubcopy), styles.rowSub]}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={color.inkMuted} />
    </Pressable>
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    marginHorizontal: -6,
    paddingHorizontal: 6,
    borderRadius: radius.chip,
  },
  rowPressed: { backgroundColor: color.control },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { color: color.ink },
  rowSub: { color: color.inkSecondary },
});
