import { chatImageFrame, validChatImageDimensions } from "../src/components/messages/chat-image-sizing";

let failures = 0;
let checks = 0;

function eq(label: string, got: unknown, want: unknown) {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures++;
    console.log(`FAIL ${label}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`);
  }
}

const frame = (width: unknown, height: unknown, maxWidth = 240) => {
  const dimensions = validChatImageDimensions(width, height);
  const result = chatImageFrame(dimensions, maxWidth);
  return {
    width: Math.round(result.width),
    height: Math.round(result.height),
    contentFit: result.contentFit,
  };
};

eq("portrait", frame(3, 4), { width: 240, height: 320, contentFit: "contain" });
eq("landscape", frame(4, 3), { width: 240, height: 180, contentFit: "contain" });
eq("square", frame(1, 1), { width: 240, height: 240, contentFit: "contain" });
eq("very tall clamps ratio and crops", frame(1, 5), { width: 107, height: 320, contentFit: "cover" });
eq("very wide clamps ratio and crops", frame(5, 1), { width: 240, height: 80, contentFit: "cover" });
eq("missing dimensions use neutral 4:3 placeholder", frame(undefined, undefined), { width: 240, height: 180, contentFit: "contain" });
eq("screen width limit is respected", frame(3, 4, 210), { width: 210, height: 280, contentFit: "contain" });
const narrow = chatImageFrame({ width: 1, height: 2 }, 160);
eq("frame respects available width", { width: Math.round(narrow.width), height: Math.round(narrow.height) }, { width: 160, height: 320 });

console.log(failures === 0 ? `verify-chat-image-sizing: all ${checks} checks passed` : `verify-chat-image-sizing: ${failures} of ${checks} FAILED`);
if (failures > 0) process.exitCode = 1;
