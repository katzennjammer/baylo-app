/**
 * The first-time tour: what it says, in order, and what each step points at.
 *
 * Pure data, no React Native imports, so the copy and the order can be checked
 * off the device (scripts/verify-tutorial.ts).
 *
 * A step with no `targets` is a centred card over a full scrim — the welcome
 * and the sign-off. A step with targets cuts a hole around them; more than one
 * target is spotlit as a single hole around all of them.
 */

/** A piece of real UI a step can point at. Registered where it is drawn. */
export type TourTargetId = "search" | "post" | "trades" | "leaves" | "quests";

export type MascotPose = "wave" | "point" | "cheer";

export interface TourStep {
  id: string;
  targets: TourTargetId[];
  /** `circle` for the Post button, which is one; everything else is a rounded box. */
  shape: "rect" | "circle";
  pose: MascotPose;
  title: string;
  body: string;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: "welcome",
    targets: [],
    shape: "rect",
    pose: "wave",
    title: "Welcome to Baylo!",
    body: "Baylo is where you trade things you have for things you need. Want a quick look around?",
  },
  {
    id: "browse",
    targets: ["search"],
    shape: "rect",
    pose: "point",
    title: "Find what you need",
    body: "Search here for an item, or scroll down to browse by category and see what people near you are offering.",
  },
  {
    id: "post",
    targets: ["post"],
    shape: "circle",
    pose: "point",
    title: "Post something to trade",
    body: "Have something you no longer need? Tap the green button, add a few photos, and say what you’d like in return.",
  },
  {
    id: "trades",
    targets: ["trades"],
    shape: "rect",
    pose: "point",
    title: "Keep track of your trades",
    body: "Offers you send and receive show up here. A number on this tab means a trade is waiting for you.",
  },
  {
    id: "leaves",
    targets: ["leaves", "quests"],
    shape: "rect",
    pose: "point",
    title: "Earn Leaves with daily quests",
    body: "This is your Leaves balance. Tap the target beside it to see today’s quests and earn more.",
  },
  {
    id: "done",
    targets: [],
    shape: "rect",
    pose: "cheer",
    title: "You’re all set!",
    body: "Post something you no longer need, or see what others are offering.",
  },
];
