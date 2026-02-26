import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TagService, Tag } from '../../core/services/tag.service';
import { SearchBarComponent } from '../../shared/components/search-bar/search-bar.component';

@Component({
  selector: 'app-tag-management',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatTableModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatCardModule, MatSnackBarModule,
    SearchBarComponent,
  ],
  template: `
    <div class="header">
      <h2>Tags</h2>
      <button mat-raised-button color="primary" (click)="showCreateForm = !showCreateForm">
        <mat-icon>add</mat-icon> New Tag
      </button>
    </div>

    <mat-card *ngIf="showCreateForm" class="create-form">
      <mat-card-content>
        <h3>Create Tag</h3>
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Name</mat-label>
            <input matInput [(ngModel)]="newTag.name" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Color</mat-label>
            <input matInput [(ngModel)]="newTag.color" placeholder="#6c757d" />
          </mat-form-field>
          <div class="color-preview" [style.background]="newTag.color"></div>
        </div>
        <button mat-raised-button color="primary" (click)="createTag()" [disabled]="!newTag.name.trim()">Create</button>
        <button mat-button (click)="showCreateForm = false">Cancel</button>
      </mat-card-content>
    </mat-card>

    <app-search-bar placeholder="Search tags..." (search)="onSearch($event)"></app-search-bar>

    <table mat-table [dataSource]="tags" class="full-width">
      <ng-container matColumnDef="color">
        <th mat-header-cell *matHeaderCellDef>Color</th>
        <td mat-cell *matCellDef="let tag">
          <span class="color-swatch" [style.background]="tag.color"></span>
          {{ tag.color }}
        </td>
      </ng-container>

      <ng-container matColumnDef="name">
        <th mat-header-cell *matHeaderCellDef>Name</th>
        <td mat-cell *matCellDef="let tag">{{ tag.name }}</td>
      </ng-container>

      <ng-container matColumnDef="slug">
        <th mat-header-cell *matHeaderCellDef>Slug</th>
        <td mat-cell *matCellDef="let tag">{{ tag.slug }}</td>
      </ng-container>

      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef>Actions</th>
        <td mat-cell *matCellDef="let tag">
          <button mat-icon-button color="warn" (click)="deleteTag(tag)">
            <mat-icon>delete</mat-icon>
          </button>
        </td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns"></tr>
    </table>

    <div *ngIf="tags.length === 0" class="empty-state">No tags found.</div>
  `,
  styles: [`
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .full-width { width: 100%; }
    .create-form { margin-bottom: 24px; }
    .form-row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
    .form-row mat-form-field { flex: 1; min-width: 200px; }
    .color-preview { width: 36px; height: 36px; border-radius: 4px; border: 1px solid #ccc; }
    .color-swatch { display: inline-block; width: 16px; height: 16px; border-radius: 3px; vertical-align: middle; margin-right: 8px; border: 1px solid #ccc; }
    .empty-state { text-align: center; padding: 32px; color: #888; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagManagementComponent implements OnInit, OnDestroy {
  tags: Tag[] = [];
  columns = ['color', 'name', 'slug', 'actions'];
  showCreateForm = false;
  newTag = { name: '', color: '#6c757d' };
  private searchTerm = '';
  private destroy$ = new Subject<void>();

  constructor(
    private tagService: TagService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadTags();
  }

  loadTags(): void {
    this.tagService.list(this.searchTerm || undefined).pipe(takeUntil(this.destroy$)).subscribe((res) => {
      this.tags = res.results;
      this.cdr.markForCheck();
    });
  }

  onSearch(term: string): void {
    this.searchTerm = term;
    this.loadTags();
  }

  createTag(): void {
    if (!this.newTag.name.trim()) return;
    this.tagService.create(this.newTag.name.trim(), this.newTag.color).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.snackBar.open('Tag created', 'OK', { duration: 3000 });
        this.showCreateForm = false;
        this.newTag = { name: '', color: '#6c757d' };
        this.loadTags();
        this.cdr.markForCheck();
      },
      error: (err) => {
        const msg = err.error?.name?.[0] || err.error?.detail || 'Failed to create tag';
        this.snackBar.open(msg, 'Close', { duration: 3000 });
      },
    });
  }

  deleteTag(tag: Tag): void {
    this.tagService.delete(tag.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.snackBar.open('Tag deleted', 'OK', { duration: 3000 });
        this.loadTags();
      },
      error: (err) => {
        const msg = err.error?.detail || 'Failed to delete tag';
        this.snackBar.open(msg, 'Close', { duration: 3000 });
      },
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
