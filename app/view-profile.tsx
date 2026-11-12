/**
 * A person's or shop's profile, on the ROOT stack.
 *
 * `/user` is a hidden TAB inside (app). A screen that itself sits on the root
 * stack above (app) -- the chat (messages/thread), the trade screen -- cannot
 * push a tab: expo-router resolves the push against the root stack and
 * re-pushes the whole (app) group, so the chat vanished and the person landed
 * back among the tabs instead of on the profile. This route is the same screen
 * pushed on top of the caller, so Back returns to the conversation.
 *
 * Screens inside (app) keep using `/user`.
 */
export { default } from "./(app)/user";
