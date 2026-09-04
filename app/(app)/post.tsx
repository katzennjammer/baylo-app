import { PlusIcon } from "../../src/components/icons";
import { Placeholder } from "../../src/components/Placeholder";
import { color, icon } from "../../src/theme/tokens";

/**
 * The Post TAB — which is deliberately never the screen anybody sees.
 *
 * The listing wizard lives at `/post-item`, a stack route pushed OVER the tabs,
 * because it owns the whole screen: its own 44 header and 90 footer on all
 * seven steps, and no room for the app header above or this bar below. `TabBar`
 * intercepts the centre FAB and pushes that route instead of switching tabs.
 *
 * This file stays because the route has to exist for the bar to keep its five
 * slots and its raised circle. If it is ever reached — a deep link to /post, a
 * navigation added later — this is what it shows, and it is honest about what
 * the tab is for.
 */
export default function PostScreen() {
  return (
    <Placeholder
      title="Post"
      blurb="List something you no longer need. The valuation model suggests a Leaf value; you decide the final one."
    >
      <PlusIcon size={icon.emptyLeaf.size} stroke={icon.emptyLeaf.stroke} color={color.forest} />
    </Placeholder>
  );
}
