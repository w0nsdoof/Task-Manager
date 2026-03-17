import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ParentBreadcrumbComponent, BreadcrumbItem } from './parent-breadcrumb.component';

describe('ParentBreadcrumbComponent', () => {
  let component: ParentBreadcrumbComponent;
  let fixture: ComponentFixture<ParentBreadcrumbComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParentBreadcrumbComponent],
      providers: [
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ParentBreadcrumbComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should default to empty items', () => {
    fixture.detectChanges();
    expect(component.items).toEqual([]);
  });

  it('should not render breadcrumb nav when items is empty', () => {
    fixture.detectChanges();
    const nav = fixture.nativeElement.querySelector('.breadcrumb');
    expect(nav).toBeNull();
  });

  it('should render breadcrumb items when provided', () => {
    const items: BreadcrumbItem[] = [
      { label: 'Project A', route: ['/projects', '1'] },
      { label: 'Epic B', route: ['/epics', '2'] },
    ];
    component.items = items;
    fixture.detectChanges();

    const links = fixture.nativeElement.querySelectorAll('.breadcrumb-link');
    expect(links.length).toBe(2);
    expect(links[0].textContent.trim()).toBe('Project A');
    expect(links[1].textContent.trim()).toBe('Epic B');
  });

  it('should render separator between items', () => {
    const items: BreadcrumbItem[] = [
      { label: 'A', route: ['/a'] },
      { label: 'B', route: ['/b'] },
    ];
    component.items = items;
    fixture.detectChanges();

    const separators = fixture.nativeElement.querySelectorAll('.breadcrumb-separator');
    expect(separators.length).toBe(1);
  });

  it('should not render separator for single item', () => {
    component.items = [{ label: 'Only', route: ['/only'] }];
    fixture.detectChanges();

    const separators = fixture.nativeElement.querySelectorAll('.breadcrumb-separator');
    expect(separators.length).toBe(0);
  });
});
