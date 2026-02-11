import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ClientService, Client, PaginatedResponse } from './client.service';

describe('ClientService', () => {
  let service: ClientService;
  let httpMock: HttpTestingController;

  const mockClient: Client = {
    id: 1, name: 'Acme Corp', client_type: 'company', phone: '+123',
    email: 'acme@test.com', contact_person: 'John', created_at: '2025-01-01',
  };

  const mockPaginated: PaginatedResponse<Client> = {
    count: 1, next: null, previous: null, results: [mockClient],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ClientService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('list', () => {
    it('should GET clients with no params', () => {
      service.list().subscribe((res) => {
        expect(res.results.length).toBe(1);
      });

      const req = httpMock.expectOne('/api/clients/');
      expect(req.request.method).toBe('GET');
      req.flush(mockPaginated);
    });

    it('should pass search and ordering params', () => {
      service.list({ search: 'acme', ordering: '-name' }).subscribe();

      const req = httpMock.expectOne((r) => r.url === '/api/clients/');
      expect(req.request.params.get('search')).toBe('acme');
      expect(req.request.params.get('ordering')).toBe('-name');
      req.flush(mockPaginated);
    });
  });

  describe('get', () => {
    it('should GET a single client', () => {
      service.get(1).subscribe((res) => {
        expect(res.name).toBe('Acme Corp');
      });

      const req = httpMock.expectOne('/api/clients/1/');
      expect(req.request.method).toBe('GET');
      req.flush(mockClient);
    });
  });

  describe('create', () => {
    it('should POST a new client', () => {
      const payload = { name: 'New Client', client_type: 'individual' };
      service.create(payload).subscribe();

      const req = httpMock.expectOne('/api/clients/');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush(mockClient);
    });
  });

  describe('update', () => {
    it('should PATCH an existing client', () => {
      service.update(1, { name: 'Updated' }).subscribe();

      const req = httpMock.expectOne('/api/clients/1/');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ name: 'Updated' });
      req.flush(mockClient);
    });
  });

  describe('getTasks', () => {
    it('should GET tasks for a client', () => {
      service.getTasks(1, { page: 2 }).subscribe();

      const req = httpMock.expectOne((r) => r.url === '/api/clients/1/tasks/');
      expect(req.request.params.get('page')).toBe('2');
      req.flush({ count: 0, next: null, previous: null, results: [] });
    });

    it('should work with no params', () => {
      service.getTasks(5).subscribe();

      const req = httpMock.expectOne('/api/clients/5/tasks/');
      expect(req.request.method).toBe('GET');
      req.flush({ count: 0, next: null, previous: null, results: [] });
    });
  });
});
