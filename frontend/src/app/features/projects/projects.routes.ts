import { Routes } from '@angular/router';

export const PROJECTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/project-list/project-list.component').then(m => m.ProjectListComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./components/project-detail/project-detail.component').then(m => m.ProjectDetailComponent),
  },
];

export const EPIC_ROUTES: Routes = [
  {
    path: ':id',
    loadComponent: () =>
      import('./components/epic-detail/epic-detail.component').then(m => m.EpicDetailComponent),
  },
];
