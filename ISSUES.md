# Issues Tracker

> Add issues below. Remove after fix is committed. Format:
> `| Short description | S(1-3) | C(1-3) | Notes |`
> Severity: 1=critical 2=major 3=minor | Complexity: 1=quick 2=moderate 3=hard

## Backend

| Issue | Sev | Cpx | Notes |
|-------|-----|-----|-------|
| No API rate limiting | 1 | 2 | No DRF throttle classes; auth endpoints vulnerable to brute-force |
| N+1 query patterns | 2 | 2 | ClientDetailSerializer loops `.count()`, Task views missing prefetch |
| No transaction safety on writes | 2 | 2 | Task create + assignee set not atomic; partial failures possible |
| No Redis caching for reads | 3 | 2 | Redis only used for Channels + Celery; no view/query caching |
| Celery hardcodes dev settings module | 3 | 1 | `config/celery.py` hardcodes `settings.dev`; should use env var |
| Celery worker/beat race on first start | 3 | 1 | Fails if backend still migrating; restart fixes it |

