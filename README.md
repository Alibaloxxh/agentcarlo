# Agent (AgentCarlo)

An AI agent system that handles personal-brand and lead generation — running autonomously.
---

## What it does

**1. Content Agent**
Drafts posts and threads about ecosystem news, project updates, and dev-building insights — matched to a specific voice (direct, technical, no hype). Every draft is flagged for human review before anything goes live.

**2. Lead-Gen Agent**
Continuously discovers and evaluates potential clients — companies and founders who need development work. Each lead is scored on legitimacy, budget signal, and fit, and classified by what kind of opportunity it actually is (a job vs. a contract), before any outreach is considered.

**3. Outreach Agent**
For leads that clear a confidence and quality bar, drafts a personalized opening message. Anything uncertain is held back for a human to look at — nothing borderline goes out on autopilot.

---

## How the agents work together

```
Discover  →  Filter  →  Evaluate  →  Gate  →  Act
```

- **Discover** — multiple agents continuously scan different sources for signals: job postings, freelance listings, and open web search for founders actively looking for a developer.
- **Filter** — duplicate and irrelevant signals are dropped before they ever reach an evaluation step, so effort isn't wasted re-scoring the same thing twice.
- **Evaluate** — an AI agent reads each candidate and produces a structured judgment: is this legitimate, does it have real budget, does it fit the skillset being marketed, and what type of opportunity is it.
- **Gate** — nothing moves forward automatically unless it clears both a quality score and a confidence threshold. Anything uncertain is held for manual review instead of guessed at.
- **Act** — qualifying leads get a drafted outreach message; qualifying content ideas get drafted posts. A human approves before anything is sent or posted.

Everything the agents produce lands in one place for review — nothing is ever posted or sent without a human decision in the loop, by design.

---

## Automation status

✅ **Fully autonomous, running continuously:**
- Source scanning and lead discovery
- Duplicate detection
- Lead scoring and classification
- Draft generation for outreach and content
- Alerting a human when something worth reviewing shows up

⚠️ **Partially autonomous:**
- Some discovery sources are rate-limited and run on a slower cycle rather than continuously
- Outbound email is being moved to a fully independent sending path

## Guardrails

- Nothing is posted or sent without being marked as a reviewed, approved draft first
- No fabricated numbers, prices, or claims — anything unverifiable is flagged, not guessed
- No dishonest representation of skills or experience
- Low-confidence judgments are held for review, never acted on automatically
- Every discovery source funnels through the same evaluation and gating logic — no shortcuts for any one source

---

## Status dashboard

A live view of current drafts, leads, and their evaluation state is available for review at any time — nothing requires digging through logs to check on.

---

## License

Private project — not licensed for external use.
