# WebSocket API

## Kanban Board — Real-time Updates

**URL:** `ws://<host>/ws/kanban/?token=<JWT_ACCESS_TOKEN>`

Real-time task updates for the Kanban board. Events are scoped per organization — users only receive updates for tasks within their organization.

### Authentication

Pass a valid JWT access token as a query parameter:

```
ws://localhost:8000/ws/kanban/?token=eyJhbGciOiJIUzI1NiIs...
```

**Error codes on rejection:**

| Code | Reason |
|------|--------|
| 4401 | Missing or invalid/expired token |
| 4403 | User has no organization |

### Connection Flow

1. Client opens WebSocket with `?token=<JWT>`
2. Server validates token and checks organization membership
3. On success, server sends `connection_established` message
4. Client receives real-time `task_*` events for their organization
5. Optionally, client can filter events by client ID

### Client → Server Messages

#### `subscribe_filter`

Filter incoming task events by client ID. Only tasks belonging to the specified client will be forwarded.

```json
{
  "type": "subscribe_filter",
  "payload": {
    "client_id": 1
  }
}
```

**Response:**

```json
{
  "type": "filter_applied",
  "payload": {
    "client_id": 1
  }
}
```

#### `remove_filter`

Remove the active client filter and receive all organization task events again.

```json
{
  "type": "remove_filter"
}
```

**Response:**

```json
{
  "type": "filter_removed"
}
```

#### `pong`

Heartbeat response. No server reply.

```json
{
  "type": "pong"
}
```

### Server → Client Messages

#### `connection_established`

Sent immediately after a successful connection.

```json
{
  "type": "connection_established",
  "user_id": 1,
  "role": "manager"
}
```

#### `task_updated`

A task was created, updated, or had its status changed.

```json
{
  "type": "task_updated",
  "payload": {
    "id": 42,
    "title": "Fix login bug",
    "status": "in_progress",
    "priority": "high",
    "client_id": 1,
    "assignees": [3, 5]
  }
}
```

#### `task_deleted`

A task was deleted.

```json
{
  "type": "task_deleted",
  "payload": {
    "id": 42
  }
}
```

> **Note:** The `type` field in task events is dynamic — it reflects the `event_type` set by the backend when broadcasting. Common values: `task_updated`, `task_deleted`.

### Role-Based Filtering

- **manager / engineer** — receive all task events within their organization (subject to optional client filter)
- **client** — only receive events for tasks belonging to their linked client, regardless of filters

### Example: JavaScript Client

```javascript
const token = "eyJhbGciOiJIUzI1NiIs...";
const ws = new WebSocket(`ws://localhost:8000/ws/kanban/?token=${token}`);

ws.onopen = () => {
  console.log("Connected");
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case "connection_established":
      console.log(`Connected as ${data.role}`);
      break;
    case "task_updated":
      console.log("Task updated:", data.payload);
      break;
    case "task_deleted":
      console.log("Task deleted:", data.payload.id);
      break;
    case "filter_applied":
      console.log("Filtering by client:", data.payload.client_id);
      break;
    case "filter_removed":
      console.log("Filter removed");
      break;
  }
};

// Optional: filter by client
ws.send(JSON.stringify({
  type: "subscribe_filter",
  payload: { client_id: 1 }
}));
```
