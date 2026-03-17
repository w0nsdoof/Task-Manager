import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FlatTreeControl } from '@angular/cdk/tree';
import { MatTreeModule, MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material/tree';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { ProjectService, ProjectFilters, EpicFilters } from '../../../../core/services/project.service';
import { TaskService } from '../../../../core/services/task.service';
import { AuthService } from '../../../../core/services/auth.service';
import { STATUS_TRANSLATION_KEYS } from '../../../../core/constants/task-status';
import { SearchBarComponent } from '../../../../shared/components/search-bar/search-bar.component';
import { CreateEntityDialogComponent } from '../../../tasks/components/create-dialog/create-entity-dialog.component';

interface HierarchyNode {
  id: number;
  title: string;
  entityType: 'project' | 'epic' | 'task' | 'subtask';
  status: string;
  priority: string | null;
  childrenCount: number;
  children?: HierarchyNode[];
  isLoading?: boolean;
}

interface FlatNode {
  id: number;
  title: string;
  entityType: 'project' | 'epic' | 'task' | 'subtask';
  status: string;
  priority: string | null;
  level: number;
  expandable: boolean;
  isLoading: boolean;
}

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [
    CommonModule, RouterModule, MatTreeModule, MatButtonModule,
    MatIconModule, MatChipsModule, MatProgressSpinnerModule,
    MatSnackBarModule, MatDialogModule, SearchBarComponent, TranslateModule,
  ],
  template: `
    <div class="page-header">
      <h2>{{ 'projects.title' | translate }}</h2>
      <div class="header-right">
        <button class="flat-btn-primary" *ngIf="isManager" (click)="openCreateDialog()">
          <mat-icon>add</mat-icon> {{ 'projects.add' | translate }}
        </button>
      </div>
    </div>

    <!-- Status tabs -->
    <div class="status-tabs">
      <button class="status-tab" [class.active]="!statusFilter" (click)="onStatusFilter(undefined)">
        {{ 'common.all' | translate }}
      </button>
      <button class="status-tab" [class.active]="statusFilter === 'created'" (click)="onStatusFilter('created')">
        {{ 'statuses.created' | translate }}
      </button>
      <button class="status-tab" [class.active]="statusFilter === 'in_progress'" (click)="onStatusFilter('in_progress')">
        {{ 'statuses.in_progress' | translate }}
      </button>
      <button class="status-tab" [class.active]="statusFilter === 'waiting'" (click)="onStatusFilter('waiting')">
        {{ 'statuses.waiting' | translate }}
      </button>
      <button class="status-tab" [class.active]="statusFilter === 'done'" (click)="onStatusFilter('done')">
        {{ 'statuses.done' | translate }}
      </button>
    </div>

    <app-search-bar [placeholder]="'projects.searchProjects' | translate" (search)="onSearch($event)"></app-search-bar>

    <!-- Loading state -->
    <div *ngIf="!loaded" class="loading-state">
      <mat-spinner diameter="40"></mat-spinner>
    </div>

    <!-- Tree view -->
    <mat-tree *ngIf="loaded && dataSource.data.length > 0" [dataSource]="dataSource" [treeControl]="treeControl">
      <!-- Leaf node (no children) -->
      <mat-tree-node *matTreeNodeDef="let node" matTreeNodePadding>
        <button mat-icon-button disabled></button>
        <mat-icon class="type-icon">{{ getNodeIcon(node) }}</mat-icon>
        <a [routerLink]="getNodeRoute(node)" class="node-link">{{ node.title }}</a>
        <mat-chip [class]="'status-' + node.status" class="mini-chip">{{ statusLabel(node.status) }}</mat-chip>
        <mat-chip *ngIf="node.priority" [class]="'priority-' + node.priority" class="mini-chip priority-chip">
          {{ 'priorities.' + node.priority | translate }}
        </mat-chip>
      </mat-tree-node>

      <!-- Expandable node (has children) -->
      <mat-tree-node *matTreeNodeDef="let node; when: hasChild" matTreeNodePadding>
        <button mat-icon-button matTreeNodeToggle (click)="loadChildren(node)">
          <mat-icon>{{ treeControl.isExpanded(node) ? 'expand_more' : 'chevron_right' }}</mat-icon>
        </button>
        <mat-icon class="type-icon">{{ getNodeIcon(node) }}</mat-icon>
        <a [routerLink]="getNodeRoute(node)" class="node-link">{{ node.title }}</a>
        <mat-chip [class]="'status-' + node.status" class="mini-chip">{{ statusLabel(node.status) }}</mat-chip>
        <mat-chip *ngIf="node.priority" [class]="'priority-' + node.priority" class="mini-chip priority-chip">
          {{ 'priorities.' + node.priority | translate }}
        </mat-chip>
        <mat-spinner *ngIf="node.isLoading" diameter="16" class="node-spinner"></mat-spinner>
      </mat-tree-node>
    </mat-tree>

    <!-- Empty state -->
    <div *ngIf="loaded && dataSource.data.length === 0" class="empty-state">
      {{ 'projects.noProjects' | translate }}
    </div>
  `,
  styles: [`
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    .page-header h2 {
      font-size: 22px;
      font-weight: 700;
      margin: 0;
    }
    .header-right {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .loading-state {
      display: flex;
      justify-content: center;
      padding: 48px 16px;
    }
    .empty-state {
      text-align: center;
      padding: 48px 16px;
      color: var(--text-secondary, #6b7280);
      font-size: 14px;
    }
    .type-icon {
      color: #6b7280;
      margin-right: 8px;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    .node-link {
      text-decoration: none;
      color: var(--primary-blue, #1a7cf4);
      font-weight: 500;
      margin-right: 8px;
    }
    .node-link:hover {
      text-decoration: underline;
    }
    .mini-chip {
      font-size: 11px !important;
      min-height: 22px !important;
      padding: 0 8px !important;
    }
    .priority-chip {
      margin-left: 4px;
    }
    .node-spinner {
      margin-left: 8px;
    }
    mat-tree-node {
      min-height: 40px;
    }
    mat-tree {
      background: transparent;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectListComponent implements OnInit, OnDestroy {
  isManager = false;
  loaded = false;
  statusFilter: string | undefined = undefined;
  private searchTerm = '';
  private destroy$ = new Subject<void>();
  private loadedChildrenCache = new Map<string, boolean>();

  // Tree infrastructure
  private transformer = (node: HierarchyNode, level: number): FlatNode => ({
    id: node.id,
    title: node.title,
    entityType: node.entityType,
    status: node.status,
    priority: node.priority,
    level,
    expandable: node.childrenCount > 0,
    isLoading: node.isLoading || false,
  });

  treeControl = new FlatTreeControl<FlatNode>(
    node => node.level,
    node => node.expandable,
  );

  private treeFlattener = new MatTreeFlattener(
    this.transformer,
    node => node.level,
    node => node.expandable,
    node => node.children,
  );

  dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);

  private hierarchyData: HierarchyNode[] = [];

  constructor(
    private projectService: ProjectService,
    private taskService: TaskService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.isManager = this.authService.hasRole('manager');
    this.loadTopLevel();
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(CreateEntityDialogComponent, {
      width: '600px',
      data: null,
    });
    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((result) => {
      if (result) {
        this.loadTopLevel();
      }
    });
  }

  hasChild = (_: number, node: FlatNode): boolean => node.expandable;

  loadTopLevel(): void {
    this.loaded = false;
    this.loadedChildrenCache.clear();
    this.cdr.markForCheck();

    const projectFilters: ProjectFilters = { page_size: 200 };
    const epicFilters: EpicFilters = { page_size: 200 };

    if (this.searchTerm) {
      projectFilters.search = this.searchTerm;
      epicFilters.search = this.searchTerm;
    }
    if (this.statusFilter) {
      projectFilters.status = this.statusFilter;
      epicFilters.status = this.statusFilter;
    }

    forkJoin({
      projects: this.projectService.listProjects(projectFilters),
      standaloneEpics: this.projectService.listEpics(epicFilters),
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ projects, standaloneEpics }) => {
        const projectNodes: HierarchyNode[] = projects.results.map(p => ({
          id: p.id,
          title: p.title,
          entityType: 'project' as const,
          status: p.status,
          priority: p.priority,
          childrenCount: p.epics_count,
          children: [],
        }));

        // Only include epics that have no project (standalone)
        const standaloneEpicNodes: HierarchyNode[] = standaloneEpics.results
          .filter(e => !e.project)
          .map(e => ({
            id: e.id,
            title: e.title,
            entityType: 'epic' as const,
            status: e.status,
            priority: e.priority,
            childrenCount: e.tasks_count,
            children: [],
          }));

        this.hierarchyData = [...projectNodes, ...standaloneEpicNodes];
        this.dataSource.data = this.hierarchyData;
        this.loaded = true;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loaded = true;
        this.cdr.markForCheck();
      },
    });
  }

  loadChildren(node: FlatNode): void {
    const cacheKey = `${node.entityType}-${node.id}`;

    // If already loaded or currently loading, skip
    if (this.loadedChildrenCache.has(cacheKey)) {
      return;
    }

    // If collapsing (node was just toggled closed), do nothing
    if (!this.treeControl.isExpanded(node)) {
      return;
    }

    // Mark as loading
    node.isLoading = true;
    this.loadedChildrenCache.set(cacheKey, true);
    this.cdr.markForCheck();

    if (node.entityType === 'project') {
      this.projectService.getProjectEpics(node.id).pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          const epicNodes: HierarchyNode[] = res.results.map(e => ({
            id: e.id,
            title: e.title,
            entityType: 'epic' as const,
            status: e.status,
            priority: e.priority,
            childrenCount: e.tasks_count,
            children: [],
          }));
          this.insertChildren(node, epicNodes);
          node.isLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          node.isLoading = false;
          this.loadedChildrenCache.delete(cacheKey);
          this.cdr.markForCheck();
        },
      });
    } else if (node.entityType === 'epic') {
      this.projectService.getEpicTasks(node.id).pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          const taskNodes: HierarchyNode[] = res.results.map((t: any) => ({
            id: t.id,
            title: t.title,
            entityType: 'task' as const,
            status: t.status,
            priority: t.priority,
            childrenCount: t.subtasks_count || 0,
            children: [],
          }));
          this.insertChildren(node, taskNodes);
          node.isLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          node.isLoading = false;
          this.loadedChildrenCache.delete(cacheKey);
          this.cdr.markForCheck();
        },
      });
    } else if (node.entityType === 'task') {
      this.taskService.getSubtasks(node.id).pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          const subtaskNodes: HierarchyNode[] = res.results.map(s => ({
            id: s.id,
            title: s.title,
            entityType: 'subtask' as const,
            status: s.status,
            priority: s.priority,
            childrenCount: 0,
            children: [],
          }));
          this.insertChildren(node, subtaskNodes);
          node.isLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          node.isLoading = false;
          this.loadedChildrenCache.delete(cacheKey);
          this.cdr.markForCheck();
        },
      });
    }
  }

  private insertChildren(parentNode: FlatNode, children: HierarchyNode[]): void {
    const parentHierarchyNode = this.findHierarchyNode(
      this.hierarchyData, parentNode.entityType, parentNode.id
    );
    if (parentHierarchyNode) {
      parentHierarchyNode.children = children;
      // Refresh the data source to pick up the new children
      this.dataSource.data = this.hierarchyData;
      // Re-expand the parent node since refreshing data collapses everything
      this.restoreExpandedState(parentNode);
    }
  }

  private findHierarchyNode(nodes: HierarchyNode[], entityType: string, id: number): HierarchyNode | null {
    for (const node of nodes) {
      if (node.entityType === entityType && node.id === id) {
        return node;
      }
      if (node.children) {
        const found = this.findHierarchyNode(node.children, entityType, id);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }

  private restoreExpandedState(targetNode: FlatNode): void {
    // After data refresh, re-expand all nodes that were previously expanded
    const expandedKeys = new Set<string>();
    // Collect which nodes should be expanded based on loaded children cache
    this.loadedChildrenCache.forEach((_, key) => {
      expandedKeys.add(key);
    });

    // Also include the current target node
    expandedKeys.add(`${targetNode.entityType}-${targetNode.id}`);

    // Expand matching nodes in the new flat data
    this.treeControl.dataNodes?.forEach(flatNode => {
      const key = `${flatNode.entityType}-${flatNode.id}`;
      if (expandedKeys.has(key)) {
        this.treeControl.expand(flatNode);
      }
    });
  }

  getNodeIcon(node: FlatNode): string {
    switch (node.entityType) {
      case 'project': return 'folder';
      case 'epic': return 'account_tree';
      case 'task': return 'task_alt';
      case 'subtask': return 'subdirectory_arrow_right';
      default: return 'article';
    }
  }

  getNodeRoute(node: FlatNode): string[] {
    switch (node.entityType) {
      case 'project': return ['/projects', String(node.id)];
      case 'epic': return ['/epics', String(node.id)];
      case 'task': return ['/tasks', String(node.id)];
      case 'subtask': return ['/tasks', String(node.id)];
      default: return ['/projects'];
    }
  }

  statusLabel(status: string): string {
    return this.translate.instant(STATUS_TRANSLATION_KEYS[status] || status);
  }

  onStatusFilter(status: string | undefined): void {
    this.statusFilter = status;
    this.loadTopLevel();
  }

  onSearch(term: string): void {
    this.searchTerm = term;
    this.loadTopLevel();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
