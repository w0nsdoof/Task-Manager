from apps.ai_summaries.services import (
    anonymize_metrics,
    compute_deltas,
    deanonymize_text,
    parse_sections,
)


class TestParseSections:
    def test_parses_standard_sections(self):
        text = (
            "## Overview\nSome overview text.\n\n"
            "## Key Metrics\nMetric details.\n\n"
            "## Highlights\nHighlights here."
        )
        sections = parse_sections(text)
        assert sections["Overview"] == "Some overview text."
        assert sections["Key Metrics"] == "Metric details."
        assert sections["Highlights"] == "Highlights here."

    def test_no_sections_falls_back_to_overview(self):
        text = "Just a plain text summary with no headers."
        sections = parse_sections(text)
        assert sections == {"Overview": text}

    def test_empty_text(self):
        sections = parse_sections("")
        assert sections == {"Overview": ""}

    def test_preserves_multiline_content(self):
        text = "## Overview\nLine 1\nLine 2\nLine 3\n\n## Risks & Blockers\nRisk info."
        sections = parse_sections(text)
        assert "Line 1\nLine 2\nLine 3" in sections["Overview"]
        assert sections["Risks & Blockers"] == "Risk info."


class TestAnonymizeMetrics:
    def test_replaces_client_and_engineer_names(self):
        metrics = {
            "by_client": [
                {"client_name": "Acme Corp", "total": 10, "done": 5},
                {"client_name": "Widgets Inc", "total": 3, "done": 1},
            ],
            "by_engineer": [
                {"engineer_name": "John Smith", "assigned": 8, "done": 4},
                {"engineer_name": "Jane Doe", "assigned": 5, "done": 3},
            ],
        }
        [anon], reverse_map = anonymize_metrics(metrics)

        assert anon["by_client"][0]["client_name"] == "Client A"
        assert anon["by_client"][1]["client_name"] == "Client B"
        assert anon["by_engineer"][0]["engineer_name"] == "Engineer 1"
        assert anon["by_engineer"][1]["engineer_name"] == "Engineer 2"

        assert reverse_map["Client A"] == "Acme Corp"
        assert reverse_map["Engineer 2"] == "Jane Doe"

    def test_does_not_mutate_original(self):
        metrics = {
            "by_client": [{"client_name": "Acme Corp", "total": 1, "done": 0}],
            "by_engineer": [],
        }
        anonymize_metrics(metrics)
        assert metrics["by_client"][0]["client_name"] == "Acme Corp"

    def test_empty_lists(self):
        metrics = {"by_client": [], "by_engineer": []}
        [anon], reverse_map = anonymize_metrics(metrics)
        assert anon == metrics
        assert reverse_map == {}

    def test_consistent_mapping_across_multiple_metrics(self):
        current = {
            "by_client": [{"client_name": "Acme Corp", "total": 5, "done": 2}],
            "by_engineer": [{"engineer_name": "John Smith", "assigned": 3, "done": 1}],
        }
        previous = {
            "by_client": [
                {"client_name": "Acme Corp", "total": 3, "done": 1},
                {"client_name": "NewCo", "total": 1, "done": 0},
            ],
            "by_engineer": [{"engineer_name": "John Smith", "assigned": 2, "done": 1}],
        }
        [anon_curr, anon_prev], reverse_map = anonymize_metrics(current, previous)

        # Same name should get the same pseudonym across both.
        assert anon_curr["by_client"][0]["client_name"] == anon_prev["by_client"][0]["client_name"]
        assert anon_curr["by_engineer"][0]["engineer_name"] == anon_prev["by_engineer"][0]["engineer_name"]

        # NewCo only in prev should still be mapped.
        assert anon_prev["by_client"][1]["client_name"] == "Client B"

    def test_handles_none_metrics(self):
        [result], reverse_map = anonymize_metrics(None)
        assert result is None
        assert reverse_map == {}


class TestDeanonymizeText:
    def test_restores_names(self):
        reverse_map = {"Client A": "Acme Corp", "Engineer 1": "John Smith"}
        text = "Client A had 10 tasks. Engineer 1 completed 5."
        result = deanonymize_text(text, reverse_map)
        assert result == "Acme Corp had 10 tasks. John Smith completed 5."

    def test_empty_mapping(self):
        text = "No changes needed."
        assert deanonymize_text(text, {}) == text

    def test_longest_first_prevents_partial_replacement(self):
        reverse_map = {
            "Client A": "Alpha Corp",
            "Client AB": "AlphaBeta Corp",
        }
        text = "Client AB had more tasks than Client A."
        result = deanonymize_text(text, reverse_map)
        assert "AlphaBeta Corp" in result
        assert "Alpha Corp" in result


class TestComputeDeltas:
    def test_computes_basic_deltas(self):
        current = {"tasks": {"total": 20, "created_in_period": 10, "closed_in_period": 8, "overdue": 3}}
        prev = {"tasks": {"total": 15, "created_in_period": 12, "closed_in_period": 6, "overdue": 5}}
        deltas = compute_deltas(current, prev)

        assert deltas["total"]["current"] == 20
        assert deltas["total"]["previous"] == 15
        assert deltas["total"]["change"] == 5
        assert deltas["total"]["change_pct"] == 33.3

        assert deltas["overdue"]["change"] == -2

    def test_handles_zero_previous(self):
        current = {"tasks": {"total": 10}}
        prev = {"tasks": {"total": 0}}
        deltas = compute_deltas(current, prev)
        assert deltas["total"]["change_pct"] is None

    def test_handles_missing_keys(self):
        current = {"tasks": {"total": 5}}
        prev = {"tasks": {}}
        deltas = compute_deltas(current, prev)
        assert deltas["total"]["previous"] == 0
        assert deltas["total"]["change"] == 5

    def test_skips_both_none(self):
        current = {"tasks": {}}
        prev = {"tasks": {}}
        deltas = compute_deltas(current, prev)
        assert "avg_resolution_time_hours" not in deltas
