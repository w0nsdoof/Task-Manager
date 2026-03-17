import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

export interface BreadcrumbItem {
  label: string;
  route: string[];
}

@Component({
  selector: 'app-parent-breadcrumb',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  template: `
    <nav class="breadcrumb" *ngIf="items.length">
      <ng-container *ngFor="let item of items; let last = last">
        <a [routerLink]="item.route" class="breadcrumb-link">{{ item.label }}</a>
        <mat-icon *ngIf="!last" class="breadcrumb-separator">chevron_right</mat-icon>
      </ng-container>
    </nav>
  `,
  styles: [`
    .breadcrumb {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px;
      padding: 10px 16px;
      background: #fafbfc;
      border-radius: var(--border-radius-card, 12px);
      border: 1px solid var(--border-color, #e5e7eb);
      margin-bottom: 16px;
      font-size: 14px;
    }
    .breadcrumb-link {
      color: var(--primary-blue, #1a7cf4);
      text-decoration: none;
      font-weight: 500;
    }
    .breadcrumb-link:hover {
      text-decoration: underline;
    }
    .breadcrumb-separator {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #d1d5db;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParentBreadcrumbComponent {
  @Input() items: BreadcrumbItem[] = [];
}
