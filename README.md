# Web3 Brand Agent — Setup Guide (Beginner-Friendly)

This is a NestJS project with two AI agents:
1. **Content Agent** — drafts X posts/threads using Groq (free AI)
2. **Lead-Gen Agent** — scores potential Web3 client leads using Groq

Drafts and leads are saved to Supabase (a database) for you to review. Posting to X
is a separate, optional step you only enable once you're ready.

---

## STEP 1 — Install dependencies

Open a terminal INSIDE this project folder (`web3-agent`), then run:

```
npm install
```

This downloads all the packages listed in `package.json`. Takes 1-2 minutes.

---

## STEP 2 — Set up Supabase (your database)

1. Go to https://supabase.com and open your existing project (or create a new one — free tier is fine).
2. In the left sidebar, click **SQL Editor**.
3. Open the file `supabase/schema.sql` in this project, copy ALL of its contents.
4. Paste it into the Supabase SQL Editor and click **Run**.
   - This creates 4 tables: `content_drafts`, `leads`, `topic_signals`, `agent_runs`.
5. In Supabase, go to **Settings → API**. You'll need two values from this page:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **service_role key** (NOT the anon key — service_role, under "Project API keys")

---

## STEP 3 — Set up your .env file

1. In this project folder, find `.env.example`.
2. Make a COPY of it and rename the copy to `.env` (just `.env`, no "example").
3. Open `.env` and fill in:
   - `GROQ_API_KEY` → from https://console.groq.com/keys (you said you already have this)
   - `SUPABASE_URL` → the Project URL from Step 2
   - `SUPABASE_SERVICE_ROLE_KEY` → the service_role key from Step 2
   - Leave the `X_...` fields empty for now — you don't need them until you're ready to post.

**IMPORTANT:** Never share your `.env` file or paste its contents anywhere public. It contains secret keys.

---

## STEP 4 — Run the project

In your terminal, inside the project folder:

```
npm run start:dev
```

If everything is set up right, you'll see:
```
🚀 Web3 Brand Agent running on http://localhost:3000
```

Leave this terminal window open — it's your running agent.

---

## STEP 5 — Test it (no coding needed)

Use a free tool called **Postman** (https://www.postman.com/downloads/) or even just your terminal with `curl`, to send test requests.

### Test 1: Draft a tweet

```
curl -X POST http://localhost:3000/agent/draft \
  -H "Content-Type: application/json" \
  -d "{\"topic\": \"I just shipped background removal in my wardrobe app Garbiq using rembg\"}"
```

Check Supabase → Table Editor → `content_drafts` table. You should see a new row with a drafted tweet, status = `draft`.

### Test 2: Evaluate a lead

```
curl -X POST http://localhost:3000/agent/evaluate-lead \
  -H "Content-Type: application/json" \
  -d "{\"source\": \"manual\", \"text\": \"Looking for a React Native dev for our DeFi wallet app, budget $3k, funded project\"}"
```

Check Supabase → Table Editor → `leads` table for the result.

---

## STEP 6 — Reviewing & approving drafts

Right now, nothing gets posted automatically. To approve a draft:
1. Go to Supabase → Table Editor → `content_drafts`
2. Find the row you want to post
3. Change its `status` column from `draft` to `approved`

## STEP 7 — Posting to X (optional, later)

You need X API access (paid Basic tier, ~$100/mo) to post programmatically. Once you have that:
1. Fill in the `X_...` values in `.env`
2. Restart the server (`Ctrl+C` then `npm run start:dev` again)
3. Run: `curl -X POST http://localhost:3000/agent/post-approved`

This posts every draft marked `approved`.

---

## What each folder does

- `src/content-agent/` — drafts tweets/threads
- `src/leadgen-agent/` — scores incoming leads
- `src/x-integration/` — posts to X (only used in Step 7)
- `src/supabase/` — talks to your database
- `src/orchestrator/` — the HTTP endpoints you call to trigger things
- `src/common/prompts.ts` — the AI instructions (your AGENTS.md content, in code form)

---

## If something breaks

- **"Cannot find module"** → run `npm install` again
- **"GROQ_API_KEY is not defined"** → check your `.env` file exists and is filled in, restart the server
- **Supabase errors** → double check you ran the full `schema.sql` and copied the `service_role` key (not `anon`)

If you get stuck at any step, tell me the exact error message and I'll help you fix it.