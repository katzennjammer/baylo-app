import { PlusIcon } from "../../src/components/icons";
import { Placeholder } from "../../src/components/Placeholder";
import { color, icon } from "../../src/theme/tokens";

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
