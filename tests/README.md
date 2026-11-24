# Unit tests

```bash
npm test
```

Runs every `tests/unit/*.test.ts` with Node's built-in test runner (no new test framework) and writes the
unit-testing table to `tests/report/unit-test-report.md` and `.csv`.

To put your name in the **Proponent** column:

```bash
TESTER="Surname, Given N." npm test
```

## Adding a case

```ts
const c = suite("Authentication");
c("Register", "User inputs missing email", "Account will not be successfully registered", () => {
  // assertions
});
```

The four labels become the Module / Unit / Description / Expected columns. Case IDs, date, Actual Result and
PASSED/FAILED are generated. A new module name must also be added to `MODULE_ORDER` in `support/reporter.mjs`
to control table order.

## What these tests do and do not prove

- Pure logic (validation, brackets, offer rules, formatting, scheduling) is tested directly.
- Login/Register API calls run the real client against a scripted `fetch`, so they prove how the app reads each
  server answer, not that the server sends it. Server-side rules belong in the `baylo-api` repo's tests.
- Screens (React Native components) are not rendered here.
