import { View } from "react-native";

import { border, color } from "../theme/tokens";

/**
 * The 1 px rule that does the work elevation would do in another direction.
 *
 * Direction 1 separates cards with a hairline and gives them the same fill as
 * the canvas behind them, so this is not a decorative border — it is the ONLY
 * thing that says where one card ends and the next begins. It gets its own
 * component so that the value cannot drift between the header, the card gaps,
 * the interstitials and the tab bar, all of which are specified as the same
 * rule in the same colour.
 *
 * `hairlineWidth` is deliberately NOT used. It resolves to 1/dpr — a third of a
 * pixel on a 3× phone — which is thinner than the spec's 1, and on a divider
 * this low-contrast the difference is between a visible boundary and none.
 */
export function Divider() {
  return <View style={{ height: border.hairline, backgroundColor: color.divider }} />;
}
