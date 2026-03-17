# Quickstart: Work Hierarchy Feature

## Prerequisites

- Docker Compose v2 running (`docker compose up -d`)
- Backend on `localhost:8000`, frontend on `localhost:4200`
- Test accounts seeded (admin@example.com = manager, engineer@example.com = engineer)

## Backend Setup

```bash
cd backend

# Create and apply migrations for new projects app + extended models
python manage.py makemigrations projects
python manage.py makemigrations tasks notifications audit
python manage.py migrate

# Verify new tables exist
python manage.py dbshell -c "\dt projects_*"
# Should show: projects_project, projects_epic, projects_project_tags, projects_epic_tags

# Verify task table has new columns
python manage.py dbshell -c "\d tasks_task" | grep -E "epic_id|parent_task_id"

# Run backend tests
python -m pytest tests/projects/ -v
python -m pytest tests/tasks/ -v  # includes subtask tests
```

## Frontend Setup

```bash
cd frontend

# Install any new dependencies (if added)
npm install

# Start dev server
npm start
# Navigate to http://localhost:4200
```

## Manual Testing Walkthrough

### 1. Create a full hierarchy (as manager)

1. Log in as `admin@example.com`
2. Click the "+" FAB button (bottom-right) → unified creation dialog opens
3. Select "Project" → fill title "Q2 Platform Upgrade", set priority, deadline → Save
4. Navigate to Projects section (sidebar) → verify project appears
5. Click the project → click "Add" from project card → select "Epic"
   - Parent Project should be auto-populated
   - Fill title "Auth Overhaul" → Save
6. Click the epic → click "Add" → select "Task"
   - Parent Epic auto-populated, Project cascade-filled (read-only)
   - Fill required fields (title, description, priority, deadline) → Save
7. Open the task → click "Add" → select "Subtask"
   - Parent Task auto-populated
   - Fill title, single assignee → Save
8. Navigate to Tasks view → verify subtask appears indented under parent task

### 2. Verify parent navigation

1. Open the subtask → click parent Task link → navigates to task detail
2. On task detail → click parent Epic link → navigates to epic detail
3. On epic detail → click parent Project link → navigates to project detail

### 3. Verify notifications

1. Create a task with an assignee (different from yourself)
2. Log in as that assignee → check notification bell → should show assignment notification
3. Create a project with an assignee → assignee should receive notification

### 4. Verify role restrictions

1. Log in as `engineer@example.com`
2. Open creation dialog → "Project" option should be disabled/hidden
3. Verify engineer can create Epic, Task, Subtask
4. Verify engineer cannot change parent assignments on existing entities

### 5. Verify tree view

1. Log in as manager → go to Projects section
2. Expand project → see epics
3. Expand epic → see tasks
4. Expand task → see subtasks
5. Click any entity name → navigates to detail

## Key API Endpoints

```bash
TOKEN=$(curl -s localhost:8000/api/auth/token/ \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"..."}' | jq -r .access)

# Projects
curl -s localhost:8000/api/projects/ -H "Authorization: Bearer $TOKEN" | jq
curl -s localhost:8000/api/projects/ -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Test Project"}' -X POST | jq

# Epics
curl -s localhost:8000/api/epics/ -H "Authorization: Bearer $TOKEN" | jq
curl -s "localhost:8000/api/epics/?standalone=true" -H "Authorization: Bearer $TOKEN" | jq

# Tasks with subtask support
curl -s "localhost:8000/api/tasks/?entity_type=subtask" -H "Authorization: Bearer $TOKEN" | jq
curl -s "localhost:8000/api/tasks/?parent_task=1" -H "Authorization: Bearer $TOKEN" | jq

# Create subtask
curl -s localhost:8000/api/tasks/ -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Fix login bug","description":"...","priority":"high","deadline":"2026-04-01T00:00:00Z","parent_task_id":1}' \
  -X POST | jq
```
