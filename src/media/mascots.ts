import { Image as ExpoImage } from "expo-image";
import { Image as NativeImage } from "react-native";

export type MascotPose = "box" | "celebrate" | "worry" | "search" | "leaf";
export type MascotAssetKey = MascotPose | "celebrateTrimmed" | "wave";

export const MASCOT: Readonly<Record<MascotAssetKey, number>> = {
  box: require("../../assets/mascots/Duck_mascot_holding_cardboard.png"),
  celebrate: require("../../assets/mascots/Duck_celebrating_with_wings.png"),
  celebrateTrimmed: require("../../assets/mascots/Duck_celebrating_with_wings_trimmed.png"),
  worry: require("../../assets/mascots/Worried_duck_mascot_scratching_head.png"),
  search: require("../../assets/mascots/Duck_holding_magnifying_glass.png"),
  leaf: require("../../assets/mascots/Duck_holding_green_leaf.png"),
  wave: require("../../assets/mascots/Duck_mascot_waves_hello.mp4"),
};

export function preloadMascotImages(): Promise<void> {
  const poses: MascotPose[] = ["box", "celebrate", "worry", "search", "leaf"];
  const uris = poses.flatMap((pose) => {
    const uri = NativeImage.resolveAssetSource(MASCOT[pose])?.uri;
    return uri ? [uri] : [];
  });

  if (uris.length !== poses.length) {
    console.warn("[mascot] one or more bundled mascot images could not be resolved for preloading");
    return Promise.resolve();
  }

  return ExpoImage.prefetch(uris).then(
    (loaded) => {
      if (!loaded) console.warn("[mascot] one or more bundled mascot images failed to preload");
    },
    (error: unknown) => {
      console.warn("[mascot] bundled mascot image preloading failed:", error);
    },
  );
}
