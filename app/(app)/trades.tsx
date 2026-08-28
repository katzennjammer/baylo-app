import { SwapIcon } from "../../src/components/icons";
import { Placeholder } from "../../src/components/Placeholder";
import { color, icon } from "../../src/theme/tokens";

export default function TradesScreen() {
  return (
    <Placeholder
      title="Trades"
      blurb="Offers you have made and received, and the contracts that came out of them."
    >
      <SwapIcon size={icon.emptyLeaf.size} stroke={icon.emptyLeaf.stroke} color={color.forest} />
    </Placeholder>
  );
}
