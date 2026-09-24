import { QuestIcon } from "../../src/components/icons";
import { Placeholder } from "../../src/components/Placeholder";
import { color, icon } from "../../src/theme/tokens";

/**
 * The Quests screen — A STUB. There is no quest feature to wire up yet.
 * Reached from the Quests icon in AppHeader, which only Home, Community and
 * Marketplace show (`showQuests`).
 *
 * WHAT ACTUALLY EXISTS TODAY, so the next person does not go looking twice:
 *
 *   Server    `TaskCompletion` and the `TaskKind` enum are real, and completing
 *             a task really does award Leaves. But the awards are EVENT-DRIVEN,
 *             written as a side effect of the thing you did, and there is no
 *             endpoint that lists tasks or reports progress on them. /api/v1
 *             has no tasks or quests route at all.
 *   Client    Nothing but this screen. The account menu's old "Quests are on
 *             the way" dialog is gone; the header icon is the one entrance.
 *
 * So this screen is honest rather than invented: it uses `Placeholder`, which
 * prints NOT BUILT YET, instead of an empty list that would be indistinguishable
 * from a working screen whose query returned nothing. Nothing here calls an
 * endpoint, and no quest, progress bar or reward figure is made up.
 *
 * WHAT WIRING IT UP WOULD TAKE, when the feature exists: a GET that lists the
 * TaskKinds with this viewer's completions joined in, and this file renders it.
 * The route, the header icon and the glyph are already in place by then.
 */
export default function QuestsScreen() {
  return (
    <Placeholder
      title="Quests"
      blurb="Little challenges you complete for Leaves. They are not here yet — this screen is in place so the shape of the app is right."
    >
      <QuestIcon size={icon.emptyLeaf.size} stroke={icon.emptyLeaf.stroke} color={color.forest} />
    </Placeholder>
  );
}
