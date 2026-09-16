# Backlog

Things decided but not scheduled. Each entry says what, why, and where the
change lands, so it can be picked up cold. Remove an entry when it ships.

## Photo uploads have no timeout

**Added 16 Sep 2026.** `API_REQUEST_TIMEOUT_MS` (30 s) in
[`src/api/client.ts`](src/api/client.ts) applies only to the `fetch` branch of
`request()`. Every multipart body — the post wizard's photos and the ID
submission — goes through `sendMultipart()` over `XMLHttpRequest`, which never
sets `xhr.timeout`. A stalled upload therefore spins for as long as the OS
keeps the socket open, which on Android is minutes.

The fix is NOT to reuse the 30 s: a photo over a mobile hotspot can legitimately
take longer, and aborting a healthy slow upload is worse than the current gap.
Uploads need their own, longer limit — and ideally an *idle* limit rather than a
total one, reset from `xhr.upload.onprogress`, so a 90-second upload that is
still moving is never cut off while one that has sent nothing for 30 seconds
is. Keep the `ontimeout` handler's error as a network error, the way it is
today, so the encode-failure banner (`REQUEST_ENCODE_ERROR`) is not shown for a
timeout.
