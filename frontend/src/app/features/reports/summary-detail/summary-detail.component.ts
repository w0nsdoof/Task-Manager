import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SummaryService, SummaryDetail, SummaryVersion } from '../../../core/services/summary.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
    selector: 'app-summary-detail',
    imports: [
        CommonModule, RouterModule, MatCardModule, MatButtonModule,
        MatIconModule, MatChipsModule, MatListModule, MatDividerModule,
        MatExpansionModule, MatProgressSpinnerModule, MatSnackBarModule, TranslateModule,
    ],
    template: `
    <div class="header-row">
      <h2>{{ 'summaries.detailTitle' | translate }}</h2>
      <a mat-button routerLink="/reports/summaries"><mat-icon>arrow_back</mat-icon> {{ 'summaries.backToHistory' | translate }}</a>
    </div>

    <div *ngIf="loading" style="text-align: center; padding: 48px;">
      <mat-spinner diameter="40"></mat-spinner>
    </div>

    <div *ngIf="summary && !loading">
      <mat-card class="detail-card">
        <mat-card-header>
          <mat-card-title>
            <span class="type-chip" [ngClass]="summary.period_type">{{ summary.period_type }}</span>
            {{ summary.period_start }} — {{ summary.period_end }}
          </mat-card-title>
          <mat-card-subtitle>
            <span class="status-badge" [ngClass]="summary.status">{{ summary.status }}</span>
            <span *ngIf="summary.generation_method" class="method-badge" [ngClass]="summary.generation_method">
              {{ summary.generation_method === 'ai' ? ('reports.ai' | translate) : ('reports.fallback' | translate) }}
            </span>
            <span class="meta-info">{{ 'reports.generated' | translate }} {{ summary.generated_at | date:'medium' }}</span>
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div *ngIf="hasSections(); else plainText" class="structured-summary">
            <div *ngFor="let section of orderedSections()" class="summary-section">
              <h3 class="section-header">{{ section }}</h3>
              <div class="section-content" [innerHTML]="renderMarkdown(summary.sections![section])"></div>
            </div>
          </div>
          <ng-template #plainText>
            <p class="summary-text">{{ summary.summary_text }}</p>
          </ng-template>

          <mat-divider></mat-divider>

          <div class="metadata">
            <h4>{{ 'summaries.generationDetails' | translate }}</h4>
            <div class="meta-grid">
              <div *ngIf="summary.llm_model"><strong>{{ 'summaries.model' | translate }}</strong> {{ summary.llm_model }}</div>
              <div *ngIf="summary.prompt_tokens != null"><strong>{{ 'summaries.promptTokens' | translate }}</strong> {{ summary.prompt_tokens }}</div>
              <div *ngIf="summary.completion_tokens != null"><strong>{{ 'summaries.completionTokens' | translate }}</strong> {{ summary.completion_tokens }}</div>
              <div *ngIf="summary.generation_time_ms != null"><strong>{{ 'summaries.generationTime' | translate }}</strong> {{ summary.generation_time_ms }}ms</div>
              <div *ngIf="summary.requested_by"><strong>{{ 'summaries.requestedBy' | translate }}</strong> {{ summary.requested_by.first_name }} {{ summary.requested_by.last_name }}</div>
              <div><strong>{{ 'summaries.versions' | translate }}</strong> {{ summary.version_count }}</div>
            </div>
            <div *ngIf="summary.error_message" class="error-msg">
              <strong>{{ 'summaries.error' | translate }}</strong> {{ summary.error_message }}
            </div>
          </div>

          <mat-accordion *ngIf="isManager && summary.prompt_text" class="prompt-accordion">
            <mat-expansion-panel>
              <mat-expansion-panel-header>
                <mat-panel-title>{{ 'summaries.promptSent' | translate }}</mat-panel-title>
              </mat-expansion-panel-header>
              <pre class="prompt-text">{{ summary.prompt_text }}</pre>
            </mat-expansion-panel>
          </mat-accordion>
        </mat-card-content>
        <mat-card-actions *ngIf="isManager">
          <button mat-raised-button color="primary" (click)="regenerate()" [disabled]="regenerating">
            <mat-icon>refresh</mat-icon>
            {{ regenerating ? ('summaries.regenerating' | translate) : ('summaries.regenerate' | translate) }}
          </button>
        </mat-card-actions>
      </mat-card>

      <!-- Version History -->
      <mat-card *ngIf="versions.length > 1" class="versions-card">
        <mat-card-header>
          <mat-card-title>{{ 'summaries.versionHistory' | translate }} ({{ versions.length }})</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <mat-list>
            <mat-list-item *ngFor="let v of versions" (click)="switchVersion(v)" class="version-item"
                           [class.active-version]="v.id === summary.id">
              <div matListItemTitle>
                <span class="method-badge" [ngClass]="v.generation_method">
                  {{ v.generation_method === 'ai' ? ('reports.ai' | translate) : ('reports.fallback' | translate) }}
                </span>
                {{ v.generated_at | date:'medium' }}
                <span *ngIf="v.requested_by"> by {{ v.requested_by.first_name }} {{ v.requested_by.last_name }}</span>
              </div>
              <div matListItemLine class="version-preview">
                {{ v.summary_text | slice:0:120 }}{{ v.summary_text.length > 120 ? '...' : '' }}
              </div>
            </mat-list-item>
          </mat-list>
        </mat-card-content>
      </mat-card>
    </div>
  `,
    styles: [`
    .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .detail-card { margin-bottom: 24px; }
    .summary-text { white-space: pre-line; line-height: 1.6; font-size: 15px; margin: 16px 0; }
    .structured-summary { margin: 16px 0; }
    .summary-section { margin-bottom: 16px; }
    .section-header { font-size: 16px; font-weight: 600; color: #1565c0; margin: 0 0 8px 0; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; }
    .section-content { line-height: 1.6; font-size: 15px; margin: 0; }
    .section-content p { margin: 4px 0; }
    .section-content ul { margin: 4px 0 4px 16px; padding-left: 8px; }
    .section-content li { margin: 2px 0; }
    .prompt-accordion { margin-top: 16px; display: block; }
    .prompt-text { white-space: pre-wrap; font-size: 13px; background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; }
    .metadata { margin-top: 16px; }
    .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; margin-top: 8px; }
    .meta-info { margin-left: 12px; color: #666; }
    .error-msg { margin-top: 12px; padding: 8px 12px; background: #ffebee; border-radius: 4px; color: #c62828; }
    .type-chip {
      padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; text-transform: capitalize; margin-right: 8px;
    }
    .type-chip.daily { background: #e3f2fd; color: #1565c0; }
    .type-chip.weekly { background: #f3e5f5; color: #7b1fa2; }
    .type-chip.on_demand { background: #e8eaf6; color: #283593; }
    .status-badge {
      padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; text-transform: capitalize; margin-right: 8px;
    }
    .status-badge.completed { background: #e8f5e9; color: #2e7d32; }
    .status-badge.pending { background: #fff3e0; color: #e65100; }
    .status-badge.generating { background: #e3f2fd; color: #1565c0; }
    .status-badge.failed { background: #ffebee; color: #c62828; }
    .method-badge {
      padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; text-transform: uppercase; margin-right: 8px;
    }
    .method-badge.ai { background: #e8f5e9; color: #2e7d32; }
    .method-badge.fallback { background: #fff3e0; color: #e65100; }
    .versions-card { margin-top: 16px; }
    .version-item { cursor: pointer; }
    .version-item:hover { background: rgba(0, 0, 0, 0.04); }
    .active-version { background: rgba(25, 118, 210, 0.08); }
    .version-preview { color: #666; font-size: 13px; }
  `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SummaryDetailComponent implements OnInit, OnDestroy {
  summary: SummaryDetail | null = null;
  versions: SummaryVersion[] = [];
  loading = false;
  regenerating = false;
  isManager = false;
  // Preferred render order. Daily summaries use the short shape (Overview + Watchlist);
  // weekly / on-demand use the full shape. Any other section the LLM emits is appended
  // at the end so the user never silently loses content.
  private static readonly DAILY_ORDER = ['Overview', 'Watchlist'];
  private static readonly FULL_ORDER = ['Overview', 'Key Metrics', 'Highlights', 'Risks & Blockers', 'Recommendations'];
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private summaryService: SummaryService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    public translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.isManager = this.authService.hasRole('manager');
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.loadSummary(+params['id']);
    });
  }

  loadSummary(id: number): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.summaryService.getById(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.summary = data;
        this.loading = false;
        this.cdr.markForCheck();
        this.loadVersions(id);
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  loadVersions(id: number): void {
    this.summaryService.getVersions(id).pipe(takeUntil(this.destroy$)).subscribe((versions) => {
      this.versions = versions;
      this.cdr.markForCheck();
    });
  }

  switchVersion(version: SummaryVersion): void {
    this.router.navigate(['/reports/summaries', version.id]);
  }

  hasSections(): boolean {
    return !!this.summary?.sections && Object.keys(this.summary.sections).length > 0;
  }

  orderedSections(): string[] {
    if (!this.summary?.sections) return [];
    const present = Object.keys(this.summary.sections).filter(
      (k) => !!this.summary!.sections![k],
    );
    const preferred = this.summary.period_type === 'daily'
      ? SummaryDetailComponent.DAILY_ORDER
      : SummaryDetailComponent.FULL_ORDER;
    const ordered = preferred.filter((k) => present.includes(k));
    const extras = present.filter((k) => !preferred.includes(k));
    return [...ordered, ...extras];
  }

  renderMarkdown(text: string): string {
    // Convert **bold** to <strong>
    let html = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Split into lines and wrap list items in <ul>
    const lines = html.split('\n');
    const result: string[] = [];
    let inList = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^[-*]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
        if (!inList) { result.push('<ul>'); inList = true; }
        const content = trimmed.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '');
        result.push(`<li>${content}</li>`);
      } else {
        if (inList) { result.push('</ul>'); inList = false; }
        if (trimmed) result.push(`<p>${trimmed}</p>`);
      }
    }
    if (inList) result.push('</ul>');
    return result.join('');
  }

  regenerate(): void {
    if (!this.summary) return;
    this.regenerating = true;
    this.cdr.markForCheck();
    this.summaryService.regenerate(this.summary.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (newSummary) => {
        this.regenerating = false;
        this.snackBar.open(this.translate.instant('summaries.regenerationStarted'), this.translate.instant('common.view'), { duration: 5000 }).onAction().subscribe(() => {
          this.router.navigate(['/reports/summaries', newSummary.id]);
        });
        this.cdr.markForCheck();
        // Reload versions to show the new one
        this.loadVersions(this.summary!.id);
      },
      error: () => {
        this.regenerating = false;
        this.snackBar.open(this.translate.instant('summaries.regenerationFailed'), this.translate.instant('common.dismiss'), { duration: 3000 });
        this.cdr.markForCheck();
      },
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
