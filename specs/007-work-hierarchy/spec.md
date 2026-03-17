# Feature Specification: Work Hierarchy (Project / Epic / Task / Subtask)

**Feature Branch**: `007-work-hierarchy`
**Created**: 2026-03-17
**Status**: Draft
**Input**: User description: "Introduce a full work hierarchy — Project, Epic, Task, Subtask — with a unified creation modal, a new Projects section, parent navigation links, cascading parent auto-fill, auto-set Initiator, creation notifications, and per-type field definitions."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and manage Projects and Epics (Priority: P1)

A manager wants to organize work into Projects and Epics so that related tasks are grouped under a clear hierarchy. From the main navigation, the manager opens the new "Projects" section, clicks the "Add" button, selects "Project" as the entity type, fills in the project name, description, priority, deadline, and client, then saves. The project appears in the Projects list. The manager then opens the project card, clicks "Add" from within the project context, selects "Epic", and sees the parent Project auto-populated. They fill in the epic details and save. The epic appears nested under the project in the tree view.

**Why this priority**: Without Projects and Epics, the hierarchy has no top-level containers. This is the foundational capability upon which all other stories depend.

**Independent Test**: Can be fully tested by creating a Project, then creating an Epic within it, and verifying both appear in the Projects section with correct parent-child relationship.

**Acceptance Scenarios**:

1. **Given** a manager is in the Projects section, **When** they click "Add" and select "Project", **Then** a creation form for Project is shown with Project-specific fields.
2. **Given** a manager is viewing a Project card, **When** they click "Add" from within that card and select "Epic", **Then** the parent Project field is auto-populated with the current project.
3. **Given** a manager creates an Epic linked to a Project, **When** they view the Projects section, **Then** the Epic appears nested under its parent Project in the tree view.
4. **Given** a manager creates a standalone Epic (no Project parent), **When** they view the Projects section, **Then** the Epic appears as a top-level item in the tree.

---

### User Story 2 - Create Tasks and Subtasks within the hierarchy (Priority: P1)

An engineer wants to break down an Epic into Tasks and further into Subtasks. From within an Epic card, the engineer clicks "Add", selects "Task", and the parent Epic is auto-filled along with the associated Project. They fill in the task details and save. Later, from within a Task card, they click "Add", select "Subtask", the parent Task is auto-filled, and they save the subtask. Both the Task and Subtask appear in the existing Tasks view.

**Why this priority**: Tasks and Subtasks are the day-to-day work items. Linking them into the hierarchy is core to the feature's value.

**Independent Test**: Can be fully tested by creating a Task under an Epic, then a Subtask under that Task, and verifying both appear in the Tasks view with correct parent references.

**Acceptance Scenarios**:

1. **Given** an engineer is viewing an Epic card, **When** they click "Add" and select "Task", **Then** the parent Epic field is auto-populated and the associated Project field is cascade-filled.
2. **Given** an engineer is viewing a Task card, **When** they click "Add" and select "Subtask", **Then** the parent Task field is auto-populated.
3. **Given** a Subtask is created, **When** it appears in the Tasks view, **Then** it shows a clickable link to its parent Task.
4. **Given** a user attempts to create a Subtask without a parent Task, **Then** the system prevents submission and shows a validation error.

---

### User Story 3 - Unified "Add" button with entity type selection (Priority: P1)

A user (manager or engineer) wants to quickly create any entity type from a single entry point. They click the "Add" button, a modal opens, and the first step is selecting the entity type (Project, Epic, Task, or Subtask). After selection, the form dynamically shows fields relevant to that entity type. Required fields are clearly marked. The user fills in the form and submits.

**Why this priority**: The unified creation flow is the primary interaction pattern — it determines usability for all entity types.

**Independent Test**: Can be fully tested by opening the "Add" modal, cycling through each entity type, verifying correct fields appear, and submitting one entity of each type.

**Acceptance Scenarios**:

1. **Given** a user clicks the "Add" button from any page, **When** the modal opens, **Then** the first step presents four entity type options: Project, Epic, Task, Subtask.
2. **Given** a user selects "Task" as the entity type, **When** the form renders, **Then** only Task-relevant fields are shown (see Field Definitions below).
3. **Given** a user selects "Subtask", **When** the form renders, **Then** the parent Task field is marked as required.
4. **Given** an engineer opens the "Add" modal, **When** they select "Project", **Then** the option is unavailable because Project creation is restricted to managers.

---

### User Story 4 - Navigate parent links from entity cards (Priority: P2)

A user viewing a Task card wants to quickly navigate up the hierarchy to see the broader context. The Task card shows a clickable breadcrumb-style link to its parent Epic (if linked). Clicking it navigates to the Epic card, which in turn shows a link to its parent Project. Similarly, a Subtask card links to its parent Task.

**Why this priority**: Parent navigation provides context and improves discoverability of the hierarchy, but the system functions without it.

**Independent Test**: Can be fully tested by opening a Subtask card and clicking through parent links: Subtask → Task → Epic → Project, verifying each navigation works.

**Acceptance Scenarios**:

1. **Given** a Task is linked to an Epic, **When** a user views the Task card, **Then** a clickable link to the parent Epic is displayed.
2. **Given** an Epic is linked to a Project, **When** a user views the Epic card, **Then** a clickable link to the parent Project is displayed.
3. **Given** a Subtask, **When** a user views the Subtask card, **Then** a clickable link to the parent Task is always displayed (since parent Task is mandatory).
4. **Given** a Task with no parent Epic, **When** a user views the Task card, **Then** no parent link is shown (graceful absence, not an error).

---

### User Story 5 - Browse Projects section with full tree view (Priority: P2)

A manager wants to see the complete work breakdown from Project down to Subtask. They open the "Projects" section and see a list of all Projects and standalone Epics. They expand a Project to reveal its Epics, expand an Epic to see its Tasks, and expand a Task to see its Subtasks. Each level in the tree is clickable to open the entity's detail card.

**Why this priority**: The tree view provides the high-level overview managers need, but individual entities remain accessible through existing views.

**Independent Test**: Can be fully tested by creating a full hierarchy (Project → Epic → Task → Subtask) and verifying the tree expands correctly at each level.

**Acceptance Scenarios**:

1. **Given** a Project exists with nested Epics, Tasks, and Subtasks, **When** a manager views the Projects section, **Then** the tree is expandable at each level.
2. **Given** an Epic exists without a parent Project, **When** viewing the Projects section, **Then** the Epic appears as a top-level item alongside Projects.
3. **Given** a user clicks an entity name in the tree, **Then** they are navigated to that entity's detail card.

---

### User Story 6 - Notifications on entity creation (Priority: P3)

When any entity (Project, Epic, Task, or Subtask) is created, relevant users receive a notification. For Tasks and Subtasks, assignees are notified (consistent with the existing behavior). For Projects and Epics, the assignee (if set) is notified. The Initiator (creator) does not receive a self-notification.

**Why this priority**: Notifications are important for team awareness but are an enhancement layer on top of the core hierarchy.

**Independent Test**: Can be fully tested by creating each entity type with an assignee and verifying the assignee receives a notification while the creator does not.

**Acceptance Scenarios**:

1. **Given** a manager creates a Task with assignees, **When** creation succeeds, **Then** each assignee receives a notification (existing behavior preserved).
2. **Given** a manager creates a Project with an assignee, **When** creation succeeds, **Then** the assignee receives a notification.
3. **Given** a user creates any entity, **When** they are also the assignee, **Then** they do not receive a self-notification.

---

### Edge Cases

- What happens when a parent entity is deleted? Child entities become unlinked (orphaned) rather than cascade-deleted, preserving work history.
- What happens when a user tries to create a circular reference? The hierarchy is strictly linear (Project → Epic → Task → Subtask), so circular references are structurally impossible.
- What happens when a user creates a Subtask from the standalone "Add" button without parent context? The parent Task field is shown as required and the user must select one manually.
- What happens when a parent entity's status changes to "Archived"? Child entities remain in their current status; archiving does not cascade.
- What happens when an engineer tries to create a Project? The system restricts Project creation to managers only. Engineers can create Epics, Tasks, and Subtasks.
- What happens when the selected parent entity is deleted between opening the form and submitting? The system validates the parent reference on submission and shows an error if the parent no longer exists.

## Clarifications

### Session 2026-03-17

- Q: How should Subtasks appear in the Tasks view alongside Tasks? → A: Inline indented — Subtasks appear indented beneath their parent Task with a visual type indicator.
- Q: Do the same status transition rules apply to all entity types? → A: Relaxed for Project/Epic — all transitions open to managers with no restrictions. Task/Subtask keep current transition rules (e.g., Done → Archived is manager-only).
- Q: Can entities be re-parented after creation? → A: Yes, but only managers can move entities between parents after creation. Engineers cannot change parent assignments.
- Q: Should the field be called "Name" or "Title" across entity types? → A: Use "title" uniformly across all four entity types. Task keeps its existing "title" field; Project, Epic, and Subtask also use "title".
- Q: Who can edit Projects, Epics, and Subtasks after creation? → A: Mirror existing Task rules — managers can edit any entity; engineers can edit only entities assigned to them; clients remain read-only.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support four entity types in a strict hierarchy: Project → Epic → Task → Subtask.
- **FR-002**: System MUST provide a unified "Add" modal accessible from any page that allows the user to select an entity type before showing the corresponding creation form.
- **FR-003**: When creating a child entity from within a parent's card, the system MUST auto-populate the parent reference field.
- **FR-004**: When a user selects an Epic as the parent of a Task, the system MUST cascade-fill the associated Project field automatically (if the Epic has a parent Project).
- **FR-005**: A Subtask MUST always have a parent Task (mandatory relationship). The system MUST prevent creation of a Subtask without a parent Task.
- **FR-006**: An Epic MAY optionally be linked to a parent Project. A Task MAY optionally be linked to a parent Epic.
- **FR-007**: The "Initiator" field on Tasks and Subtasks MUST be automatically set to the currently logged-in user upon creation, with no manual input.
- **FR-008**: The system MUST trigger notifications to relevant users (assignees) upon creation of any of the four entity types.
- **FR-009**: The system MUST NOT send a creation notification to the creator if they are also the assignee.
- **FR-010**: Tasks and Subtasks MUST appear in the existing "Tasks" view. Subtasks MUST be displayed inline, visually indented beneath their parent Task, with a type indicator distinguishing them from Tasks.
- **FR-011**: The system MUST introduce a new "Projects" section that displays Projects and standalone Epics, and allows users to browse the full hierarchy tree: Project → Epic → Task → Subtask.
- **FR-012**: Every entity card MUST display clickable links to its parent entity. A Task links to its Epic, a Subtask links to its Task, an Epic links to its Project. If no parent is set, no link is shown.
- **FR-013**: Entity type creation MUST respect role-based access: managers can create all four types; engineers can create Epics, Tasks, and Subtasks; clients have read-only access.
- **FR-014**: When a parent entity is deleted, its child entities MUST become unlinked (orphaned) rather than cascade-deleted.
- **FR-015**: Each entity type MUST use a specific subset of shared fields as defined in the Field Definitions section.
- **FR-016**: The system MUST validate that the selected parent entity exists at the time of form submission.
- **FR-017**: Status transitions for Projects and Epics MUST be unrestricted for managers (any status to any status). Engineers MUST NOT change status on Projects or Epics. Tasks and Subtasks MUST retain the existing transition rules (e.g., Done → Archived is manager-only; engineers can perform all other transitions on their assigned items).
- **FR-018**: Only managers MAY change an entity's parent after creation (re-parenting). Engineers MUST NOT be able to modify parent assignments on any entity.
- **FR-019**: Edit permissions MUST mirror existing Task rules across all entity types: managers can edit any entity; engineers can edit only entities assigned to them; clients have read-only access. Exception: status transitions on Projects and Epics are manager-only (see FR-017).
- **FR-020**: The system MUST provide a delete action for Projects and Epics (manager-only). Deletion MUST follow the orphaning behavior defined in FR-014.

### Field Definitions

**Project**:

| Field       | Required / Optional         |
|-------------|-----------------------------|
| Title       | Required                    |
| Description | Optional                    |
| Priority    | Optional                    |
| Deadline    | Optional                    |
| Status      | Required (default: Created) |
| Assignee    | Optional (single owner)     |
| Client      | Optional                    |
| Tags        | Optional                    |

**Epic**:

| Field          | Required / Optional         |
|----------------|-----------------------------|
| Title          | Required                    |
| Description    | Optional                    |
| Priority       | Optional                    |
| Deadline       | Optional                    |
| Status         | Required (default: Created) |
| Parent Project | Optional                    |
| Assignee       | Optional (single owner)     |
| Client         | Optional                    |
| Tags           | Optional                    |

**Task** (extends existing Task entity):

| Field       | Required / Optional              |
|-------------|----------------------------------|
| Title       | Required                         |
| Description | Required                         |
| Priority    | Required                         |
| Deadline    | Required                         |
| Status      | Required (default: Created)      |
| Parent Epic | Optional                         |
| Assignees   | Optional (multiple, managers only)|
| Initiator   | Auto-set (logged-in user)        |
| Client      | Optional (managers only)         |
| Tags        | Optional                         |

**Subtask**:

| Field       | Required / Optional         |
|-------------|-----------------------------|
| Title       | Required                    |
| Description | Optional                    |
| Priority    | Optional                    |
| Deadline    | Optional                    |
| Status      | Required (default: Created) |
| Parent Task | Required (mandatory)        |
| Assignee    | Optional (single; reuses Task M2M assignees, max 1 enforced in validation) |
| Initiator   | Auto-set (logged-in user)   |
| Tags        | Optional                    |

### Key Entities

- **Project**: Top-level container for organizing related Epics. Has a title, optional description, deadline, priority, single assignee (owner), client association, and tags. Contains zero or more Epics.
- **Epic**: Groups related Tasks under an optional Project. Has a title, optional description, deadline, priority, single assignee, optional client, and tags. Contains zero or more Tasks.
- **Task**: The existing work item, now optionally linked to a parent Epic. Retains all current fields (title, description, priority, deadline, status, multiple assignees, client, tags, initiator). Contains zero or more Subtasks.
- **Subtask**: A granular work item that MUST belong to a parent Task. Has a title, optional description, priority, deadline, single assignee, auto-set initiator, and tags.

### Assumptions

- The existing Task entity and its current behavior are preserved. The hierarchy extends Task by adding an optional parent Epic link; no existing Task fields or workflows are removed.
- Status values (Created, In Progress, Waiting, Done, Archived) are shared across all four entity types.
- Priority values (Critical, High, Medium, Low) are shared across all four entity types.
- The "Initiator" auto-set behavior applies only to Tasks and Subtasks, not to Projects and Epics (which have an optional "Assignee/Owner" instead).
- The unified "Add" button replaces or augments the existing "New Task" button rather than coexisting alongside it.
- The Projects section is a new top-level navigation item, sibling to the existing Tasks, Kanban, Calendar, etc.
- Cascade-fill of the Project field when selecting an Epic applies only during creation, not retroactively if an Epic is later moved to a different Project.
- Optimistic locking (version field) will be extended to all new entity types to maintain consistency with existing Task behavior.
- Audit logging for all new entity types follows the same pattern as existing Task audit logs.

### Out of Scope

- **AI-assisted features**: Auto-generating Epic descriptions, suggesting task breakdowns, and recommending assignees are planned for a future iteration. This spec acknowledges them as a placeholder but does not define requirements for them.
- **Drag-and-drop reordering** of entities within the hierarchy tree.
- **Bulk operations** (e.g., moving multiple Tasks to a different Epic at once).
- **Cross-project dependencies** or linking entities across different Projects.
- **Kanban board changes** to support the new entity types (Kanban remains Task-only for now).
- **Calendar view changes** to support Projects and Epics.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create all four entity types (Project, Epic, Task, Subtask) from a single "Add" entry point in under 60 seconds each.
- **SC-002**: A user can navigate from any Subtask to the top-level Project via parent links in 3 or fewer clicks.
- **SC-003**: The Projects section displays the full hierarchy tree (Project → Epic → Task → Subtask) accurately for 100% of linked entities.
- **SC-004**: Existing Task creation and management workflows continue to function identically (zero regression in current task-related features).
- **SC-005**: Notifications are delivered to all relevant assignees within 5 seconds of entity creation for 100% of newly created entities.
- **SC-006**: 90% of test users can create a full hierarchy (Project → Epic → Task → Subtask) without assistance on their first attempt.
- **SC-007**: Parent auto-population and cascade-fill work correctly in 100% of parent-context creation flows.
