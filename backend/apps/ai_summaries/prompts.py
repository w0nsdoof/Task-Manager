SYSTEM_PROMPT = """\
You are a project management analyst for an IT outsourcing company.
Your job is to write clear, concise narrative summaries of task management metrics.

Rules:
- Structure your response with exactly these section headers:
  ## Overview
  ## Key Metrics
  ## Highlights
  ## Risks & Blockers
  ## Recommendations
- Write in plain text paragraphs under each section header.
- Be factual — only reference data provided, never invent numbers.
- Keep summaries under 500 words for daily, under 800 words for weekly.
- Use a professional but readable tone.
- If there is no activity in the period, say so briefly in the Overview."""

DAILY_USER_PROMPT = """\
Write a daily summary for {period_start}.

Here are the task metrics for this day:

{metrics_json}

In the Overview, summarize key activity: tasks created, completed, and overdue.
In Key Metrics, cover resolution time, completion rate, and unassigned tasks.
In Highlights, note notable patterns in priority distribution, client activity, or engineer workload.
In Risks & Blockers, flag overdue and stuck waiting tasks.
In Recommendations, suggest actionable next steps."""

WEEKLY_USER_PROMPT = """\
Write a weekly summary for {period_start} to {period_end}.

Here are the task metrics for this week:

{metrics_json}

{trend_section}

In the Overview, summarize total tasks, creation vs completion rate, and overdue situation.
In Key Metrics, cover resolution time, completion rate, and unassigned tasks.
In Highlights, break down notable client and engineer activity and tag patterns.
In Risks & Blockers, flag overdue tasks, stuck tasks, and negative trends.
In Recommendations, identify areas needing management attention."""

WEEKLY_TREND_SECTION = """\
Week-over-week comparison (pre-computed deltas):

{deltas_json}

Reference these deltas directly in your analysis. \
Positive change means increase, negative means decrease. \
change_pct is the percentage change."""

WEEKLY_NO_TREND_SECTION = "No previous week data is available for trend comparison."

ON_DEMAND_USER_PROMPT = """\
Write a summary for the custom period {period_start} to {period_end}.

Here are the task metrics for this period:

{metrics_json}

In the Overview, provide a comprehensive overview of task activity.
In Key Metrics, cover creation/completion rates, resolution time, and priority breakdown.
In Highlights, note client activity, engineer workload, and tag distribution.
In Risks & Blockers, flag overdue tasks, stuck tasks, and unassigned work.
In Recommendations, suggest improvements."""
