# Frontend — Angular 17 SPA

Angular Material UI, standalone components, JWT auth.

## Commands

```bash
npm start          # dev server (port 4200, proxies /api to backend)
npm test           # interactive Karma test runner
npm run test:ci    # headless Chrome, single run (CI)
```

## Testing

146 tests, ~99% coverage. Patterns:

- **Services**: `provideHttpClient()` + `provideHttpClientTesting()` + `HttpTestingController.verify()` in `afterEach`
- **Guards**: `TestBed.runInInjectionContext()` with mocked `AuthService`
- **Interceptors**: `provideHttpClient(withInterceptors([...]))` + `HttpTestingController`
- **Components**: `jasmine.createSpyObj` for services, `provideNoopAnimations()` for Material, `provideRouter([])` for routing
- **localStorage**: always clean up in `afterEach` to prevent cross-test contamination

When adding new code, add a `.spec.ts` next to it following these patterns.

## Structure

```
src/app/
  core/
    services/       # AuthService, TaskService, NotificationService, etc.
    guards/         # authGuard, managerGuard, engineerGuard, clientGuard
    interceptors/   # jwtInterceptor (token + 401 refresh), errorInterceptor
    components/     # LoginComponent, LayoutComponent (shell + nav)
  features/
    tasks/          # TaskList, TaskForm, KanbanBoard, TaskDetail
    clients/        # ClientList, ClientDetail
    calendar/       # CalendarView
    reports/        # ReportsView
    admin/          # UserManagement
    portal/         # ClientPortal
```

## Key conventions

- All components are standalone (no NgModules)
- Environment config in `src/environments/environment.ts` (`apiUrl`, `wsUrl`)
- Roles: `manager` (full access), `engineer` (tasks + kanban), `client` (portal only)
- Nav items filtered by role in `LayoutComponent`
