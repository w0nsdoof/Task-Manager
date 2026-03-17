import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Inject,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatRadioModule } from '@angular/material/radio';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { TaskService, TaskCreatePayload } from '../../../../core/services/task.service';
import { ProjectService } from '../../../../core/services/project.service';
import { ClientService, Client } from '../../../../core/services/client.service';
import { TagService, Tag } from '../../../../core/services/tag.service';
import { AuthService } from '../../../../core/services/auth.service';
import {
  ParentContext,
  ProjectListItem,
  EpicListItem,
  ProjectCreatePayload,
  EpicCreatePayload,
} from '../../../../core/models/hierarchy.models';
import { environment } from '../../../../../environments/environment';

type EntityType = 'project' | 'epic' | 'task' | 'subtask';

interface UserOption {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

@Component({
  selector: 'app-create-entity-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatRadioModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    TranslateModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'hierarchy.createEntity' | translate }}</h2>
    <mat-dialog-content>
      <!-- Entity type selector -->
      <mat-radio-group
        [(ngModel)]="entityType"
        (ngModelChange)="onEntityTypeChange($event)"
        class="type-radio-group">
        <mat-radio-button value="project" [disabled]="!isManager">
          {{ 'hierarchy.project' | translate }}
        </mat-radio-button>
        <mat-radio-button value="epic">
          {{ 'hierarchy.epic' | translate }}
        </mat-radio-button>
        <mat-radio-button value="task">
          {{ 'hierarchy.task' | translate }}
        </mat-radio-button>
        <mat-radio-button value="subtask">
          {{ 'hierarchy.subtask' | translate }}
        </mat-radio-button>
      </mat-radio-group>

      <form [formGroup]="form" class="entity-form">
        <!-- Title (always shown) -->
        <div class="form-group">
          <label class="flat-input-label">{{ 'tasks.taskTitle' | translate }} *</label>
          <input class="flat-input" formControlName="title" />
        </div>

        <!-- Description (always shown) -->
        <div class="form-group">
          <label class="flat-input-label">{{ 'tasks.description' | translate }}</label>
          <textarea class="flat-input textarea" formControlName="description" rows="3"></textarea>
        </div>

        <!-- Priority + Deadline row -->
        <div class="form-row">
          <div class="form-group">
            <label class="flat-input-label">{{ 'tasks.priority' | translate }}</label>
            <mat-form-field appearance="outline" class="full-width">
              <mat-select formControlName="priority">
                <mat-option [value]="null">{{ 'common.none' | translate }}</mat-option>
                <mat-option value="low">{{ 'priorities.low' | translate }}</mat-option>
                <mat-option value="medium">{{ 'priorities.medium' | translate }}</mat-option>
                <mat-option value="high">{{ 'priorities.high' | translate }}</mat-option>
                <mat-option value="critical">{{ 'priorities.critical' | translate }}</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
          <div class="form-group">
            <label class="flat-input-label">{{ 'tasks.deadline' | translate }}</label>
            <mat-form-field appearance="outline" class="full-width">
              <input matInput [matDatepicker]="picker" formControlName="deadline" />
              <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
              <mat-datepicker #picker></mat-datepicker>
            </mat-form-field>
          </div>
        </div>

        <!-- Parent Project (for Epic) -->
        <div class="form-group" *ngIf="entityType === 'epic'">
          <label class="flat-input-label">{{ 'hierarchy.parentProject' | translate }}</label>
          <mat-form-field appearance="outline" class="full-width">
            <mat-select formControlName="project_id">
              <mat-option [value]="null">{{ 'common.none' | translate }}</mat-option>
              <mat-option *ngFor="let p of projects" [value]="p.id">{{ p.title }}</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Parent Epic (for Task) -->
        <div class="form-group" *ngIf="entityType === 'task'">
          <label class="flat-input-label">{{ 'hierarchy.parentEpic' | translate }}</label>
          <mat-form-field appearance="outline" class="full-width">
            <mat-select formControlName="epic_id" (selectionChange)="onEpicSelected($event.value)">
              <mat-option [value]="null">{{ 'common.none' | translate }}</mat-option>
              <mat-option *ngFor="let e of epics" [value]="e.id">{{ e.title }}</mat-option>
            </mat-select>
          </mat-form-field>
          <div *ngIf="cascadeProjectName" class="cascade-info">
            <mat-icon class="cascade-icon">folder</mat-icon>
            {{ 'hierarchy.cascadeProject' | translate }}: <strong>{{ cascadeProjectName }}</strong>
          </div>
        </div>

        <!-- Parent Task (for Subtask) -->
        <div class="form-group" *ngIf="entityType === 'subtask'">
          <label class="flat-input-label">{{ 'hierarchy.parentTask' | translate }} *</label>
          <mat-form-field appearance="outline" class="full-width">
            <mat-select formControlName="parent_task_id">
              <mat-option *ngFor="let t of parentTasks" [value]="t.id">{{ t.title }}</mat-option>
            </mat-select>
          </mat-form-field>
          <div *ngIf="cascadeEpicName || cascadeProjectName" class="cascade-info">
            <span *ngIf="cascadeProjectName">
              <mat-icon class="cascade-icon">folder</mat-icon>
              {{ 'hierarchy.project' | translate }}: <strong>{{ cascadeProjectName }}</strong>
            </span>
            <span *ngIf="cascadeEpicName" [style.margin-left]="cascadeProjectName ? '12px' : '0'">
              <mat-icon class="cascade-icon">auto_awesome</mat-icon>
              {{ 'hierarchy.epic' | translate }}: <strong>{{ cascadeEpicName }}</strong>
            </span>
          </div>
        </div>

        <!-- Assignee (manager-only single select for project/epic) -->
        <div class="form-group" *ngIf="(entityType === 'project' || entityType === 'epic') && isManager">
          <label class="flat-input-label">{{ 'projects.assignee' | translate }}</label>
          <mat-form-field appearance="outline" class="full-width">
            <mat-select formControlName="assignee_id">
              <mat-option [value]="null">{{ 'common.none' | translate }}</mat-option>
              <mat-option *ngFor="let u of users" [value]="u.id">
                {{ u.first_name }} {{ u.last_name }}
              </mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Assignees for task type: multi-select -->
        <div class="form-group" *ngIf="entityType === 'task' && isManager">
          <label class="flat-input-label">{{ 'tasks.assignees' | translate }}</label>
          <mat-form-field appearance="outline" class="full-width">
            <mat-select formControlName="assignee_ids" multiple>
              <mat-option *ngFor="let u of engineers" [value]="u.id">
                {{ u.first_name }} {{ u.last_name }}
              </mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Assignee for subtask: single select -->
        <div class="form-group" *ngIf="entityType === 'subtask'">
          <label class="flat-input-label">{{ 'projects.assignee' | translate }}</label>
          <mat-form-field appearance="outline" class="full-width">
            <mat-select formControlName="assignee_ids" multiple>
              <mat-option *ngFor="let u of engineers" [value]="u.id">
                {{ u.first_name }} {{ u.last_name }}
              </mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Client (manager-only, not for subtask) -->
        <div class="form-group" *ngIf="entityType !== 'subtask' && isManager">
          <label class="flat-input-label">{{ 'tasks.client' | translate }}</label>
          <mat-form-field appearance="outline" class="full-width">
            <mat-select formControlName="client_id">
              <mat-option [value]="null">{{ 'common.none' | translate }}</mat-option>
              <mat-option *ngFor="let c of clients" [value]="c.id">{{ c.name }}</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Tags (not for subtask) -->
        <div class="form-group" *ngIf="entityType !== 'subtask'">
          <label class="flat-input-label">{{ 'tasks.tags' | translate }}</label>
          <mat-form-field appearance="outline" class="full-width">
            <mat-select formControlName="tag_ids" multiple>
              <mat-option *ngFor="let t of tags" [value]="t.id">{{ t.name }}</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Error message -->
        <div *ngIf="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ 'common.cancel' | translate }}</button>
      <button mat-flat-button color="primary" (click)="onSubmit()" [disabled]="form.invalid || saving">
        {{ 'common.create' | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .type-radio-group {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .entity-form {
      min-width: 480px;
    }
    .form-group {
      margin-bottom: 16px;
    }
    .form-row {
      display: flex;
      gap: 16px;
    }
    .form-row .form-group {
      flex: 1;
    }
    .full-width {
      width: 100%;
    }
    .textarea {
      resize: vertical;
      min-height: 60px;
    }
    .cascade-info {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 8px 12px;
      background: #f8fafc;
      border: 1px solid var(--border-color, #e5e7eb);
      border-radius: 6px;
      font-size: 13px;
      color: var(--text-secondary, #6b7280);
      margin-top: 4px;
      flex-wrap: wrap;
    }
    .cascade-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #9ca3af;
    }
    .error-message {
      color: #d32f2f;
      font-size: 13px;
      padding: 8px 0;
    }
    @media (max-width: 600px) {
      .entity-form {
        min-width: unset;
      }
      .form-row {
        flex-direction: column;
        gap: 0;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateEntityDialogComponent implements OnInit, OnDestroy {
  entityType: EntityType = 'task';
  form!: FormGroup;
  isManager = false;
  saving = false;
  errorMessage = '';

  // Dropdown data
  users: UserOption[] = [];
  engineers: UserOption[] = [];
  clients: Client[] = [];
  tags: Tag[] = [];
  projects: ProjectListItem[] = [];
  epics: EpicListItem[] = [];
  parentTasks: { id: number; title: string }[] = [];

  // Cascade display
  cascadeProjectName = '';
  cascadeEpicName = '';

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private dialogRef: MatDialogRef<CreateEntityDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ParentContext | null,
    private taskService: TaskService,
    private projectService: ProjectService,
    private clientService: ClientService,
    private tagService: TagService,
    private authService: AuthService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.isManager = this.authService.hasRole('manager');

    this.form = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      priority: [null],
      deadline: [null],
      project_id: [null],
      epic_id: [null],
      parent_task_id: [null],
      assignee_id: [null],
      assignee_ids: [[]],
      client_id: [null],
      tag_ids: [[]],
    });

    this.loadDropdownData();
    this.applyParentContext();
  }

  onEntityTypeChange(type: EntityType): void {
    this.entityType = type;
    this.cascadeProjectName = '';
    this.cascadeEpicName = '';
    this.errorMessage = '';

    // Reset parent fields
    this.form.patchValue({
      project_id: null,
      epic_id: null,
      parent_task_id: null,
      assignee_id: null,
      assignee_ids: [],
      client_id: null,
    });

    // Set parent_task_id required for subtask
    if (type === 'subtask') {
      this.form.get('parent_task_id')!.setValidators(Validators.required);
    } else {
      this.form.get('parent_task_id')!.clearValidators();
    }
    this.form.get('parent_task_id')!.updateValueAndValidity();

    this.cdr.markForCheck();
  }

  onEpicSelected(epicId: number | null): void {
    this.cascadeProjectName = '';
    if (epicId) {
      const epic = this.epics.find(e => e.id === epicId);
      if (epic?.project) {
        this.cascadeProjectName = epic.project.title;
      }
    }
    this.cdr.markForCheck();
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving) return;
    this.saving = true;
    this.errorMessage = '';

    const val = this.form.value;

    switch (this.entityType) {
      case 'project':
        this.createProject(val);
        break;
      case 'epic':
        this.createEpic(val);
        break;
      case 'task':
        this.createTask(val);
        break;
      case 'subtask':
        this.createSubtask(val);
        break;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private createProject(val: any): void {
    const payload: ProjectCreatePayload = {
      title: val.title,
      description: val.description || undefined,
      priority: val.priority || undefined,
      deadline: val.deadline ? new Date(val.deadline).toISOString().split('T')[0] : undefined,
      assignee_id: val.assignee_id || undefined,
      client_id: val.client_id || undefined,
      tag_ids: val.tag_ids?.length ? val.tag_ids : undefined,
    };
    this.projectService.createProject(payload).pipe(takeUntil(this.destroy$)).subscribe({
      next: (result) => {
        this.saving = false;
        this.dialogRef.close(result);
      },
      error: (err) => {
        this.saving = false;
        this.errorMessage = err.error?.detail || err.error?.title?.[0] || this.translate.instant('errors.unexpected');
        this.cdr.markForCheck();
      },
    });
  }

  private createEpic(val: any): void {
    const payload: EpicCreatePayload = {
      title: val.title,
      description: val.description || undefined,
      priority: val.priority || undefined,
      deadline: val.deadline ? new Date(val.deadline).toISOString().split('T')[0] : undefined,
      project_id: val.project_id || undefined,
      assignee_id: val.assignee_id || undefined,
      client_id: val.client_id || undefined,
      tag_ids: val.tag_ids?.length ? val.tag_ids : undefined,
    };
    this.projectService.createEpic(payload).pipe(takeUntil(this.destroy$)).subscribe({
      next: (result) => {
        this.saving = false;
        this.dialogRef.close(result);
      },
      error: (err) => {
        this.saving = false;
        this.errorMessage = err.error?.detail || err.error?.title?.[0] || this.translate.instant('errors.unexpected');
        this.cdr.markForCheck();
      },
    });
  }

  private createTask(val: any): void {
    const payload: TaskCreatePayload = {
      title: val.title,
      description: val.description || '',
      priority: val.priority || undefined,
      deadline: val.deadline ? new Date(val.deadline).toISOString() : undefined,
      epic_id: val.epic_id || undefined,
      client_id: val.client_id || undefined,
      assignee_ids: val.assignee_ids?.length ? val.assignee_ids : undefined,
      tag_ids: val.tag_ids?.length ? val.tag_ids : undefined,
    };
    this.taskService.create(payload).pipe(takeUntil(this.destroy$)).subscribe({
      next: (result) => {
        this.saving = false;
        this.dialogRef.close(result);
      },
      error: (err) => {
        this.saving = false;
        this.errorMessage = err.error?.detail || err.error?.title?.[0] || this.translate.instant('errors.unexpected');
        this.cdr.markForCheck();
      },
    });
  }

  private createSubtask(val: any): void {
    const payload: TaskCreatePayload = {
      title: val.title,
      description: val.description || '',
      priority: val.priority || undefined,
      deadline: val.deadline ? new Date(val.deadline).toISOString() : undefined,
      parent_task_id: val.parent_task_id,
      assignee_ids: val.assignee_ids?.length ? val.assignee_ids : undefined,
    };
    this.taskService.create(payload).pipe(takeUntil(this.destroy$)).subscribe({
      next: (result) => {
        this.saving = false;
        this.dialogRef.close(result);
      },
      error: (err) => {
        this.saving = false;
        this.errorMessage = err.error?.detail || err.error?.title?.[0] || this.translate.instant('errors.unexpected');
        this.cdr.markForCheck();
      },
    });
  }

  private applyParentContext(): void {
    if (!this.data) return;

    switch (this.data.parentType) {
      case 'project':
        this.entityType = 'epic';
        this.form.patchValue({ project_id: this.data.parentId });
        break;
      case 'epic':
        this.entityType = 'task';
        this.form.patchValue({ epic_id: this.data.parentId });
        // Cascade-fill project display
        if (this.data.projectId) {
          this.loadCascadeProjectName(this.data.projectId);
        }
        break;
      case 'task':
        this.entityType = 'subtask';
        this.form.patchValue({ parent_task_id: this.data.parentId });
        this.form.get('parent_task_id')!.setValidators(Validators.required);
        this.form.get('parent_task_id')!.updateValueAndValidity();
        // Load cascade info for the parent task
        this.loadCascadeInfoForTask(this.data.parentId);
        break;
    }
  }

  private loadCascadeProjectName(projectId: number): void {
    this.projectService.getProject(projectId).pipe(takeUntil(this.destroy$)).subscribe((project) => {
      this.cascadeProjectName = project.title;
      this.cdr.markForCheck();
    });
  }

  private loadCascadeInfoForTask(taskId: number): void {
    this.taskService.get(taskId).pipe(takeUntil(this.destroy$)).subscribe((task) => {
      if (task.epic) {
        this.cascadeEpicName = task.epic.title;
        if (task.epic.project) {
          this.cascadeProjectName = task.epic.project.title;
        }
      }
      // Add parent task to the parentTasks list if not already there
      if (!this.parentTasks.find(t => t.id === task.id)) {
        this.parentTasks = [{ id: task.id, title: task.title }, ...this.parentTasks];
      }
      this.cdr.markForCheck();
    });
  }

  private loadDropdownData(): void {
    // Load users (for assignee)
    this.http.get<any>(`${environment.apiUrl}/users/`, { params: { is_active: 'true', page_size: '100' } })
      .pipe(takeUntil(this.destroy$)).subscribe((res) => {
        this.users = res.results;
        this.cdr.markForCheck();
      });

    // Load engineers (for task/subtask assignees)
    this.http.get<any>(`${environment.apiUrl}/users/`, { params: { role: 'engineer', is_active: 'true', page_size: '100' } })
      .pipe(takeUntil(this.destroy$)).subscribe((res) => {
        this.engineers = res.results;
        this.cdr.markForCheck();
      });

    // Load clients
    this.clientService.list({ page_size: 100 } as any).pipe(takeUntil(this.destroy$)).subscribe((res) => {
      this.clients = res.results;
      this.cdr.markForCheck();
    });

    // Load tags
    this.tagService.list().pipe(takeUntil(this.destroy$)).subscribe((res) => {
      this.tags = res.results;
      this.cdr.markForCheck();
    });

    // Load projects (for epic parent)
    this.projectService.listProjects({ page_size: 100 }).pipe(takeUntil(this.destroy$)).subscribe((res) => {
      this.projects = res.results;
      this.cdr.markForCheck();
    });

    // Load epics (for task parent)
    this.projectService.listEpics({ page_size: 100 }).pipe(takeUntil(this.destroy$)).subscribe((res) => {
      this.epics = res.results;
      // If we have parent context for epic, set cascade project name
      if (this.data?.parentType === 'epic') {
        const epic = res.results.find((e: EpicListItem) => e.id === this.data!.parentId);
        if (epic?.project) {
          this.cascadeProjectName = epic.project.title;
        }
      }
      this.cdr.markForCheck();
    });

    // Load tasks for subtask parent (only top-level tasks)
    this.taskService.list({ page_size: 100, entity_type: 'task' }).pipe(takeUntil(this.destroy$)).subscribe((res) => {
      this.parentTasks = res.results.map(t => ({ id: t.id, title: t.title }));
      this.cdr.markForCheck();
    });
  }
}
