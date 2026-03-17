# Implementation Plan: Work Hierarchy (Project / Epic / Task / Subtask)

**Branch**: `007-work-hierarchy` | **Date**: 2026-03-17 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/007-work-hierarchy/spec.md`

## Summary

Introduce a four-level work hierarchy (Project → Epic → Task → Subtask) by adding a new `projects` Django app for Project and Epic models, extending the existing Task model with optional parent references (`epic` FK and self-referential `parent_task` FK), providing a unified creation dialog with entity type selection, a new Projects section with `MatTree`-based tree view, parent navigation breadcrumbs, cascading parent auto-fill, and creation notifications for all entity types.

## Technical Context

**Language/Version**: Python 3.13, Django 6.0 / DRF 3.16 (backend); TypeScript 5.8, Angular 19 (frontend)
**Primary Dependencies**: Django REST Framework 3.16, drf-spectacular, Angular Material 19, Angular CDK
**Storage**: PostgreSQL 16 (shared database, organization FK discriminator)
**Testing**: pytest + factory-boy (backend), Karma/Jasmine (frontend)
**Target Platform**: Web application (Linux server + browser SPA)
**Project Type**: Web (separate backend/ and frontend/ directories)
**Performance Goals**: <300ms p95 API responses, paginated lists, no N+1 queries
**Constraints**: Must preserve all existing Task behavior; multi-tenant via organization FK; i18n (en/ru); engineers cannot change Project/Epic status
**Scale/Scope**: Existing ~16 Django apps, ~30 Angular components; adding 2 new models, extending 2 existing models, ~8 new components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality | PASS | Python: ruff enforced; TypeScript: Angular style guide; all components standalone + OnPush |
| II. Testing Discipline | PASS | pytest + factory-boy for new models/views; Karma specs for new components; E2E for hierarchy creation flow |
| III. Security | PASS | JWT auth on all new endpoints; RBAC enforced (managers create projects, engineers restricted); server-side validation |
| IV. Performance | PASS | Pagination on all list endpoints; `select_related`/`prefetch_related` for FKs; indexed status/priority/parent FKs |
| V. Localization | PASS | All new UI strings via `translate` pipe (en.json/ru.json); no hardcoded text |
| VI. Database | PASS | PostgreSQL; Django migrations for all schema changes; indexes on FKs, status, priority |
| VII. Documentation | PASS | drf-spectacular auto-generates OpenAPI from serializers; new endpoints documented via decorators |
| VIII. UX Consistency | PASS | Angular Material only (MatTree, MatDialog, MatStepper, MatFormField); shared design tokens; snackbar feedback |

**Gate result**: ALL PASS — proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/007-work-hierarchy/
├── plan.md              # This file
├── research.md          # Phase 0 output — design decisions
├── data-model.md        # Phase 1 output — entity models
├── quickstart.md        # Phase 1 output — local dev guide
├── contracts/           # Phase 1 output — API contracts
│   ├── projects.yaml    #   Project endpoints
│   ├── epics.yaml       #   Epic endpoints
│   └── tasks.yaml       #   Task endpoint changes
└── tasks.md             # Phase 2 output (from /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── apps/
│   ├── projects/              # NEW app — Project & Epic models
│   │   ├── models.py          #   Project, Epic models
│   │   ├── serializers.py     #   CRUD serializers per role
│   │   ├── views.py           #   ProjectViewSet, EpicViewSet
│   │   ├── services.py        #   Status transitions, versioned updates
│   │   ├── urls.py            #   /api/projects/, /api/epics/
│   │   ├── admin.py
│   │   └── apps.py
│   ├── tasks/                 # EXTENDED — add parent refs
│   │   ├── models.py          #   + epic FK, parent_task FK, entity_type property
│   │   ├── serializers.py     #   + subtask serializers, parent fields
│   │   ├── views.py           #   + subtask filtering, parent cascade
│   │   └── services.py        #   + subtask status transitions
│   ├── notifications/         # EXTENDED — project/epic support
│   │   └── models.py          #   + project FK, epic FK, new event types
│   └── audit/                 # EXTENDED — project/epic support
│       └── models.py          #   + project FK, epic FK
└── tests/
    └── projects/              # NEW — tests for projects app
        ├── test_models.py
        ├── test_serializers.py
        ├── test_views.py
        └── factories.py

frontend/src/app/
├── core/
│   ├── services/
│   │   ├── project.service.ts    # NEW — Project/Epic API client
│   │   ├── task.service.ts       # EXTENDED — subtask support, parent refs
│   │   └── notification.service.ts  # EXTENDED — project/epic notification routing
│   ├── models/
│   │   └── hierarchy.models.ts   # NEW — Project, Epic, Subtask interfaces
│   └── constants/
│       └── task-status.ts        # EXTENDED — entity type awareness
├── features/
│   ├── projects/                 # NEW feature module
│   │   ├── components/
│   │   │   ├── project-list/     #   MatTree-based hierarchy browser
│   │   │   ├── project-detail/   #   Project card with child epics
│   │   │   └── epic-detail/      #   Epic card with child tasks
│   │   └── projects.routes.ts
│   └── tasks/
│       ├── components/
│       │   ├── task-list/        # EXTENDED — subtask indentation
│       │   ├── task-detail/      # EXTENDED — parent breadcrumbs
│       │   ├── task-form/        # REPLACED by unified dialog
│       │   └── create-dialog/    # NEW — unified entity creation dialog
│       └── tasks.routes.ts       # EXTENDED — remove /tasks/new route
└── shared/
    └── components/
        └── parent-breadcrumb/    # NEW — reusable parent navigation links
```

**Structure Decision**: Web application layout. New `projects` Django app for Project/Epic (separation of concerns from the already-large tasks app). Task model extended in-place. Frontend gets a new `projects` feature module and a shared `create-dialog` component.

## Complexity Tracking

No constitution violations — table intentionally left empty.
