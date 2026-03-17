# Tasks: Work Hierarchy (Project / Epic / Task / Subtask)

**Input**: Design documents from `/specs/007-work-hierarchy/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Unit and component test tasks are included in Phase 9 (Polish). Automated e2e tests are included for critical flows.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/apps/`, `backend/tests/`, `backend/config/`
- **Frontend**: `frontend/src/app/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the new `projects` Django app and wire it into the project

- [x] T001 Create `projects` Django app scaffolding with `__init__.py`, `apps.py`, `models.py`, `serializers.py`, `views.py`, `services.py`, `urls.py`, `admin.py` in `backend/apps/projects/`
- [x] T002 Register `apps.projects` in `INSTALLED_APPS` in `backend/config/settings/base.py` and add `path("api/projects/", include("apps.projects.urls"))` and `path("api/epics/", include("apps.projects.urls_epics"))` to `backend/config/urls.py`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create all new models and schema changes that user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 [P] Create Project and Epic models with all fields (title, description, priority, status, deadline, assignee, client, tags, organization, created_by, version, timestamps), composite indexes, and M2M relationships in `backend/apps/projects/models.py` per data-model.md
- [x] T004 [P] Add `epic` FK (to Epic, null=True, SET_NULL) and `parent_task` FK (to self, null=True, SET_NULL, related_name='subtasks') to Task model, plus `entity_type` property, in `backend/apps/tasks/models.py`
- [x] T005 [P] Add `project` FK (to Project, null=True, CASCADE) and `epic` FK (to Epic, null=True, CASCADE) to Notification model, and add new event type choices (`project_assigned`, `project_unassigned`, `epic_assigned`, `epic_unassigned`) in `backend/apps/notifications/models.py`
- [x] T006 [P] Add `project` FK (to Project, null=True, CASCADE) and `epic` FK (to Epic, null=True, CASCADE) to AuditLogEntry model in `backend/apps/audit/models.py`
- [x] T007 Generate and apply all migrations: `projects/0001_initial`, `tasks/NNNN_add_hierarchy_fields`, `notifications/NNNN_add_hierarchy_fks`, `audit/NNNN_add_hierarchy_fks`
- [x] T008 [P] Create `ProjectFactory` and `EpicFactory` in `backend/tests/projects/factories.py` using factory-boy, following patterns from `backend/tests/factories.py`
- [x] T009 [P] Create frontend TypeScript interfaces (`Project`, `Epic`, `SubtaskSummary`, `ParentContext`) in `frontend/src/app/core/models/hierarchy.models.ts`

**Checkpoint**: All schema changes applied, factories and interfaces ready — user story implementation can begin

---

## Phase 3: User Story 1 — Create and manage Projects and Epics (Priority: P1) MVP

**Goal**: Managers can create Projects and Epics via API and view them in a new Projects section. Engineers can view but not create Projects.

**Independent Test**: Create a Project via API, then create an Epic under it, verify both appear in GET /api/projects/ and GET /api/epics/ with correct parent-child relationship.

### Backend for User Story 1

- [x] T010 [P] [US1] Create Project serializers (`ProjectListSerializer`, `ProjectDetailSerializer`, `ProjectCreateSerializer`, `ProjectUpdateSerializer`) with role-based field access (managers: full write; engineers: read-only) in `backend/apps/projects/serializers.py`
- [x] T011 [US1] Create Epic serializers (`EpicListSerializer`, `EpicDetailSerializer`, `EpicCreateSerializer`, `EpicUpdateSerializer`) with role-based field access and manager-only `project_id` re-parenting in `backend/apps/projects/serializers.py`
- [x] T012 [P] [US1] Implement project/epic service functions: versioned update with optimistic locking (409 on conflict), unrestricted status transitions for managers, audit log creation on changes in `backend/apps/projects/services.py`
- [x] T013 [P] [US1] Register Project and Epic in Django admin with list display, filters, and search in `backend/apps/projects/admin.py`
- [x] T014 [US1] Create `ProjectViewSet` with list (paginated, filterable by status/priority/client/search/ordering), create (manager-only), retrieve, partial_update (optimistic locking), destroy (manager-only), `status` action (manager-only), `epics` nested action, `history` action in `backend/apps/projects/views.py`
- [x] T015 [US1] Create `EpicViewSet` with list (filterable by project/standalone/status/priority/search/ordering), create (managers+engineers), retrieve, partial_update, destroy (manager-only), `status` action (manager-only), `tasks` nested action, `history` action in `backend/apps/projects/views.py`
- [x] T016 [US1] Register URL routes: project routes in `backend/apps/projects/urls.py`, epic routes in `backend/apps/projects/urls_epics.py`

### Frontend for User Story 1

- [x] T017 [P] [US1] Create `ProjectService` with CRUD methods for projects and epics (list, get, create, update, changeStatus, getEpics, getTasks, getHistory) in `frontend/src/app/core/services/project.service.ts`
- [x] T018 [US1] Create project routes (`/projects`, `/projects/:id`, `/epics/:id`) in `frontend/src/app/features/projects/projects.routes.ts` and register in `frontend/src/app/app.routes.ts` with `managerOrEngineerGuard`
- [x] T019 [US1] Create `ProjectListComponent` showing paginated list of projects with status/priority chips, assignee, deadline, and "Add" button (managers only) in `frontend/src/app/features/projects/components/project-list/`
- [x] T020 [P] [US1] Create `ProjectDetailComponent` showing project card with description, status, assignee, client, tags, child epics list, "Add" button (for creating child epic), and inline edit mode (manager-only: title, description, priority, deadline, assignee, client, tags with optimistic locking via version field) in `frontend/src/app/features/projects/components/project-detail/`
- [x] T021 [P] [US1] Create `EpicDetailComponent` showing epic card with description, status, parent project link, assignee, client, tags, child tasks list, "Add" button (for creating child task), and inline edit mode (managers: all fields including parent project re-parenting; engineers: assigned epics only, no re-parenting or status change) in `frontend/src/app/features/projects/components/epic-detail/`
- [x] T022 [US1] Add "Projects" nav item to sidebar in `frontend/src/app/core/components/layout/layout.component.ts` with icon `folder` and route `/projects`, visible to managers and engineers, positioned between Tasks and Kanban

**Checkpoint**: Projects and Epics fully manageable via API and browsable in the UI

---

## Phase 4: User Story 2 — Create Tasks and Subtasks within the hierarchy (Priority: P1)

**Goal**: Tasks can be linked to parent Epics, and Subtasks (tasks with a parent_task) can be created. Subtasks appear indented in the Tasks view.

**Independent Test**: Create a Task under an Epic via `POST /api/tasks/` with `epic_id`, then a Subtask under that Task with `parent_task_id`. Verify both appear in `GET /api/tasks/` with correct parent references and `entity_type` field.

### Backend for User Story 2

- [x] T023 [P] [US2] Extend Task serializers: add `epic` (nested read), `parent_task` (nested read), `entity_type` (derived), `subtasks_count` (annotated on list), `subtasks` (nested on detail), `epic_id`/`parent_task_id` (write) in `backend/apps/tasks/serializers.py`
- [x] T024 [P] [US2] Add subtask validation to Task serializers: parent must exist and belong to same org, parent must not be a subtask (max 1 level), subtask assignees limited to 0–1, subtask client forced null, manager-only re-parenting for `epic_id`/`parent_task_id` on update in `backend/apps/tasks/serializers.py`
- [x] T025 [US2] Extend `TaskViewSet`: default list filters to `parent_task__isnull=True`, add query params `parent_task`, `epic`, `entity_type`, `include_subtasks`; add `subtasks` nested action; annotate `subtasks_count`; prefetch subtasks on detail in `backend/apps/tasks/views.py`
- [x] T026 [US2] Extend task URL routes: add `subtasks` action path in `backend/apps/tasks/urls.py`

### Frontend for User Story 2

- [x] T027 [P] [US2] Extend `TaskService` with `getSubtasks(taskId)` method and update `getTasks()` to include `entity_type`/`parent_task`/`epic`/`subtasks_count` in response handling in `frontend/src/app/core/services/task.service.ts`
- [x] T028 [US2] Update `TaskListComponent` to show subtask expand/collapse indicators for tasks with `subtasks_count > 0`, load subtasks on expand, display subtasks indented with a type indicator (chip/icon) in `frontend/src/app/features/tasks/components/task-list/task-list.component.ts`
- [x] T047 [US2] Extend `TaskDetailComponent` edit form to include optional `epic_id` parent field (with search/select) for tasks and read-only `parent_task` display for subtasks; manager-only re-parenting restriction on both fields in `frontend/src/app/features/tasks/components/task-detail/task-detail.component.ts`

**Checkpoint**: Full hierarchy data flows end-to-end — tasks link to epics, subtasks nest under tasks

---

## Phase 5: User Story 3 — Unified "Add" button with entity type selection (Priority: P1)

**Goal**: A single "Add" button opens a modal where users select entity type (Project/Epic/Task/Subtask), see type-specific fields, and create any entity. Parent fields are auto-populated when opened from a parent context.

**Independent Test**: Click "Add" button, cycle through each entity type verifying correct fields appear, submit one entity of each type. Verify role restrictions (engineer cannot select Project).

### Frontend for User Story 3

- [x] T029 [US3] Create `CreateEntityDialogComponent` with `MatDialog`: entity type radio selector at top (Project/Epic/Task/Subtask), reactive form with conditional field sections per type, role-based restrictions (disable Project for engineers), submit calls appropriate service method in `frontend/src/app/features/tasks/components/create-dialog/`
- [x] T030 [US3] Implement parent auto-fill and cascade-fill in `CreateEntityDialogComponent`: accept optional `parentContext` input (`{parentType, parentId, projectId}`), pre-select entity type and auto-populate parent fields; when selecting an Epic parent for a Task, cascade-fill the Project display field (read-only) in `frontend/src/app/features/tasks/components/create-dialog/`
- [x] T031 [US3] Wire "Add" buttons: replace existing task-form full-page creation with dialog — remove `/tasks/new` route from `frontend/src/app/features/tasks/tasks.routes.ts`, update FAB/add buttons across TaskListComponent, ProjectDetailComponent, EpicDetailComponent, and TaskDetailComponent to open `CreateEntityDialogComponent` with appropriate `parentContext`
- [x] T032 [US3] Add i18n strings for all new UI labels (entity types, field labels, validation messages, nav items, buttons) to `frontend/src/i18n/en.json` and `frontend/src/i18n/ru.json`

**Checkpoint**: All entity types creatable from a single unified modal with correct field definitions and parent auto-fill

---

## Phase 6: User Story 4 — Navigate parent links from entity cards (Priority: P2)

**Goal**: Entity cards show clickable breadcrumb-style links to parent entities. Users can navigate Subtask → Task → Epic → Project.

**Independent Test**: Open a Subtask card, click parent Task link (navigates to task detail), click parent Epic link (navigates to epic detail), click parent Project link (navigates to project detail).

- [x] T033 [P] [US4] Create `ParentBreadcrumbComponent` (standalone, OnPush) that accepts parent chain data and renders clickable routerLinks for each ancestor in `frontend/src/app/shared/components/parent-breadcrumb/`
- [x] T034 [P] [US4] Integrate `ParentBreadcrumbComponent` into `TaskDetailComponent`: show parent Epic link (if task has epic), show parent Task link (if subtask) in `frontend/src/app/features/tasks/components/task-detail/task-detail.component.ts`
- [x] T035 [US4] Integrate `ParentBreadcrumbComponent` into `EpicDetailComponent`: show parent Project link (if epic has project) in `frontend/src/app/features/projects/components/epic-detail/`

**Checkpoint**: Full parent navigation chain works from any entity card

---

## Phase 7: User Story 5 — Browse Projects section with full tree view (Priority: P2)

**Goal**: The Projects page displays a `MatTree`-based hierarchy browser. Users expand Project → Epic → Task → Subtask with lazy loading at each level.

**Independent Test**: Create a full hierarchy, navigate to Projects section, expand each level of the tree, click entity names to navigate to detail cards.

- [x] T036 [US5] Refactor `ProjectListComponent` to use Angular CDK `MatTree` (flat tree with lazy loading): top level shows Projects + standalone Epics, expand Project → loads epics via `ProjectService.getEpics()`, expand Epic → loads tasks via `ProjectService.getTasks()`, expand Task → loads subtasks via `TaskService.getSubtasks()` in `frontend/src/app/features/projects/components/project-list/`
- [x] T037 [US5] Wire tree node clicks to entity detail navigation: Project → `/projects/:id`, Epic → `/epics/:id`, Task → `/tasks/:id`, Subtask → `/tasks/:id` in `frontend/src/app/features/projects/components/project-list/`
- [x] T038 [US5] Add loading indicators and empty state messages for each expandable level in the tree in `frontend/src/app/features/projects/components/project-list/`

**Checkpoint**: Full hierarchy browsable in tree view with lazy loading

---

## Phase 8: User Story 6 — Notifications on entity creation (Priority: P3)

**Goal**: When any entity is created with an assignee, the assignee receives a notification. Creators do not self-notify.

**Independent Test**: Create each entity type with an assignee (different from creator). Verify assignee receives notification. Verify creator does not receive self-notification.

### Backend for User Story 6

- [x] T039 [US6] Implement notification triggers on Project/Epic creation: when assignee is set and differs from creator, create a Notification with `project`/`epic` FK and event type `project_assigned`/`epic_assigned` in `backend/apps/projects/services.py`
- [x] T040 [US6] Verify existing Task/Subtask creation notification logic handles the new `epic` FK and `parent_task` FK correctly — ensure subtask assignment notifications work the same as task notifications in `backend/apps/tasks/services.py`

### Frontend for User Story 6

- [x] T041 [US6] Extend notification routing in `NotificationService`: route `project_assigned` notifications to `/projects/:id` and `epic_assigned` notifications to `/epics/:id` in `frontend/src/app/core/services/notification.service.ts`
- [x] T042 [US6] Update `LayoutComponent` notification dropdown to display project/epic notification types with appropriate icons and labels in `frontend/src/app/core/components/layout/layout.component.ts`

**Checkpoint**: All entity creation notifications delivered and routable

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final quality improvements across all user stories

- [x] T043 [P] Add drf-spectacular `@extend_schema` decorators to all new viewset actions in `backend/apps/projects/views.py` for OpenAPI documentation
- [x] T044 [P] Add Karma test specs for new Angular components (`ProjectListComponent`, `ProjectDetailComponent`, `EpicDetailComponent`, `CreateEntityDialogComponent`, `ParentBreadcrumbComponent`) following existing patterns in their respective `*.spec.ts` files
- [x] T045 [P] Add pytest tests for Project/Epic models, serializers, and views in `backend/tests/projects/test_models.py`, `backend/tests/projects/test_serializers.py`, `backend/tests/projects/test_views.py`
- [x] T046 Run quickstart.md manual validation walkthrough end-to-end
- [x] T048 Add automated e2e tests (Playwright) for critical flows: create full hierarchy (Project → Epic → Task → Subtask), parent navigation chain, role-based creation restrictions (engineer cannot create Project), delete project and verify epic orphaning

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational (Phase 2) — builds the core Project/Epic CRUD
- **US2 (Phase 4)**: Depends on Foundational (Phase 2) — can start in parallel with US1 (backend only; frontend subtask display is independent)
- **US3 (Phase 5)**: Depends on US1 (Phase 3) and US2 (Phase 4) — the unified dialog creates all entity types and needs all services available
- **US4 (Phase 6)**: Depends on US1 (Phase 3) and US2 (Phase 4) — needs entity detail components to exist
- **US5 (Phase 7)**: Depends on US1 (Phase 3) and US2 (Phase 4) — tree view loads all entity types
- **US6 (Phase 8)**: Depends on US1 (Phase 3) — notification triggers need project/epic services
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Start after Phase 2 — no dependencies on other stories
- **US2 (P1)**: Start after Phase 2 — independent of US1 (backend); frontend may start after US1 frontend service exists
- **US3 (P1)**: Start after US1 + US2 — needs all CRUD services and entity types
- **US4 (P2)**: Start after US1 + US2 — needs detail components to integrate breadcrumbs
- **US5 (P2)**: Start after US1 + US2 — needs all services for lazy loading
- **US6 (P3)**: Start after US1 — needs project/epic models and services

### Within Each User Story

- Serializers and services before views (backend)
- Views before URLs (backend)
- Services before components (frontend)
- Routes before components that depend on routing (frontend)

### Parallel Opportunities

- T003, T004, T005, T006 can all run in parallel (different model files)
- T008, T009 can run in parallel with each other and with T007
- T010, T011, T012, T013 can all run in parallel (different concerns within US1)
- T017 can run in parallel with backend US1 tasks (frontend service from contracts)
- T020, T021 can run in parallel (independent detail components)
- T023, T024 can run in parallel (different serializer concerns)
- T033, T034 can run in parallel (breadcrumb component + task-detail integration)
- T043, T044, T045, T048 can all run in parallel (independent polish tasks)

---

## Parallel Example: User Story 1

```bash
# Launch backend serializers, services, and admin in parallel:
Task: "T010 [P] [US1] Create Project serializers in backend/apps/projects/serializers.py"
Task: "T011 [P] [US1] Create Epic serializers in backend/apps/projects/serializers.py"
Task: "T012 [P] [US1] Implement project/epic services in backend/apps/projects/services.py"
Task: "T013 [P] [US1] Register admin in backend/apps/projects/admin.py"

# Then views (depend on serializers + services):
Task: "T014 [US1] Create ProjectViewSet in backend/apps/projects/views.py"
Task: "T015 [US1] Create EpicViewSet in backend/apps/projects/views.py"

# Frontend service can start in parallel with backend:
Task: "T017 [P] [US1] Create ProjectService in frontend/src/app/core/services/project.service.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 — Projects & Epics CRUD
4. Complete Phase 4: US2 — Tasks & Subtasks in hierarchy
5. **STOP and VALIDATE**: Verify full hierarchy works end-to-end via API and basic UI
6. Deploy/demo if ready — core hierarchy is usable

### Incremental Delivery

1. Setup + Foundational → Schema ready
2. US1 → Project/Epic management works → Deploy (MVP-1)
3. US2 → Task/Subtask hierarchy works → Deploy (MVP-2)
4. US3 → Unified creation modal → Deploy (UX upgrade)
5. US4 + US5 → Navigation + tree view → Deploy (discoverability)
6. US6 → Notifications → Deploy (team awareness)
7. Polish → Tests, docs, cleanup → Final release

---

## Notes

- [P] tasks = different files, no dependencies on other in-progress tasks
- [Story] label maps task to specific user story for traceability
- Subtasks are stored as Task rows with `parent_task` FK set (no separate table)
- Task model `entity_type` is a property, not a DB column
- Status/priority choices are shared across all 4 entity types
- Project/Epic status transitions are unrestricted for managers
- Re-parenting (changing parent FK after creation) is manager-only
- `SET_NULL` on all parent FKs — deleting a parent orphans children
- All new UI strings must go through `translate` pipe with keys in en.json/ru.json
- All new Angular components must be standalone + OnPush
