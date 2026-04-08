"""LLM prompts for report summary generation.

The prompts feed Markdown-rendered metrics (not raw JSON) to the model: smaller
token footprint and noticeably better factual grounding compared to nested JSON.
The system prompt encodes anti-patterns and a worked example so the model has
something to imitate instead of falling back to corporate filler.

Daily summaries use 2 sections (Overview, Watchlist) — there is rarely enough
signal in 24 hours to justify "Recommendations." Weekly and on-demand summaries
keep the full 5-section structure because they have multi-day trends to reason
about.
"""

SYSTEM_PROMPT = """\
You are a project management analyst for an IT outsourcing company.
You write concise, factual summaries of task management metrics for a manager.

# Hard rules
- Only reference numbers that appear verbatim in the metrics tables. Never invent counts, names, or dates.
- If a metric is N/A or zero, do not pad — say it briefly and move on.
- Quote concrete task titles, client names, and engineer names from the tables (no anonymization).
- Section headers must be exactly the H2 headings the user prompt asks for, in order.
- Plain prose under each header. No bullet lists unless the user prompt asks for them.

# Anti-patterns — never do these
- Do NOT use filler phrases: "overall", "in conclusion", "it is worth noting", "as an AI", "I will now".
- Do NOT restate the section header inside the section ("In the overview, ...").
- Do NOT invent recommendations when there is no signal — say "No actionable items this period" instead.
- Do NOT speculate about causes you cannot see in the data.

# Worked example (daily, low activity)
## Overview
2 tasks created and 1 closed on 2026-04-08. Throughput is light but normal for a Wednesday. No new overdue tasks. Cycle time held at ~6h median.

## Watchlist
"Migrate auth middleware" has been waiting 4 days — longest stuck task. 1 active task is unassigned. No critical-priority work in the queue.
"""

# ---------- Daily ----------

DAILY_USER_PROMPT = """\
Write a daily summary for {period_start}.

# Metrics
{metrics_markdown}

# Required sections (in order)
## Overview
2-4 sentences. Mention created vs closed counts, completion rate, and any new overdue tasks. \
If there is no activity, say so in one sentence and end the Overview.

## Watchlist
2-4 sentences. Name the longest-stuck task by title (if any). Mention unassigned count, \
critical-priority work, and any single concrete blocker. Skip categories that are zero.
"""

# ---------- Weekly ----------

WEEKLY_USER_PROMPT = """\
Write a weekly summary for {period_start} to {period_end}.

# Metrics
{metrics_markdown}

{trend_section}

# Required sections (in order)
## Overview
3-5 sentences. Total tasks created vs closed for the week, completion rate, overdue posture, \
and the headline trend if a previous week is available.

## Key Metrics
2-4 sentences. Cover lead time (created → done) and cycle time (in_progress → done) using median \
and p90 from the table — do not quote averages alone. Mention unassigned count.

## Highlights
2-4 sentences. Pick the busiest 1-2 clients and the busiest 1-2 engineers by name. Note any \
priority-mix or tag-mix worth flagging. Skip if nothing stands out.

## Risks & Blockers
2-4 sentences. Name the longest-stuck tasks by title, then call out overdue volume and any negative \
trend. If everything is fine, say "No blockers this week."

## Recommendations
1-3 sentences. Concrete, actionable next steps a manager can take this week. If there is no signal, \
write exactly "No actionable items this period."
"""

WEEKLY_TREND_SECTION = """\
# Week-over-week change
{deltas_markdown}

Only call out a delta in your prose if abs(change_pct) > 20% — smaller swings are noise.
"""

WEEKLY_NO_TREND_SECTION = "# Week-over-week change\nNo previous week data available."

# ---------- On-demand ----------

ON_DEMAND_USER_PROMPT = """\
Write a summary for the custom period {period_start} to {period_end}.

# Metrics
{metrics_markdown}

# Required sections (in order)
## Overview
3-5 sentences. Total activity, creation vs completion, overdue posture, and any standout pattern.

## Key Metrics
2-4 sentences. Cover lead time and cycle time (median + p90), completion rate, and unassigned count.

## Highlights
2-4 sentences. Busiest clients and engineers by name. Notable priority or tag distribution.

## Risks & Blockers
2-4 sentences. Stuck tasks by title, overdue posture, unassigned active work.

## Recommendations
1-3 sentences. Concrete next steps. If no signal, write exactly "No actionable items this period."
"""
