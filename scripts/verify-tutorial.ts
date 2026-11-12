/**
 * Offline checks for the first-time tour: its step list (src/tutorial/steps.ts)
 * and the geometry that places the hole, mascot and card (src/tutorial/layout.ts).
 * Pure functions, no device:
 *
 *   npx tsx scripts/verify-tutorial.ts
 */
import { holeFor, isUsable, mascotLeft, placementFor, scrimPath, unionRect } from "../src/tutorial/layout";
import { TOUR_STEPS } from "../src/tutorial/steps";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name}`, detail === undefined ? "" : JSON.stringify(detail));
  }
}

const phone = { width: 390, height: 844 };
const small = { width: 320, height: 568 };

console.log("steps");
{
  check("opens and closes on a centred card", TOUR_STEPS[0].targets.length === 0 && TOUR_STEPS[TOUR_STEPS.length - 1].targets.length === 0);
  check("every step in between points at something", TOUR_STEPS.slice(1, -1).every((s) => s.targets.length > 0));
  check("ids are unique", new Set(TOUR_STEPS.map((s) => s.id)).size === TOUR_STEPS.length);
  check("every step has words", TOUR_STEPS.every((s) => s.title.trim() !== "" && s.body.trim() !== ""));
  check("only the Post step is a circle", TOUR_STEPS.filter((s) => s.shape === "circle").map((s) => s.id).join() === "post");
  check("targets above use the up pose, targets in the tab bar the down pose", TOUR_STEPS.filter((s) => s.pose === "up").map((s) => s.id).join() === "browse,leaves" && TOUR_STEPS.filter((s) => s.pose === "down").map((s) => s.id).join() === "post,trades");
}

console.log("usable targets");
{
  check("an on-screen rect", isUsable({ x: 16, y: 108, width: 358, height: 44 }, phone));
  check("zeros (a tab that is not showing)", !isUsable({ x: 0, y: 0, width: 0, height: 0 }, phone));
  check("scrolled above the window", !isUsable({ x: 16, y: -300, width: 358, height: 44 }, phone));
  check("below the window", !isUsable({ x: 16, y: 900, width: 358, height: 44 }, phone));
  check("NaN from a detached view", !isUsable({ x: NaN, y: 0, width: 10, height: 10 }, phone));
}

console.log("holes");
{
  const u = unionRect([
    { x: 172, y: 51, width: 70, height: 30 },
    { x: 250, y: 44, width: 44, height: 44 },
  ]);
  check("union spans both targets", !!u && u.x === 172 && u.y === 44 && u.width === 122 && u.height === 44, u);
  check("union of nothing is nothing", unionRect([]) === null);

  const full = holeFor({ x: 0, y: 100, width: 390, height: 44 }, "rect", phone);
  check("a full-width target stays inside the window", full.x >= 4 && full.x + full.width <= 386, full);

  const fab = holeFor({ x: 162, y: 734, width: 66, height: 66 }, "circle", phone);
  check("the Post hole is a circle on the button's centre", fab.width === fab.height && fab.radius === fab.width / 2 && fab.x + fab.width / 2 === 195, fab);

  const path = scrimPath(phone, fab);
  check("scrim path has an outer box and a hole", path.startsWith("M0 0H390V844H0Z") && path.split("Z").length === 3, path);
  check("no hole, no second subpath", scrimPath(phone, null) === "M0 0H390V844H0Z");
}

console.log("placement");
{
  const top = holeFor({ x: 16, y: 108, width: 358, height: 44 }, "rect", phone);
  const p1 = placementFor(top, phone);
  check("a target in the top half puts the card below it", p1.mode === "below" && p1.top > top.y + top.height, p1);

  const bottom = holeFor({ x: 234, y: 766, width: 78, height: 56 }, "rect", phone);
  const p2 = placementFor(bottom, phone);
  check("a target in the bottom half puts the card above it", p2.mode === "above" && phone.height - p2.bottom < bottom.y, p2);
  check("no target centres the card", placementFor(null, phone).mode === "center");

  const mascot = { width: 118, height: 150 };

  // `down` points diagonally: the wing's line must run through the target.
  const fab = holeFor({ x: 162, y: 734, width: 66, height: 66 }, "circle", phone);
  const feet = fab.y - 12;
  const left = mascotLeft("down", fab, mascot, feet, phone);
  const tipX = left + 0.4 * mascot.width;
  const tipY = feet - 0.32 * mascot.height;
  const dx = fab.x + fab.width / 2 - tipX;
  const dy = fab.y + fab.height / 2 - tipY;
  check("the down pose sits up and to the left of the Post button", left + mascot.width < fab.x + fab.width / 2 && feet < fab.y, { left, feet });
  check("its wing's 45 degree line passes through the button's centre", Math.abs(dx - dy) < 1, { dx, dy });

  // `up` puts the fingertip under a narrow target's centre...
  const pill = holeFor({ x: 149, y: 36, width: 123, height: 44 }, "pill", phone);
  const upLeft = mascotLeft("up", pill, { width: 124, height: 150 }, 0, phone);
  check("the up pose's fingertip is under the Leaves and Quests hole", Math.abs(upLeft + 0.18 * 124 - (pill.x + pill.width / 2)) < 1, upLeft);
  check("a pill hole is fully rounded", pill.radius === pill.height / 2, pill);
  // ...and stands at the right under one that spans the screen.
  const bar = holeFor({ x: 0, y: 97, width: 390, height: 51 }, "pill", phone);
  const barLeft = mascotLeft("up", bar, { width: 124, height: 150 }, 0, phone);
  check("under the search bar the mascot stands on the right", barLeft > phone.width / 2, barLeft);

  for (const [name, win] of [["390 wide", phone], ["320 wide", small]] as const) {
    for (const pose of ["up", "down"] as const) {
      for (const hole of [top, bottom, holeFor({ x: 127, y: 480, width: 66, height: 66 }, "circle", win)]) {
        const l = mascotLeft(pose, hole, mascot, hole.y - 12, win);
        check(`mascot stays on screen (${name}, ${pose}, hole at x=${Math.round(hole.x)})`, l >= 8 && l + mascot.width <= win.width - 8, l);
      }
    }
  }
}

if (failures > 0) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall tutorial checks passed");
