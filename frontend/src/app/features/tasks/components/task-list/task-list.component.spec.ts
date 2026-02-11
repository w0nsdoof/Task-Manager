import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TaskListComponent } from './task-list.component';
import { TaskService, PaginatedResponse, TaskListItem } from '../../../../core/services/task.service';
import { AuthService } from '../../../../core/services/auth.service';

describe('TaskListComponent', () => {
  let component: TaskListComponent;
  let fixture: ComponentFixture<TaskListComponent>;
  let taskService: jasmine.SpyObj<TaskService>;
  let authService: jasmine.SpyObj<AuthService>;

  const mockTask: TaskListItem = {
    id: 1, title: 'Test Task', status: 'created', priority: 'high',
    deadline: '2025-12-31', created_at: '', updated_at: '',
    client: { id: 1, name: 'Client A' }, assignees: [], tags: [],
    comments_count: 0, attachments_count: 0,
  };

  const mockResponse: PaginatedResponse<TaskListItem> = {
    count: 25, next: null, previous: null, results: [mockTask],
  };

  beforeEach(async () => {
    taskService = jasmine.createSpyObj('TaskService', ['list']);
    authService = jasmine.createSpyObj('AuthService', ['hasRole']);
    taskService.list.and.returnValue(of(mockResponse));

    await TestBed.configureTestingModule({
      imports: [TaskListComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        { provide: TaskService, useValue: taskService },
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();
  });

  function createComponent(isManager = false) {
    authService.hasRole.and.returnValue(isManager);
    fixture = TestBed.createComponent(TaskListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should create', () => {
    createComponent();
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should load tasks on init', () => {
      createComponent();
      expect(taskService.list).toHaveBeenCalledWith({ page: 1, page_size: 20 });
      expect(component.tasks.length).toBe(1);
      expect(component.totalCount).toBe(25);
    });

    it('should set isManager=true for manager role', () => {
      createComponent(true);
      expect(component.isManager).toBeTrue();
    });

    it('should set isManager=false for non-manager', () => {
      createComponent(false);
      expect(component.isManager).toBeFalse();
    });
  });

  describe('pagination', () => {
    it('should call loadTasks with updated page on page change', () => {
      createComponent();
      taskService.list.calls.reset();

      component.onPageChange({ pageIndex: 2, pageSize: 10, length: 25 });

      expect(component.currentPage).toBe(3);
      expect(component.pageSize).toBe(10);
      expect(taskService.list).toHaveBeenCalledWith({ page: 3, page_size: 10 });
    });
  });

  describe('displayed columns', () => {
    it('should have correct columns', () => {
      createComponent();
      expect(component.displayedColumns).toEqual([
        'title', 'status', 'priority', 'assignees', 'client', 'deadline',
      ]);
    });
  });
});
