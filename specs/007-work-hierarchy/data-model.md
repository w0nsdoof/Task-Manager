# Data Model: Work Hierarchy

**Feature**: 007-work-hierarchy | **Date**: 2026-03-17

## Entity Relationship Diagram

```
┌──────────┐       ┌──────────┐       ┌──────────┐       ┌──────────┐
│ Project  │1────*│  Epic    │1────*│  Task    │1────*│  Subtask │
│          │       │          │       │ (existing)│       │(Task row)│
└──────────┘       └──────────┘       └──────────┘       └──────────┘
     │                   │                  │                   │
     │ assignee(1)       │ assignee(1)      │ assignees(M2M)    │ assignees(M2M)*
     │ client(FK)        │ client(FK)       │ client(FK)        │   *max 1 enforced
     │ tags(M2M)         │ tags(M2M)        │ tags(M2M)         │ tags(M2M)
     │ organization(FK)  │ organization(FK) │ organization(FK)  │ organization(FK)
     │ created_by(FK)    │ created_by(FK)   │ created_by(FK)    │ created_by(FK)
     └──────────────────┘──────────────────┘───────────────────┘
```

Note: "Subtask" is a Task row with `parent_task` FK set (no separate table).

## New Model: Project

**App**: `apps.projects` | **Table**: `projects_project`

| Field        | Type                  | Constraints                        | Index |
|--------------|-----------------------|------------------------------------|-------|
| id           | BigAutoField          | PK                                 | PK    |
| title        | CharField(255)        | required                           |       |
| description  | TextField             | blank=True, default=""             |       |
| priority     | CharField(20)         | choices=Priority, blank=True, null=True | Y |
| status       | CharField(20)         | choices=Status, default=CREATED    | Y     |
| deadline     | DateTimeField         | null=True, blank=True              | Y     |
| assignee     | FK(User)              | null=True, blank=True, SET_NULL    | Y     |
| client       | FK(Client)            | null=True, blank=True, SET_NULL    | Y     |
| tags         | M2M(Tag)              | blank=True                         |       |
| organization | FK(Organization)      | CASCADE                            | Y     |
| created_by   | FK(User)              | PROTECT                            | Y     |
| version      | PositiveIntegerField  | default=1                          |       |
| created_at   | DateTimeField         | auto_now_add=True                  | Y     |
| updated_at   | DateTimeField         | auto_now=True                      |       |

**Composite indexes**: `(organization, status)`, `(organization, created_at)`

**Status choices** (shared across all entity types):
- `created` (default)
- `in_progress`
- `waiting`
- `done`
- `archived`

**Priority choices** (shared):
- `low`
- `medium`
- `high`
- `critical`

**Relationships**:
- `Project.epics` → reverse FK from Epic
- `Project.assignee` → single User (owner)
- `Project.created_by` → User who created
- `Project.organization` → multi-tenancy discriminator

**Status transitions**: Unrestricted for managers (any → any). Engineers MUST NOT change project status (FR-017).

**Deletion**: Manager-only. Child epics become orphaned via SET_NULL (FR-014/FR-020).

## New Model: Epic

**App**: `apps.projects` | **Table**: `projects_epic`

| Field        | Type                  | Constraints                        | Index |
|--------------|-----------------------|------------------------------------|-------|
| id           | BigAutoField          | PK                                 | PK    |
| title        | CharField(255)        | required                           |       |
| description  | TextField             | blank=True, default=""             |       |
| priority     | CharField(20)         | choices=Priority, blank=True, null=True | Y |
| status       | CharField(20)         | choices=Status, default=CREATED    | Y     |
| deadline     | DateTimeField         | null=True, blank=True              | Y     |
| project      | FK(Project)           | null=True, blank=True, SET_NULL    | Y     |
| assignee     | FK(User)              | null=True, blank=True, SET_NULL    | Y     |
| client       | FK(Client)            | null=True, blank=True, SET_NULL    | Y     |
| tags         | M2M(Tag)              | blank=True                         |       |
| organization | FK(Organization)      | CASCADE                            | Y     |
| created_by   | FK(User)              | PROTECT                            | Y     |
| version      | PositiveIntegerField  | default=1                          |       |
| created_at   | DateTimeField         | auto_now_add=True                  | Y     |
| updated_at   | DateTimeField         | auto_now=True                      |       |

**Composite indexes**: `(organization, status)`, `(organization, project)`, `(organization, created_at)`

**Relationships**:
- `Epic.project` → optional parent Project (SET_NULL on delete → orphaned epic)
- `Epic.tasks` → reverse FK from Task
- `Epic.assignee` → single User (owner)
- `Epic.created_by` → User who created

**Status transitions**: Unrestricted for managers (any → any). Engineers MUST NOT change epic status (FR-017).

**Deletion**: Manager-only. Child tasks become orphaned via SET_NULL (FR-014/FR-020).

## Extended Model: Task

**App**: `apps.tasks` (existing) | **Table**: `tasks_task`

### New fields added to existing Task model:

| Field        | Type             | Constraints                        | Index |
|--------------|------------------|------------------------------------|-------|
| epic         | FK(Epic)         | null=True, blank=True, SET_NULL    | Y     |
| parent_task  | FK('self')       | null=True, blank=True, SET_NULL    | Y     |

### New property (not a column):

```python
@property
def entity_type(self) -> str:
    """Returns 'subtask' if this task has a parent, otherwise 'task'."""
    return 'subtask' if self.parent_task_id else 'task'
```

**New composite indexes**: `(organization, epic)`, `(organization, parent_task)`

**Validation rules**:
- If `parent_task` is set (subtask): must belong to same organization; parent must not itself be a subtask (no nesting beyond 1 level).
- If `epic` is set: must belong to same organization.
- Subtask constraint: when `parent_task` is set, M2M `assignees` is limited to 0 or 1 (enforced in serializer).
- Subtask constraint: `client` is ignored/null for subtasks (enforced in serializer).

**Status transitions**:
- Tasks (parent_task is null): Existing transition rules preserved.
- Subtasks (parent_task is set): Same transition rules as tasks.

**Reverse relationships**:
- `Task.subtasks` → reverse FK from self (`related_name='subtasks'`)
- `Task.epic` → FK to Epic

## Extended Model: Notification

**App**: `apps.notifications` (existing) | **Table**: `notifications_notification`

### New fields:

| Field   | Type         | Constraints                     | Index |
|---------|--------------|---------------------------------|-------|
| project | FK(Project)  | null=True, blank=True, CASCADE  | Y     |
| epic    | FK(Epic)     | null=True, blank=True, CASCADE  | Y     |

### New event types:

| Event Type          | Entity  | Trigger                    |
|---------------------|---------|----------------------------|
| project_assigned    | Project | Assignee set on creation   |
| project_unassigned  | Project | Assignee removed           |
| epic_assigned       | Epic    | Assignee set on creation   |
| epic_unassigned     | Epic    | Assignee removed           |

Existing event types (`task_assigned`, `task_unassigned`, `status_changed`, etc.) remain unchanged and cover both tasks and subtasks.

## Extended Model: AuditLogEntry

**App**: `apps.audit` (existing) | **Table**: `audit_auditlogentry`

### New fields:

| Field   | Type         | Constraints                     | Index |
|---------|--------------|---------------------------------|-------|
| project | FK(Project)  | null=True, blank=True, CASCADE  | Y     |
| epic    | FK(Epic)     | null=True, blank=True, CASCADE  | Y     |

All existing audit actions (STATUS_CHANGE, FIELD_UPDATE, ASSIGNMENT_CHANGE, etc.) apply to Project and Epic entities as well.

## Migration Plan

1. **Migration 1** (`projects/0001_initial`): Create Project and Epic tables with all fields, indexes, and M2M through tables.
2. **Migration 2** (`tasks/NNNN_add_hierarchy_fields`): Add `epic` FK and `parent_task` FK to Task. Both nullable, no data migration needed.
3. **Migration 3** (`notifications/NNNN_add_hierarchy_fks`): Add `project` FK and `epic` FK to Notification. Add new event type choices.
4. **Migration 4** (`audit/NNNN_add_hierarchy_fks`): Add `project` FK and `epic` FK to AuditLogEntry.

All migrations are additive (new nullable columns/tables only) — fully backward-compatible with existing data.
