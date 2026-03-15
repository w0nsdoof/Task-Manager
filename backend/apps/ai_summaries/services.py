import copy
import json
import logging
import time

from django.conf import settings

from apps.reports.services import get_report_data

from .prompts import (
    DAILY_USER_PROMPT,
    ON_DEMAND_USER_PROMPT,
    SYSTEM_PROMPT,
    WEEKLY_NO_TREND_SECTION,
    WEEKLY_TREND_SECTION,
    WEEKLY_USER_PROMPT,
)

logger = logging.getLogger(__name__)

FALLBACK_TEMPLATE = """\
## Overview
Report Summary ({period_type}) for {start_date} to {end_date}.

## Key Metrics
- Total tasks: {total}
- Created in period: {created}
- Completed in period: {closed}
- Currently overdue: {overdue}
- Avg resolution time: {avg_resolution}
- Completion rate: {completion_rate}
- Unassigned active tasks: {unassigned}

## Highlights
Priority breakdown:
{priority_breakdown}

Top clients by activity:
{client_breakdown}

Tag distribution:
{tag_breakdown}

## Risks & Blockers
{overdue_warning}
{stuck_warning}

## Recommendations
Engineer workload:
{engineer_breakdown}

Note: This summary was generated using a template because the AI service \
was temporarily unavailable. An AI-enhanced summary may be regenerated later."""

SECTION_ORDER = ["Overview", "Key Metrics", "Highlights", "Risks & Blockers", "Recommendations"]


def call_llm(system_prompt, user_prompt):
    """Call LLM via LiteLLM. Returns (text, model, prompt_tokens, completion_tokens)."""
    import litellm

    litellm.num_retries = 3
    litellm.request_timeout = 60

    kwargs = {
        "model": settings.LLM_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": settings.LLM_MAX_TOKENS,
        "temperature": settings.LLM_TEMPERATURE,
    }
    if settings.LLM_API_KEY:
        kwargs["api_key"] = settings.LLM_API_KEY
    if settings.LLM_API_BASE:
        kwargs["api_base"] = settings.LLM_API_BASE

    response = litellm.completion(**kwargs)
    text = response.choices[0].message.content
    model = response.model or settings.LLM_MODEL
    prompt_tokens = getattr(response.usage, "prompt_tokens", None)
    completion_tokens = getattr(response.usage, "completion_tokens", None)
    return text, model, prompt_tokens, completion_tokens


def parse_sections(text):
    """Parse LLM output into structured sections dict keyed by header name."""
    sections = {}
    current_section = None
    current_lines = []

    for line in text.split("\n"):
        stripped = line.strip()
        if stripped.startswith("## "):
            if current_section:
                sections[current_section] = "\n".join(current_lines).strip()
            current_section = stripped[3:].strip()
            current_lines = []
        else:
            current_lines.append(line)

    if current_section:
        sections[current_section] = "\n".join(current_lines).strip()

    if not sections:
        sections = {"Overview": text.strip()}

    return sections


def anonymize_metrics(*metrics_list):
    """Replace real client/engineer names with pseudonyms across one or more metrics dicts.

    Returns (list_of_anonymized_copies, reverse_mapping).
    The reverse mapping maps pseudonyms back to real names.
    """
    # Collect all unique names from all metrics dicts.
    client_names = []
    engineer_names = []
    seen_clients = set()
    seen_engineers = set()

    for metrics in metrics_list:
        if not metrics:
            continue
        for c in metrics.get("by_client", []):
            name = c.get("client_name", "")
            if name and name not in seen_clients:
                seen_clients.add(name)
                client_names.append(name)
        for e in metrics.get("by_engineer", []):
            name = e.get("engineer_name", "")
            if name and name not in seen_engineers:
                seen_engineers.add(name)
                engineer_names.append(name)

    # Build forward mapping (real -> pseudonym).
    forward = {}
    for i, name in enumerate(client_names):
        forward[name] = f"Client {chr(65 + i)}" if i < 26 else f"Client {i + 1}"
    for i, name in enumerate(engineer_names):
        forward[name] = f"Engineer {i + 1}"

    # Build reverse mapping (pseudonym -> real).
    reverse = {v: k for k, v in forward.items()}

    # Deep-copy and replace names in each metrics dict.
    results = []
    for metrics in metrics_list:
        if not metrics:
            results.append(metrics)
            continue
        anon = copy.deepcopy(metrics)
        for c in anon.get("by_client", []):
            real = c.get("client_name", "")
            if real in forward:
                c["client_name"] = forward[real]
        for e in anon.get("by_engineer", []):
            real = e.get("engineer_name", "")
            if real in forward:
                e["engineer_name"] = forward[real]
        results.append(anon)

    return results, reverse


def deanonymize_text(text, reverse_mapping):
    """Replace pseudonyms in LLM output text with real names.

    Sorts pseudonyms longest-first to avoid partial replacements.
    """
    if not reverse_mapping:
        return text
    for pseudonym in sorted(reverse_mapping, key=len, reverse=True):
        text = text.replace(pseudonym, reverse_mapping[pseudonym])
    return text


def compute_deltas(current_metrics, prev_metrics):
    """Compute absolute and percentage deltas between two periods' task metrics."""
    deltas = {}
    current_tasks = current_metrics.get("tasks", {})
    prev_tasks = prev_metrics.get("tasks", {})

    keys = [
        "total", "created_in_period", "closed_in_period", "overdue",
        "unassigned_count", "avg_resolution_time_hours", "completion_rate",
    ]
    for key in keys:
        curr = current_tasks.get(key)
        prev = prev_tasks.get(key)
        if curr is None and prev is None:
            continue
        curr = curr or 0
        prev = prev or 0
        change = round(curr - prev, 1)
        change_pct = round((curr - prev) / prev * 100, 1) if prev else None
        deltas[key] = {
            "current": curr,
            "previous": prev,
            "change": change,
            "change_pct": change_pct,
        }

    return deltas


def generate_fallback_summary(period_type, metrics_data):
    """Generate a template-based summary from raw metrics."""
    tasks = metrics_data.get("tasks", {})
    period = metrics_data.get("period", {})

    priority_lines = []
    for p, count in tasks.get("by_priority", {}).items():
        priority_lines.append(f"- {p}: {count}")
    priority_breakdown = "\n".join(priority_lines) if priority_lines else "- No data"

    client_lines = []
    for c in metrics_data.get("by_client", [])[:5]:
        client_lines.append(f"- {c['client_name']}: {c['total']} tasks ({c['done']} done)")
    client_breakdown = "\n".join(client_lines) if client_lines else "- No data"

    engineer_lines = []
    for e in metrics_data.get("by_engineer", [])[:5]:
        engineer_lines.append(f"- {e['engineer_name']}: {e['assigned']} assigned ({e['done']} done)")
    engineer_breakdown = "\n".join(engineer_lines) if engineer_lines else "- No data"

    tag_lines = []
    for t in metrics_data.get("by_tag", [])[:5]:
        tag_lines.append(f"- {t['tag_name']}: {t['count']} tasks")
    tag_breakdown = "\n".join(tag_lines) if tag_lines else "- No data"

    overdue_count = tasks.get("overdue", 0)
    overdue_warning = f"- {overdue_count} overdue tasks need attention." if overdue_count else "- No overdue tasks."

    stuck = tasks.get("stuck_waiting", {})
    stuck_count = stuck.get("count", 0)
    if stuck_count:
        stuck_titles = ", ".join(t["title"] for t in stuck.get("tasks", []))
        stuck_warning = f"- {stuck_count} tasks stuck in waiting for 3+ days: {stuck_titles}"
    else:
        stuck_warning = "- No stuck tasks."

    avg_res = tasks.get("avg_resolution_time_hours")
    avg_resolution = f"{avg_res} hours" if avg_res is not None else "N/A"
    comp_rate = tasks.get("completion_rate")
    completion_rate = f"{comp_rate}%" if comp_rate is not None else "N/A"

    return FALLBACK_TEMPLATE.format(
        period_type=period_type,
        start_date=period.get("from", "N/A"),
        end_date=period.get("to", "N/A"),
        total=tasks.get("total", 0),
        created=tasks.get("created_in_period", 0),
        closed=tasks.get("closed_in_period", 0),
        overdue=overdue_count,
        avg_resolution=avg_resolution,
        completion_rate=completion_rate,
        unassigned=tasks.get("unassigned_count", 0),
        priority_breakdown=priority_breakdown,
        client_breakdown=client_breakdown,
        tag_breakdown=tag_breakdown,
        overdue_warning=overdue_warning,
        stuck_warning=stuck_warning,
        engineer_breakdown=engineer_breakdown,
    )


def collect_metrics(period_start, period_end, organization=None):
    """Collect task metrics for a given date range using the existing reports service."""
    return get_report_data(
        date_from=str(period_start),
        date_to=str(period_end),
        organization=organization,
    )


def _build_user_prompt(period_type, period_start, period_end, metrics_data, prev_metrics=None):
    """Build the appropriate user prompt for the period type."""
    metrics_json = json.dumps(metrics_data, indent=2, default=str)

    if period_type == "daily":
        return DAILY_USER_PROMPT.format(
            period_start=period_start,
            metrics_json=metrics_json,
        )
    elif period_type == "weekly":
        if prev_metrics:
            deltas = compute_deltas(metrics_data, prev_metrics)
            trend_section = WEEKLY_TREND_SECTION.format(
                deltas_json=json.dumps(deltas, indent=2, default=str),
            )
        else:
            trend_section = WEEKLY_NO_TREND_SECTION
        return WEEKLY_USER_PROMPT.format(
            period_start=period_start,
            period_end=period_end,
            metrics_json=metrics_json,
            trend_section=trend_section,
        )
    else:
        return ON_DEMAND_USER_PROMPT.format(
            period_start=period_start,
            period_end=period_end,
            metrics_json=metrics_json,
        )


def notify_managers_of_summary(summary):
    """Create a notification for all managers when a summary is ready."""
    from apps.accounts.models import User
    from apps.notifications.services import create_notification

    period_desc = f"{summary.period_start}"
    if summary.period_start != summary.period_end:
        period_desc = f"{summary.period_start} to {summary.period_end}"

    message = (
        f"A new {summary.get_period_type_display().lower()} summary "
        f"for {period_desc} is available."
    )

    managers = User.objects.filter(role=User.Role.MANAGER, is_active=True, organization=summary.organization)
    for manager in managers:
        create_notification(
            recipient=manager,
            event_type="summary_ready",
            task=None,
            message=message,
            related_object_id=summary.id,
        )
    logger.info("Notified %d managers about summary id=%s", managers.count(), summary.id)


def generate_summary_for_period(summary_id, prev_metrics=None):
    """Orchestrate summary generation: collect metrics, call LLM, handle fallback."""
    from .models import ReportSummary

    summary = ReportSummary.objects.get(pk=summary_id)
    summary.status = ReportSummary.Status.GENERATING
    summary.save(update_fields=["status"])

    logger.info(
        "Generating summary id=%s period_type=%s period=%s-%s",
        summary.id, summary.period_type, summary.period_start, summary.period_end,
    )

    metrics_data = collect_metrics(summary.period_start, summary.period_end, organization=summary.organization)
    summary.raw_data = metrics_data
    summary.save(update_fields=["raw_data"])

    # Anonymize names before sending to LLM.
    metrics_list = [metrics_data]
    if prev_metrics:
        metrics_list.append(prev_metrics)
    anon_list, reverse_map = anonymize_metrics(*metrics_list)
    anon_metrics = anon_list[0]
    anon_prev = anon_list[1] if prev_metrics else None

    user_prompt = _build_user_prompt(
        summary.period_type, summary.period_start, summary.period_end,
        anon_metrics, anon_prev,
    )
    summary.prompt_text = user_prompt
    summary.save(update_fields=["prompt_text"])

    start_time = time.monotonic()
    try:
        text, model, prompt_tokens, completion_tokens = call_llm(SYSTEM_PROMPT, user_prompt)
        elapsed_ms = int((time.monotonic() - start_time) * 1000)

        # Restore real names in LLM output.
        text = deanonymize_text(text, reverse_map)
        sections = parse_sections(text)

        summary.summary_text = text
        summary.sections = sections
        summary.generation_method = ReportSummary.GenerationMethod.AI
        summary.status = ReportSummary.Status.COMPLETED
        summary.llm_model = model
        summary.prompt_tokens = prompt_tokens
        summary.completion_tokens = completion_tokens
        summary.generation_time_ms = elapsed_ms
        summary.save(update_fields=[
            "summary_text", "sections", "generation_method", "status",
            "llm_model", "prompt_tokens", "completion_tokens", "generation_time_ms",
        ])
        logger.info(
            "Summary completed id=%s method=ai model=%s tokens=%s/%s time_ms=%s",
            summary.id, model, prompt_tokens, completion_tokens, elapsed_ms,
        )
        notify_managers_of_summary(summary)
    except Exception as e:
        elapsed_ms = int((time.monotonic() - start_time) * 1000)
        logger.warning(
            "LLM failed for summary id=%s: %s. Using fallback.", summary.id, e,
        )
        fallback_text = generate_fallback_summary(summary.period_type, metrics_data)
        sections = parse_sections(fallback_text)

        summary.summary_text = fallback_text
        summary.sections = sections
        summary.generation_method = ReportSummary.GenerationMethod.FALLBACK
        summary.status = ReportSummary.Status.COMPLETED
        summary.error_message = str(e)
        summary.generation_time_ms = elapsed_ms
        summary.save(update_fields=[
            "summary_text", "sections", "generation_method", "status",
            "error_message", "generation_time_ms",
        ])
        logger.info("Summary completed id=%s method=fallback time_ms=%s", summary.id, elapsed_ms)
        notify_managers_of_summary(summary)

    return summary
