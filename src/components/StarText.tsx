import type { ComponentProps } from "react";
import { Text } from "react-native";

/** The rating star's gold, the same one the profile's RatingLine draws. */
export const STAR_GOLD = "#E0A526";

/**
 * A line of text whose ★ characters are drawn gold, as on the profile header.
 * For the one-line summaries built as strings ("Rising trader · ★ 4.3"),
 * which drew the star in the line's grey (7 Nov 2026).
 */
export function StarText({ children, ...props }: Omit<ComponentProps<typeof Text>, "children"> & { children: string }) {
  const parts = children.split("★");
  return (
    <Text {...props}>
      {parts.map((part, i) => (
        <Text key={i}>
          {i > 0 ? <Text style={{ color: STAR_GOLD }}>★</Text> : null}
          {part}
        </Text>
      ))}
    </Text>
  );
}
