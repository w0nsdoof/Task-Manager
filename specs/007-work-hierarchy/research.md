# Research: Work Hierarchy

**Feature**: 007-work-hierarchy | **Date**: 2026-03-17

## 1. Hierarchy Modeling: Separate Models vs. Single Table Inheritance

**Decision**: Hybrid approach — new models for Project and Epic; extend existing Task model for Subtasks via self-referential FK.

**Rationale**:
- Project and Epic have fundamentally different field semantics from Task (single assignee vs. M2M, no initiator, different required fields). Separate models give clean validation and serialization.
- Subtasks share 90% of Task's fields (title, description, status, priority, deadline, assignees, tags) and must appear in the existing Tasks view (FR-010). Storing them in the same table avoids UNION queries and preserves pagination.
- A self-referential `parent_task` FK on Task (nullable) identifies subtasks. No `entity_type` column needed — derive via `parent_task_id IS NOT NULL`.
- An `epic` FK on Task (nullable) links tasks to their parent epic, enabling cascade-fill of the project via `task.epic.project`.

**Alternatives considered**:
- *Full STI (one table for all 4 types)*: Would require nullable columns for every field difference, complex validation, and polluted schema. Rejected.
- *Four separate models*: Would require UNION queries to display tasks and subtasks together in the Tasks view, breaking pagination. Rejected.
- *Explicit `entity_type` column on Task*: Redundant with `parent_task_id IS NOT NULL`. Would risk inconsistency (type says 'task' but parent_task is set). Rejected in favor of a model property.

## 2. Tree Query Patterns for the Projects Section

**Decision**: Adjacency list with lazy loading — load one level at a time on user expand.

**Rationale**:
- The hierarchy is exactly 4 levels deep (Project → Epic → Task → Subtask), so recursive CTEs provide no benefit over simple FK queries at each level.
- Lazy loading keeps initial page load fast: load Projects + standalone Epics first, then fetch children on expand.
- Django's `prefetch_related` efficiently batches child queries when multiple nodes are expanded.
- The Projects page tree view uses 3 separate API calls as the user drills down:
  1. `GET /api/projects/` + `GET /api/epics/?standalone=true` → top level
  2. `GET /api/projects/{id}/epics/` → epics under a project (on expand)
  3. `GET /api/epics/{id}/tasks/` → tasks under an epic (on expand)
  4. `GET /api/tasks/?parent_task={id}` → subtasks under a task (on expand)

**Alternatives considered**:
- *Recursive CTE / django-treebeard / django-mptt*: Overkill for a fixed 4-level hierarchy. Adds dependencies and complexity (MPTT tree rebuilds, nested set updates). Rejected.
- *Full tree in one API call*: Would return potentially thousands of items. Bad for performance and UX. Rejected.
- *Materialized path (e.g., "proj_1/epic_3/task_7")*: Useful for deep arbitrary trees, but our hierarchy is fixed-depth with typed levels. FK-based approach is simpler and strongly typed. Rejected.

## 3. Task List API: Subtask Inclusion Strategy

**Decision**: Default task list returns top-level tasks only; subtasks loaded on demand as nested data.

**Rationale**:
- The existing `/api/tasks/` endpoint is paginated (20 items/page). Including subtasks in the flat list would break pagination semantics (a task with 10 subtasks would count as 11 items).
- Instead: the list endpoint filters to `parent_task__isnull=True` by default and annotates `subtasks_count`. The frontend shows an expand indicator for tasks with subtasks.
- On expand, subtasks are fetched via `GET /api/tasks/?parent_task={id}` (same endpoint, filtered).
- The detail endpoint (`GET /api/tasks/{id}/`) includes a nested `subtasks` array (prefetched, max practical depth = 1 level).

**Alternatives considered**:
- *Flat list with all tasks and subtasks mixed*: Breaks pagination, confusing sort order. Rejected.
- *Subtasks always nested in list response*: Would make paginated responses unpredictably large. Rejected.
- *Separate `/api/subtasks/` endpoint*: Unnecessary since subtasks ARE tasks with a parent. Would duplicate serializer/view logic. Rejected.

## 4. Notification & Audit Model Extension

**Decision**: Add nullable `project` and `epic` FKs to both Notification and AuditLogEntry models.

**Rationale**:
- The existing `Notification.task` FK works for task/subtask notifications (subtasks ARE tasks).
- Project and Epic notifications need their own FK references for frontend routing (click notification → navigate to project/epic detail).
- Adding two nullable FKs is simpler than GenericForeignKey and maintains strong typing, referential integrity, and queryability.
- New event types: `project_assigned`, `project_unassigned`, `epic_assigned`, `epic_unassigned`.
- AuditLogEntry follows the same pattern: add `project` FK and `epic` FK (nullable) for audit trails on those entities.

**Alternatives considered**:
- *GenericForeignKey (content_type + object_id)*: Loses referential integrity, complicates queries (`Notification.objects.filter(task=...)` becomes impossible), no CASCADE. Rejected.
- *Single polymorphic `entity_id` + `entity_type` string*: Same downsides as GFK, plus stringly-typed. Rejected.

## 5. Unified Creation Dialog: Frontend Architecture

**Decision**: `MatDialog` with entity type radio group at top, followed by a reactive form that swaps field groups based on selection.

**Rationale**:
- The spec requires a "modal" (FR-002). `MatDialog` is the Angular Material standard for modals.
- A single reactive form with conditional `*ngIf` sections per entity type avoids multiple form instances and simplifies validation.
- The dialog accepts optional `parentContext` input (e.g., `{ parentType: 'epic', parentId: 123, projectId: 456 }`) to auto-populate parent fields and pre-select entity type when opened from a parent's card.
- Entity type radio group restricts options by role (engineers cannot select 'Project').
- On submit, the dialog calls the appropriate service method based on entity type, then closes with the created entity.

**Component structure**:
```
CreateEntityDialogComponent
├── Entity type selector (mat-radio-group)
├── Project fields (conditional)
├── Epic fields (conditional)
├── Task fields (conditional)
└── Subtask fields (conditional)
```

**Alternatives considered**:
- *MatStepper (step 1: type, step 2: form)*: Adds unnecessary navigation overhead for a simple type selection. Users would need two clicks instead of one. Rejected.
- *Separate form components per entity type*: Code duplication for shared fields (title, description, priority, status, deadline, tags). Rejected.
- *Full-page form (like current TaskFormComponent)*: Spec explicitly says "modal". Full page would break the flow of browsing a parent and adding a child. Rejected.

## 6. Parent Cascade-Fill Behavior

**Decision**: When creating a Task, selecting a parent Epic auto-fills the associated Project field (read-only). Cascade is one-directional and happens only during creation.

**Rationale**:
- FR-004: "When a user selects an Epic as the parent of a Task, the system MUST cascade-fill the associated Project field automatically."
- The cascade is implemented in the frontend: when the `epic` field value changes, look up the epic's `project` and set the project display field (read-only, informational — Task model doesn't have a direct project FK).
- The spec explicitly states cascade-fill is creation-time only, not retroactive.
- The backend does not store a direct project FK on Task — the project is always derived via `task.epic.project`. This avoids data duplication and consistency issues.

**Alternatives considered**:
- *Store project FK directly on Task*: Denormalization that could go stale if an epic is re-parented. Rejected.
- *Backend cascade on epic assignment*: Over-engineering — the frontend can derive the project from the epic. Rejected.

## 7. Project/Epic Status Transitions

**Decision**: Projects and Epics use the same status choices as Tasks but with unrestricted transitions for managers.

**Rationale**:
- Spec clarification: "Relaxed for Project/Epic — all transitions open to managers with no restrictions."
- Reuse existing `Status` choices (CREATED, IN_PROGRESS, WAITING, DONE, ARCHIVED) across all entity types.
- The `apply_status_change` service function needs a parameter to bypass transition validation for Project/Epic, or separate functions for Project/Epic status changes.
- Decision: Add an `unrestricted` boolean parameter to the status change service. When True, any transition is allowed (for Projects/Epics). When False, existing Task transition rules apply.

## 8. Re-parenting After Creation

**Decision**: Manager-only PATCH on the parent FK fields. Engineers cannot modify parent assignments.

**Rationale**:
- FR-018: "Only managers MAY change an entity's parent after creation."
- Implemented via serializer-level permission checks: the parent field is read-only in engineer serializers, writable in manager serializers.
- Re-parenting validation: the new parent must exist, belong to the same organization, and maintain hierarchy integrity (e.g., can't set a Task as its own parent, can't create cycles).

## 9. Navigation Sidebar & Routing

**Decision**: Add "Projects" as a new top-level nav item, visible to managers and engineers, positioned between Tasks and Kanban.

**Rationale**:
- The spec says "The Projects section is a new top-level navigation item, sibling to the existing Tasks, Kanban, Calendar, etc."
- New routes: `/projects` (list/tree), `/projects/:id` (detail), `/epics/:id` (detail).
- Epic detail is a separate route (not under `/projects/`) since epics can be standalone.
- The existing `/tasks/new` route is removed; creation is handled by the unified dialog.
- The `/tasks/:id/edit` route remains for full-page task editing (the dialog is for creation only).

## 10. Orphan Handling on Parent Deletion

**Decision**: Use `SET_NULL` on all parent FK fields. Child entities become unlinked.

**Rationale**:
- FR-014: "When a parent entity is deleted, its child entities MUST become unlinked (orphaned) rather than cascade-deleted."
- `on_delete=SET_NULL` on: `Epic.project`, `Task.epic`, `Task.parent_task`.
- The UI should handle orphaned entities gracefully — no parent link shown, entity remains functional.
