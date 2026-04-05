import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule, MatTabChangeEvent } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { ProjectService } from '../../../../core/services/project.service';
import { ClientService, Client } from '../../../../core/services/client.service';
import { TagService, Tag } from '../../../../core/services/tag.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ProjectDetail, EpicListItem, ProjectUpdatePayload, ParentContext } from '../../../../core/models/hierarchy.models';
import { STATUS_TRANSLATION_KEYS } from '../../../../core/constants/task-status';
import { CreateEntityDialogComponent } from '../../../tasks/components/create-dialog/create-entity-dialog.component';
import { environment } from '../../../../../environments/environment';

interface UserOption {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

const ALL_STATUSES = ['created', 'in_progress', 'waiting', 'done', 'archived'];

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    CommonModule, RouterModule, ReactiveFormsModule, MatCardModule, MatChipsModule,
    MatButtonModule, MatIconModule, MatDividerModule, MatTabsModule,
    MatProgressBarModule, MatMenuModule, MatSnackBarModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDatepickerModule, MatNativeDateModule, TranslateModule,
  ],
  template: `
    <div *ngIf="project" class="project-detail">
      <!-- Header -->
      <div class="detail-header">
        <div class="header-left">
          <a routerLink="/projects" class="back-link">
            <mat-icon>arrow_back</mat-icon> {{ 'projects.title' | translate }}
          </a>
          <h2 class="project-title" *ngIf="!editMode">{{ project.title }}</h2>
        </div>
        <div class="header-right">
          <mat-chip [class]="'status-' + project.status"
                    [matMenuTriggerFor]="isManager ? statusMenu : null"
                    [style.cursor]="isManager ? 'pointer' : 'default'"
                    class="status-badge">
            {{ statusLabel(project.status) }}
            <mat-icon *ngIf="isManager" iconPositionEnd style="font-size:18px;width:18px;height:18px">arrow_drop_down</mat-icon>
          </mat-chip>
          <mat-menu #statusMenu="matMenu">
            <button mat-menu-item *ngFor="let s of getAvailableStatuses(project.status)" (click)="onChangeStatus(s)">
              {{ statusLabel(s) }}
            </button>
          </mat-menu>
          <button class="flat-btn-primary" *ngIf="isManager && !editMode" (click)="enterEditMode()">
            <mat-icon>edit</mat-icon> {{ 'common.edit' | translate }}
          </button>
          <button class="flat-btn-outline" *ngIf="editMode" (click)="cancelEdit()">
            {{ 'common.cancel' | translate }}
          </button>
          <button class="flat-btn-primary" *ngIf="editMode" (click)="saveEdit()" [disabled]="editForm.invalid || saving">
            {{ 'common.save' | translate }}
          </button>
        </div>
      </div>

      <!-- Edit form -->
      <div *ngIf="editMode" class="edit-section flat-card">
        <form [formGroup]="editForm">
          <div class="form-group">
            <label class="flat-input-label">{{ 'tasks.taskTitle' | translate }}</label>
            <input class="flat-input" formControlName="title" />
          </div>
          <div class="form-group">
            <label class="flat-input-label">{{ 'tasks.description' | translate }}</label>
            <textarea class="flat-input textarea" formControlName="description" rows="4"></textarea>
          </div>
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
          <div class="form-row">
            <div class="form-group">
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
            <div class="form-group">
              <label class="flat-input-label">{{ 'tasks.client' | translate }}</label>
              <mat-form-field appearance="outline" class="full-width">
                <mat-select formControlName="client_id">
                  <mat-option [value]="null">{{ 'common.none' | translate }}</mat-option>
                  <mat-option *ngFor="let c of clients" [value]="c.id">{{ c.name }}</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
          </div>
          <div class="form-group">
            <label class="flat-input-label">{{ 'tasks.tags' | translate }}</label>
            <mat-form-field appearance="outline" class="full-width">
              <mat-select formControlName="tag_ids" multiple>
                <mat-option *ngFor="let t of tags" [value]="t.id">{{ t.name }}</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
          <div class="form-group">
            <label class="flat-input-label">{{ 'projects.teamMembers' | translate }}</label>
            <mat-form-field appearance="outline" class="full-width">
              <mat-select formControlName="team_member_ids" multiple>
                <mat-option *ngFor="let u of users" [value]="u.id">
                  {{ u.first_name }} {{ u.last_name }}
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </form>
      </div>

      <!-- Read-only view -->
      <ng-container *ngIf="!editMode">
        <!-- Metadata row -->
        <div class="meta-row">
          <div class="meta-item">
            <mat-icon class="meta-icon">calendar_today</mat-icon>
            <div>
              <span class="meta-label">{{ 'tasks.createdAt' | translate }}</span>
              <span class="meta-value">{{ project.created_at | date:'mediumDate' }}</span>
            </div>
          </div>
          <div class="meta-item" *ngIf="project.priority">
            <mat-icon class="meta-icon">flag</mat-icon>
            <div>
              <span class="meta-label">{{ 'tasks.priority' | translate }}</span>
              <span class="meta-value">
                <mat-chip [class]="'priority-' + project.priority">{{ 'priorities.' + project.priority | translate }}</mat-chip>
              </span>
            </div>
          </div>
          <div class="meta-item" *ngIf="project.deadline">
            <mat-icon class="meta-icon">event</mat-icon>
            <div>
              <span class="meta-label">{{ 'tasks.deadline' | translate }}</span>
              <span class="meta-value">{{ project.deadline | date:'mediumDate' }}</span>
            </div>
          </div>
          <div class="meta-item" *ngIf="project.client">
            <mat-icon class="meta-icon">apartment</mat-icon>
            <div>
              <span class="meta-label">{{ 'tasks.client' | translate }}</span>
              <span class="meta-value">{{ project.client.name }}</span>
            </div>
          </div>
          <div class="meta-item">
            <mat-icon class="meta-icon">person</mat-icon>
            <div>
              <span class="meta-label">{{ 'tasks.createdBy' | translate }}</span>
              <span class="meta-value">{{ project.created_by?.first_name }} {{ project.created_by?.last_name }}</span>
            </div>
          </div>
          <div class="meta-item" *ngIf="project.assignee">
            <mat-icon class="meta-icon">assignment_ind</mat-icon>
            <div>
              <span class="meta-label">{{ 'projects.assignee' | translate }}</span>
              <span class="meta-value assignee-flex">
                <span class="assignee-pill">
                  <span class="mini-avatar">{{ project.assignee.first_name?.charAt(0) || '' }}</span>
                  {{ project.assignee.first_name }} {{ project.assignee.last_name }}
                </span>
              </span>
            </div>
          </div>
          <div class="meta-item" *ngIf="project.tags.length">
            <mat-icon class="meta-icon">label</mat-icon>
            <div>
              <span class="meta-label">{{ 'tasks.tags' | translate }}</span>
              <span class="meta-value">
                <mat-chip *ngFor="let t of project.tags" class="mini-tag">{{ t.name }}</mat-chip>
              </span>
            </div>
          </div>
          <div class="meta-item" *ngIf="project.team && project.team.length">
            <mat-icon class="meta-icon">group</mat-icon>
            <div>
              <span class="meta-label">{{ 'projects.team' | translate }}</span>
              <span class="meta-value assignee-flex">
                <span *ngFor="let m of project.team" class="assignee-pill">
                  <span class="mini-avatar">{{ m.first_name?.charAt(0) || '' }}</span>
                  {{ m.first_name }} {{ m.last_name }}
                </span>
              </span>
            </div>
          </div>
        </div>

        <!-- Description -->
        <div class="description-section flat-card" *ngIf="project.description">
          <h3>{{ 'tasks.description' | translate }}</h3>
          <p class="description-text">{{ project.description }}</p>
        </div>
      </ng-container>

      <!-- Tabs: Epics & History -->
      <mat-tab-group (selectedTabChange)="onTabChange($event)">
        <mat-tab [label]="translate.instant('projects.epics') + ' (' + epics.length + ')'">
          <div class="tab-content">
            <div class="tab-header">
              <button class="flat-btn-primary" *ngIf="isManager" (click)="openAddEpicDialog()">
                <mat-icon>add</mat-icon> {{ 'projects.addEpic' | translate }}
              </button>
            </div>
            <div *ngIf="epics.length; else noEpics" class="child-list">
              <div *ngFor="let epic of epics" class="child-item">
                <div class="child-main">
                  <a [routerLink]="['/epics', epic.id]" class="child-link">{{ epic.title }}</a>
                  <mat-chip [class]="'status-' + epic.status" class="child-status">
                    {{ statusLabel(epic.status) }}
                  </mat-chip>
                </div>
                <div class="child-meta">
                  <span *ngIf="epic.priority">
                    <mat-chip [class]="'priority-' + epic.priority" class="mini-chip">
                      {{ 'priorities.' + epic.priority | translate }}
                    </mat-chip>
                  </span>
                  <span *ngIf="epic.assignee" class="child-assignee">
                    {{ epic.assignee.first_name }} {{ epic.assignee.last_name }}
                  </span>
                  <span *ngIf="epic.deadline" class="child-deadline">
                    {{ epic.deadline | date:'mediumDate' }}
                  </span>
                  <span class="child-count">{{ epic.tasks_count }} {{ 'projects.tasksLabel' | translate }}</span>
                </div>
              </div>
            </div>
            <ng-template #noEpics>
              <p class="empty-message">{{ 'projects.noEpics' | translate }}</p>
            </ng-template>
          </div>
        </mat-tab>
        <mat-tab [label]="translate.instant('tasks.history')">
          <div class="tab-content">
            <mat-progress-bar *ngIf="historyLoading" mode="indeterminate"></mat-progress-bar>
            <div *ngIf="history.length; else noHistory" class="history-list">
              <div *ngFor="let h of history" class="history-item">
                <mat-icon class="history-icon">{{ getHistoryIcon(h.action) }}</mat-icon>
                <div class="history-info">
                  <span class="history-action">
                    {{ h.action | titlecase }}{{ h.field_name ? ': ' + h.field_name : '' }}
                  </span>
                  <span class="history-detail">
                    <span *ngIf="h.old_value || h.new_value">{{ h.old_value || translate.instant('tasks.empty') }} &rarr; {{ h.new_value || translate.instant('tasks.empty') }}</span>
                    &middot; {{ h.changed_by?.first_name }} {{ h.changed_by?.last_name }}
                    &middot; {{ h.timestamp | date:'medium' }}
                  </span>
                </div>
              </div>
            </div>
            <ng-template #noHistory>
              <p *ngIf="historyLoaded" class="empty-message">{{ 'tasks.noHistory' | translate }}</p>
            </ng-template>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .project-detail { max-width: 960px; }

    .detail-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 24px; gap: 16px;
    }
    .header-left { display: flex; flex-direction: column; gap: 4px; }
    .back-link {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 13px; color: var(--text-secondary, #6b7280);
      text-decoration: none; margin-bottom: 4px;
    }
    .back-link:hover { color: var(--primary-blue, #1a7cf4); }
    .project-title {
      font-size: 22px; font-weight: 700; margin: 0;
      color: var(--text-primary, #1a1a1a);
    }
    .header-right { display: flex; gap: 12px; align-items: center; flex-shrink: 0; }
    .status-badge { font-size: 13px; }

    .meta-row {
      display: flex; flex-wrap: wrap; gap: 20px;
      padding: 20px; background: #fff;
      border-radius: var(--border-radius-card, 12px);
      border: 1px solid var(--border-color, #e5e7eb);
      margin-bottom: 16px;
    }
    .meta-item { display: flex; gap: 8px; align-items: flex-start; }
    .meta-icon { color: #9ca3af; font-size: 20px; width: 20px; height: 20px; margin-top: 2px; }
    .meta-label { display: block; font-size: 12px; color: var(--text-secondary, #6b7280); }
    .meta-value { display: block; font-size: 14px; font-weight: 500; }
    .mini-tag { font-size: 11px; margin: 2px; }
    .assignee-flex { display: flex; flex-wrap: wrap; gap: 6px; }
    .assignee-pill {
      display: inline-flex; align-items: center; gap: 4px; font-size: 13px;
    }
    .mini-avatar {
      width: 22px; height: 22px; border-radius: 50%;
      background: var(--primary-blue, #1a7cf4); color: #fff;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 600;
    }

    .description-section { margin-bottom: 24px; }
    .description-section h3 { margin: 0 0 12px 0; font-size: 16px; font-weight: 600; }
    .description-text {
      white-space: pre-wrap; line-height: 1.7; color: var(--text-primary, #1a1a1a); margin: 0;
    }

    /* Edit form */
    .edit-section { margin-bottom: 24px; }
    .form-group { margin-bottom: 20px; }
    .textarea { resize: vertical; min-height: 80px; }
    .form-row { display: flex; gap: 16px; }
    .form-row .form-group { flex: 1; }
    .full-width { width: 100%; }

    /* Tab content */
    .tab-content { padding: 16px 0; }
    .tab-header { margin-bottom: 12px; }
    .empty-message { color: #9ca3af; padding: 16px 0; }

    /* Child list (epics) */
    .child-list { display: flex; flex-direction: column; gap: 8px; }
    .child-item {
      padding: 14px 16px; background: #fff;
      border: 1px solid var(--border-color, #e5e7eb);
      border-radius: 8px;
    }
    .child-main { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
    .child-link {
      font-weight: 500; color: var(--primary-blue, #1a7cf4);
      text-decoration: none; font-size: 14px;
    }
    .child-link:hover { text-decoration: underline; }
    .child-status { font-size: 11px; }
    .child-meta { display: flex; gap: 16px; align-items: center; font-size: 12px; color: var(--text-secondary, #6b7280); }
    .child-assignee, .child-deadline, .child-count { white-space: nowrap; }
    .mini-chip { font-size: 10px; min-height: 20px; padding: 1px 6px; }

    /* History */
    .history-list { display: flex; flex-direction: column; gap: 8px; }
    .history-item {
      display: flex; align-items: center; gap: 12px;
      padding: 12px; background: #fff;
      border: 1px solid var(--border-color, #e5e7eb);
      border-radius: 8px;
    }
    .history-icon { color: #9ca3af; }
    .history-info { flex: 1; }
    .history-action { display: block; font-weight: 500; font-size: 14px; }
    .history-detail { display: block; font-size: 12px; color: var(--text-secondary, #6b7280); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectDetailComponent implements OnInit, OnDestroy {
  project: ProjectDetail | null = null;
  isManager = false;
  editMode = false;
  saving = false;
  editForm!: FormGroup;

  // Epics
  epics: EpicListItem[] = [];

  // History (lazy)
  history: any[] = [];
  historyLoaded = false;
  historyLoading = false;

  // Dropdown data for edit mode
  users: UserOption[] = [];
  clients: Client[] = [];
  tags: Tag[] = [];

  private projectId!: number;
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private http: HttpClient,
    private projectService: ProjectService,
    private clientService: ClientService,
    private tagService: TagService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    public translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.isManager = this.authService.hasRole('manager');
    this.projectId = +this.route.snapshot.params['id'];

    this.editForm = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      priority: [null],
      deadline: [null],
      assignee_id: [null],
      client_id: [null],
      tag_ids: [[]],
      team_member_ids: [[]],
    });

    this.loadProject();
    this.loadEpics();
  }

  openAddEpicDialog(): void {
    if (!this.project) return;
    const parentContext: ParentContext = {
      parentType: 'project',
      parentId: this.project.id,
    };
    const dialogRef = this.dialog.open(CreateEntityDialogComponent, {
      width: '600px',
      data: parentContext,
    });
    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((result) => {
      if (result) {
        this.loadEpics();
      }
    });
  }

  loadProject(): void {
    this.projectService.getProject(this.projectId).pipe(takeUntil(this.destroy$)).subscribe((project) => {
      this.project = project;
      this.cdr.markForCheck();
    });
  }

  loadEpics(): void {
    this.projectService.getProjectEpics(this.projectId).pipe(takeUntil(this.destroy$)).subscribe((res) => {
      this.epics = res.results;
      this.cdr.markForCheck();
    });
  }

  statusLabel(status: string): string {
    return this.translate.instant(STATUS_TRANSLATION_KEYS[status] || status);
  }

  getAvailableStatuses(currentStatus: string): string[] {
    return ALL_STATUSES.filter(s => s !== currentStatus);
  }

  onChangeStatus(newStatus: string): void {
    if (!this.project) return;
    this.projectService.changeProjectStatus(this.project.id, newStatus).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.project!.status = newStatus;
        this.cdr.markForCheck();
      },
      error: (err) => {
        const msg = err.error?.detail || this.translate.instant('projects.failedChangeStatus');
        this.snackBar.open(msg, this.translate.instant('common.close'), { duration: 3000 });
      },
    });
  }

  enterEditMode(): void {
    if (!this.project) return;
    this.editForm.patchValue({
      title: this.project.title,
      description: this.project.description,
      priority: this.project.priority,
      deadline: this.project.deadline ? new Date(this.project.deadline) : null,
      assignee_id: this.project.assignee?.id || null,
      client_id: this.project.client?.id || null,
      tag_ids: this.project.tags.map(t => t.id),
      team_member_ids: this.project.team?.map(m => m.id) || [],
    });
    this.editMode = true;
    this.loadDropdownData();
    this.cdr.markForCheck();
  }

  cancelEdit(): void {
    this.editMode = false;
    this.cdr.markForCheck();
  }

  saveEdit(): void {
    if (!this.project || this.editForm.invalid || this.saving) return;
    this.saving = true;
    const val = this.editForm.value;
    const payload: ProjectUpdatePayload = {
      version: this.project.version,
      title: val.title,
      description: val.description,
      priority: val.priority,
      deadline: val.deadline ? new Date(val.deadline).toISOString().split('T')[0] : undefined,
      assignee_id: val.assignee_id,
      client_id: val.client_id,
      tag_ids: val.tag_ids,
      team_member_ids: val.team_member_ids,
    };
    this.projectService.updateProject(this.projectId, payload).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        this.project = updated;
        this.editMode = false;
        this.saving = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.saving = false;
        const msg = err.error?.detail || err.error?.version?.[0] || this.translate.instant('errors.unexpected');
        this.snackBar.open(msg, this.translate.instant('common.close'), { duration: 4000 });
        this.cdr.markForCheck();
      },
    });
  }

  onTabChange(event: MatTabChangeEvent): void {
    if (event.index === 1 && !this.historyLoaded) {
      this.loadHistory();
    }
  }

  getHistoryIcon(action: string): string {
    switch (action) {
      case 'created': return 'add_circle';
      case 'updated': return 'edit';
      case 'status_changed': return 'swap_horiz';
      case 'assigned': return 'person_add';
      default: return 'history';
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadHistory(): void {
    this.historyLoading = true;
    this.cdr.markForCheck();
    this.projectService.getProjectHistory(this.projectId).pipe(takeUntil(this.destroy$)).subscribe((res) => {
      this.history = res.results;
      this.historyLoaded = true;
      this.historyLoading = false;
      this.cdr.markForCheck();
    });
  }

  private loadDropdownData(): void {
    // Load users
    this.http.get<any>(`${environment.apiUrl}/users/`, { params: { is_active: 'true', page_size: '100' } })
      .pipe(takeUntil(this.destroy$)).subscribe((res) => {
        this.users = res.results;
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
  }
}
