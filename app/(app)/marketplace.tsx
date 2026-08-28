import { GridIcon } from "../../src/components/icons";
import { Placeholder } from "../../src/components/Placeholder";
import { color, icon } from "../../src/theme/tokens";

/**
 * The second tab. A placeholder in this task, and a real screen against
 * /api/v1/browse next — that route already takes q, category, condition,
 * lat/lng, radiusKm and sort=nearest, which is the whole of what this needs.
 *
 * Home's three escapes point here already: the empty state's secondary action
 * and every trending chip. The destination therefore exists from the day the
 * tab does, rather than being wired up afterwards.
 */
export default function MarketplaceScreen() {
  return (
    <Placeholder
      title="Marketplace"
      blurb="Search and filter every listing, by category, condition and distance."
    >
      <GridIcon size={icon.emptyLeaf.size} stroke={icon.emptyLeaf.stroke} color={color.forest} />
    </Placeholder>
  );
}
