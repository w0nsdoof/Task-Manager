import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { jwtInterceptor } from './jwt.interceptor';
import { AuthService } from '../services/auth.service';

describe('jwtInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    authService = jasmine.createSpyObj('AuthService', [
      'getAccessToken', 'refreshToken', 'logout',
    ]);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should add Authorization header when token exists', () => {
    authService.getAccessToken.and.returnValue('my-token');

    httpClient.get('/api/tasks/').subscribe();

    const req = httpMock.expectOne('/api/tasks/');
    expect(req.request.headers.get('Authorization')).toBe('Bearer my-token');
    req.flush({});
  });

  it('should not add Authorization header when no token', () => {
    authService.getAccessToken.and.returnValue(null);

    httpClient.get('/api/tasks/').subscribe();

    const req = httpMock.expectOne('/api/tasks/');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('should attempt token refresh on 401 for non-auth URLs', () => {
    authService.getAccessToken.and.returnValue('old-token');
    authService.refreshToken.and.returnValue(of({ access: 'new-token' }));

    httpClient.get('/api/tasks/').subscribe();

    // First request fails with 401
    const req1 = httpMock.expectOne('/api/tasks/');
    req1.flush({}, { status: 401, statusText: 'Unauthorized' });

    // After refresh, retried request should have new token
    const req2 = httpMock.expectOne('/api/tasks/');
    expect(req2.request.headers.get('Authorization')).toBe('Bearer new-token');
    req2.flush({});
  });

  it('should not refresh token for auth URLs', () => {
    authService.getAccessToken.and.returnValue('token');

    httpClient.post('/api/auth/token/', {}).subscribe({
      error: () => { /* expected */ },
    });

    const req = httpMock.expectOne('/api/auth/token/');
    req.flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(authService.refreshToken).not.toHaveBeenCalled();
  });

  it('should logout when refresh fails', () => {
    authService.getAccessToken.and.returnValue('old-token');
    authService.refreshToken.and.returnValue(throwError(() => new Error('Refresh failed')));

    httpClient.get('/api/tasks/').subscribe({
      error: () => { /* expected */ },
    });

    const req = httpMock.expectOne('/api/tasks/');
    req.flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(authService.logout).toHaveBeenCalled();
  });

  it('should pass through non-401 errors', () => {
    authService.getAccessToken.and.returnValue('token');
    let errorStatus = 0;

    httpClient.get('/api/tasks/').subscribe({
      error: (err) => { errorStatus = err.status; },
    });

    const req = httpMock.expectOne('/api/tasks/');
    req.flush({}, { status: 500, statusText: 'Server Error' });

    expect(errorStatus).toBe(500);
    expect(authService.refreshToken).not.toHaveBeenCalled();
  });
});
