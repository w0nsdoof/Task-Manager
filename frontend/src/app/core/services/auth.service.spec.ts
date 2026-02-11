import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService, TokenResponse, UserInfo } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let router: jasmine.SpyObj<Router>;

  // JWT token with payload: { user_id: 1, email: "test@example.com", first_name: "Test", last_name: "User", role: "manager" }
  const fakePayload = { user_id: 1, email: 'test@example.com', first_name: 'Test', last_name: 'User', role: 'manager' };
  const fakeToken = 'header.' + btoa(JSON.stringify(fakePayload)) + '.signature';
  const fakeTokens: TokenResponse = { access: fakeToken, refresh: 'refresh-token-123' };

  beforeEach(() => {
    router = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
      ],
    });

    localStorage.clear();
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_info');
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('login', () => {
    it('should POST credentials and store tokens', () => {
      service.login('test@example.com', 'pass123').subscribe((res) => {
        expect(res).toEqual(fakeTokens);
      });

      const req = httpMock.expectOne('/api/auth/token/');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'test@example.com', password: 'pass123' });
      req.flush(fakeTokens);

      expect(localStorage.getItem('access_token')).toBe(fakeToken);
      expect(localStorage.getItem('refresh_token')).toBe('refresh-token-123');
    });

    it('should decode JWT and update currentUser$', () => {
      let user: UserInfo | null = null;
      service.currentUser$.subscribe((u) => (user = u));

      service.login('test@example.com', 'pass123').subscribe();
      httpMock.expectOne('/api/auth/token/').flush(fakeTokens);

      expect(user).toEqual(jasmine.objectContaining({
        id: 1,
        email: 'test@example.com',
        role: 'manager',
      }));
    });

    it('should store user info in localStorage', () => {
      service.login('test@example.com', 'pass123').subscribe();
      httpMock.expectOne('/api/auth/token/').flush(fakeTokens);

      const stored = JSON.parse(localStorage.getItem('user_info')!);
      expect(stored.email).toBe('test@example.com');
    });
  });

  describe('refreshToken', () => {
    it('should POST refresh token and update access token', () => {
      localStorage.setItem('refresh_token', 'old-refresh');
      const newPayload = { ...fakePayload, role: 'engineer' };
      const newToken = 'header.' + btoa(JSON.stringify(newPayload)) + '.signature';

      service.refreshToken().subscribe((res) => {
        expect(res.access).toBe(newToken);
      });

      const req = httpMock.expectOne('/api/auth/token/refresh/');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ refresh: 'old-refresh' });
      req.flush({ access: newToken });

      expect(localStorage.getItem('access_token')).toBe(newToken);
    });
  });

  describe('logout', () => {
    it('should clear all stored data and navigate to login', () => {
      localStorage.setItem('access_token', 'tok');
      localStorage.setItem('refresh_token', 'ref');
      localStorage.setItem('user_info', '{}');

      service.logout();

      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
      expect(localStorage.getItem('user_info')).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('should emit null on currentUser$', () => {
      let user: UserInfo | null = { id: 1 } as UserInfo;
      service.currentUser$.subscribe((u) => (user = u));

      service.logout();
      expect(user).toBeNull();
    });
  });

  describe('getAccessToken / getRefreshToken', () => {
    it('should return token from localStorage', () => {
      expect(service.getAccessToken()).toBeNull();
      localStorage.setItem('access_token', 'my-token');
      expect(service.getAccessToken()).toBe('my-token');
    });

    it('should return refresh token from localStorage', () => {
      expect(service.getRefreshToken()).toBeNull();
      localStorage.setItem('refresh_token', 'my-refresh');
      expect(service.getRefreshToken()).toBe('my-refresh');
    });
  });

  describe('isLoggedIn', () => {
    it('should return false when no token', () => {
      expect(service.isLoggedIn()).toBeFalse();
    });

    it('should return true when token present', () => {
      localStorage.setItem('access_token', 'tok');
      expect(service.isLoggedIn()).toBeTrue();
    });
  });

  describe('hasRole', () => {
    it('should return true for matching role', () => {
      service.login('test@example.com', 'pass').subscribe();
      httpMock.expectOne('/api/auth/token/').flush(fakeTokens);

      expect(service.hasRole('manager')).toBeTrue();
      expect(service.hasRole('engineer')).toBeFalse();
    });

    it('should return false when no user', () => {
      expect(service.hasRole('manager')).toBeFalse();
    });
  });

  describe('getCurrentUser', () => {
    it('should return null initially', () => {
      expect(service.getCurrentUser()).toBeNull();
    });

    it('should return user after login', () => {
      service.login('test@example.com', 'pass').subscribe();
      httpMock.expectOne('/api/auth/token/').flush(fakeTokens);

      const user = service.getCurrentUser();
      expect(user?.email).toBe('test@example.com');
    });
  });

  describe('initialization from localStorage', () => {
    it('should restore user from localStorage on creation', () => {
      const storedUser: UserInfo = { id: 5, email: 'stored@test.com', first_name: 'S', last_name: 'U', role: 'client' };
      localStorage.setItem('user_info', JSON.stringify(storedUser));

      // Re-create service to pick up localStorage state
      const freshService = new (AuthService as any)(
        TestBed.inject(AuthService)['http'],
        router,
      );
      expect(freshService.getCurrentUser()).toEqual(storedUser);
    });
  });
});
