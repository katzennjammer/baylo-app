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

/**
 * `up` and `down` are the two pointing poses: one finger straight up, for a
 * target above the mascot, and one wing angled down and to its left (the
 * viewer's right), for a target below it. See `mascotLeft` for the aiming.
 */
export type MascotPose = "wave" | "up" | "down" | "cheer";

export interface TourStep {
  id: string;
  targets: TourTargetId[];
  /**
   * The hole's outline: `circle` for the Post button, `pill` where the target
   * is itself fully rounded (the search bar, the header's pill and button),
   * `rect` — a rounded box — for the rest.
   */
  shape: "rect" | "pill" | "circle";
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
    shape: "pill",
    pose: "up",
    title: "Find what you need",
    body: "Search here for an item or a trader, or scroll down to browse by category.",
  },
  {
    id: "post",
    targets: ["post"],
    shape: "circle",
    pose: "down",
    title: "Post something to trade",
    body: "Have something you no longer need? Tap the green button, add a few photos, and say what you’d like in return.",
  },
  {
    id: "trades",
    targets: ["trades"],
    shape: "rect",
    pose: "down",
    title: "Keep track of your trades",
    body: "Offers you send and receive show up here. A number on this tab means a trade is waiting for you.",
  },
  {
    id: "leaves",
    targets: ["leaves", "quests"],
    shape: "pill",
    pose: "up",
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
