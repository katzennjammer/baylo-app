import { MessageIcon } from "../../src/components/icons";
import { Placeholder } from "../../src/components/Placeholder";
import { color, icon } from "../../src/theme/tokens";

export default function MessagesScreen() {
  return (
    <Placeholder
      title="Messages"
      blurb="Conversations with the people you are trading with."
    >
      <MessageIcon size={icon.emptyLeaf.size} stroke={icon.emptyLeaf.stroke} color={color.forest} />
    </Placeholder>
  );
}
