/**
 * Offline checks for the post wizard's AI-valuation state (src/post/state.tsx).
 *
 *   node --require ./scripts/rn-stub.cjs --require ./scripts/securestore-fake.cjs \
 *     --import tsx scripts/verify-ai-valuation-state.ts
 *
 * Exits 1 if any check fails.
 */
import type { AiValuationResult, ValuationPayload } from "../src/api/post";
import {
  activeValuation,
  aiKeyOf,
  canAdvance,
  effectiveValue,
  initialState,
  reduce,
  valuationTicket,
  type PostState,
} from "../src/post/state";

let failures = 0
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) console.log(`  ok   ${name}`)
  else {
    failures++
    console.log(`  FAIL ${name}`, detail ?? "")
  }
}

const standard: ValuationPayload = {
  suggestedLeaves: 2050,
  min: 100,
  max: 4000,
  allowed: { min: 1538, max: 2563 },
  valuationSource: "category_band",
  sampleSize: 0,
  category: "ELECTRONICS",
  categoryLabel: "Electronics",
  condition: "GOOD",
  conditionLabel: "Good",
  comparables: [],
  basis: "Category band",
}

const aiResult: AiValuationResult = {
  status: "ai",
  valuation: {
    suggestedLeaves: 3000,
    min: 100,
    max: 4000,
    allowed: { min: 2250, max: 3750 },
    valuationSource: "ai_market",
  },
  explanation: "Listings ask about ₱20,000, high for electronics.",
  sources: [
    { title: "A", url: "https://a.example/1" },
    { title: "B", url: "https://b.example/2" },
  ],
  checkedAt: "2026-11-04T00:00:00.000Z",
  ticket: "signed.ticket",
  expiresAt: "2026-11-04T02:00:00.000Z",
}

function atValueStep(): PostState {
  let s = initialState()
  s = reduce(s, { type: "field/category", value: "ELECTRONICS" })
  s = reduce(s, { type: "field/title", value: "iPhone 13 128GB" })
  s = reduce(s, { type: "goto", step: 3 })
  s = reduce(s, { type: "valuation/done", payload: standard })
  return s
}

console.log("loading")
{
  let s = atValueStep()
  check("before the AI is asked, Next is held", !canAdvance(s))
  s = reduce(s, { type: "ai/pending", key: aiKeyOf(s) })
  check("while the AI is looking, Next is held", !canAdvance(s))
  check("no ticket while loading", valuationTicket(s) === undefined)
}

console.log("AI answer")
{
  let s = atValueStep()
  const key = aiKeyOf(s)
  s = reduce(s, { type: "ai/pending", key })
  s = reduce(s, { type: "ai/done", key, result: aiResult })
  check("the AI number is the value", effectiveValue(s) === 3000, effectiveValue(s))
  check("source reads ai_market", activeValuation(s)?.valuationSource === "ai_market")
  check("slider band is the AI band", activeValuation(s)?.allowed.min === 2250)
  check("ticket is sent", valuationTicket(s) === "signed.ticket")
  check("Next allowed", canAdvance(s))

  s = reduce(s, { type: "value/set", leaves: 99999 })
  check("slider is clamped to the AI band", effectiveValue(s) === 3750, effectiveValue(s))

  const recased = reduce(s, { type: "field/title", value: "iphone  13 128gb" })
  check("case/spacing-only title edit keeps the AI estimate", valuationTicket(recased) === "signed.ticket")

  const retitled = reduce(s, { type: "field/title", value: "Phone case" })
  check("a real title change drops the AI estimate", retitled.aiValuation === null)
  check("...and its ticket", valuationTicket(retitled) === undefined)
  check("...and the value follows the standard estimate again", effectiveValue(retitled) === 2050, effectiveValue(retitled))

  const recond = reduce(s, { type: "field/condition", value: "POOR" })
  check("a condition change drops it too", recond.aiValuation === null && valuationTicket(recond) === undefined)
}

console.log("late and failed answers")
{
  let s = atValueStep()
  const oldKey = aiKeyOf(s)
  s = reduce(s, { type: "ai/pending", key: oldKey })
  s = reduce(s, { type: "field/title", value: "Something else entirely" })
  s = reduce(s, { type: "ai/done", key: oldKey, result: aiResult })
  check("an answer for an old title is ignored", s.aiValuation === null && effectiveValue(s) === 2050, s.aiValuation)

  let f = atValueStep()
  const key = aiKeyOf(f)
  f = reduce(f, { type: "ai/pending", key })
  f = reduce(f, {
    type: "ai/done",
    key,
    result: { status: "fallback", reason: "INSUFFICIENT_SOURCES", message: "Not enough listings." },
  })
  check("fallback keeps the standard number", effectiveValue(f) === 2050)
  check("fallback source is not AI", activeValuation(f)?.valuationSource === "category_band")
  check("fallback sends no ticket", valuationTicket(f) === undefined)
  check("fallback can advance", canAdvance(f))

  let e = atValueStep()
  e = reduce(e, { type: "ai/pending", key: aiKeyOf(e) })
  e = reduce(e, { type: "ai/failed", key: aiKeyOf(e), message: "AI valuation is unavailable right now." })
  check("a thrown request behaves as a fallback", e.aiValuation?.status === "fallback" && valuationTicket(e) === undefined)
}

console.log("own value and refused tickets")
{
  let s = atValueStep()
  s = reduce(s, { type: "value/own" })
  s = reduce(s, { type: "value/typed", leaves: 500 })
  const key = aiKeyOf(s)
  s = reduce(s, { type: "ai/pending", key })
  s = reduce(s, { type: "ai/done", key, result: aiResult })
  check("a typed value survives the AI answer", effectiveValue(s) === 500)
  check("a typed value still carries the ticket (judged against the AI suggestion)", valuationTicket(s) === "signed.ticket")

  let r = atValueStep()
  const k = aiKeyOf(r)
  r = reduce(r, { type: "ai/pending", key: k })
  r = reduce(r, { type: "ai/done", key: k, result: aiResult })
  r = reduce(r, { type: "ai/reset", notice: "expired" })
  check("a refused ticket clears the AI estimate and shows why", r.aiValuation === null && r.aiNotice === "expired")
  check("...and the value is no longer the AI one", effectiveValue(r) === 2050)
}

console.log("drafts")
{
  const old = { ...atValueStep() } as Partial<PostState>
  delete old.aiValuation
  delete old.aiNotice
  const restored = reduce(initialState(), { type: "restore", state: old as PostState })
  check("a draft from before AI valuation restores as 'not asked yet'", restored.aiValuation === null && restored.aiNotice === null)
}

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) FAILED`)
process.exit(failures === 0 ? 0 : 1)
