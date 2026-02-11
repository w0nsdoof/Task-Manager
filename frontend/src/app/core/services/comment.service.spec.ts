import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { CommentService, Comment, PaginatedResponse } from './comment.service';

describe('CommentService', () => {
  let service: CommentService;
  let httpMock: HttpTestingController;

  const mockComment: Comment = {
    id: 1,
    author: { id: 1, first_name: 'Test', last_name: 'User', role: 'manager' },
    content: 'Test comment',
    is_public: true,
    mentions: [],
    created_at: '2025-01-01T00:00:00Z',
  };

  const mockPaginated: PaginatedResponse<Comment> = {
    count: 1, next: null, previous: null, results: [mockComment],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CommentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('list', () => {
    it('should GET comments for a task with pagination', () => {
      service.list(10, 2).subscribe((res) => {
        expect(res.count).toBe(1);
        expect(res.results[0].content).toBe('Test comment');
      });

      const req = httpMock.expectOne((r) => r.url === '/api/tasks/10/comments/');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('page')).toBe('2');
      req.flush(mockPaginated);
    });

    it('should default to page 1', () => {
      service.list(5).subscribe();

      const req = httpMock.expectOne((r) => r.url === '/api/tasks/5/comments/');
      expect(req.request.params.get('page')).toBe('1');
      req.flush(mockPaginated);
    });
  });

  describe('create', () => {
    it('should POST a public comment', () => {
      service.create(10, 'Hello world', true).subscribe((res) => {
        expect(res.id).toBe(1);
      });

      const req = httpMock.expectOne('/api/tasks/10/comments/');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ content: 'Hello world', is_public: true });
      req.flush(mockComment);
    });

    it('should POST a private comment', () => {
      service.create(10, 'Internal note', false).subscribe();

      const req = httpMock.expectOne('/api/tasks/10/comments/');
      expect(req.request.body).toEqual({ content: 'Internal note', is_public: false });
      req.flush(mockComment);
    });

    it('should default is_public to true', () => {
      service.create(10, 'Default public').subscribe();

      const req = httpMock.expectOne('/api/tasks/10/comments/');
      expect(req.request.body.is_public).toBeTrue();
      req.flush(mockComment);
    });
  });
});
