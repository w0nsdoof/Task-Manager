import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { authGuard, managerGuard, engineerGuard, clientGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('Auth Guards', () => {
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;
  const loginUrlTree = {} as UrlTree;
  const rootUrlTree = {} as UrlTree;

  beforeEach(() => {
    authService = jasmine.createSpyObj('AuthService', ['isLoggedIn', 'hasRole']);
    router = jasmine.createSpyObj('Router', ['createUrlTree']);

    router.createUrlTree.and.callFake((commands: string[]) => {
      if (commands[0] === '/login') return loginUrlTree;
      return rootUrlTree;
    });

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
      ],
    });
  });

  const runGuard = (guard: any) => {
    return TestBed.runInInjectionContext(() => guard({} as any, {} as any));
  };

  describe('authGuard', () => {
    it('should allow access when logged in', () => {
      authService.isLoggedIn.and.returnValue(true);
      expect(runGuard(authGuard)).toBeTrue();
    });

    it('should redirect to /login when not logged in', () => {
      authService.isLoggedIn.and.returnValue(false);
      expect(runGuard(authGuard)).toBe(loginUrlTree);
      expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('managerGuard', () => {
    it('should allow access for logged-in manager', () => {
      authService.isLoggedIn.and.returnValue(true);
      authService.hasRole.and.callFake((r: string) => r === 'manager');
      expect(runGuard(managerGuard)).toBeTrue();
    });

    it('should redirect to / for non-manager', () => {
      authService.isLoggedIn.and.returnValue(true);
      authService.hasRole.and.returnValue(false);
      expect(runGuard(managerGuard)).toBe(rootUrlTree);
    });

    it('should redirect to / when not logged in', () => {
      authService.isLoggedIn.and.returnValue(false);
      authService.hasRole.and.returnValue(false);
      expect(runGuard(managerGuard)).toBe(rootUrlTree);
    });
  });

  describe('engineerGuard', () => {
    it('should allow access for logged-in engineer', () => {
      authService.isLoggedIn.and.returnValue(true);
      authService.hasRole.and.callFake((r: string) => r === 'engineer');
      expect(runGuard(engineerGuard)).toBeTrue();
    });

    it('should redirect to / for non-engineer', () => {
      authService.isLoggedIn.and.returnValue(true);
      authService.hasRole.and.returnValue(false);
      expect(runGuard(engineerGuard)).toBe(rootUrlTree);
    });
  });

  describe('clientGuard', () => {
    it('should allow access for logged-in client', () => {
      authService.isLoggedIn.and.returnValue(true);
      authService.hasRole.and.callFake((r: string) => r === 'client');
      expect(runGuard(clientGuard)).toBeTrue();
    });

    it('should redirect to / for non-client', () => {
      authService.isLoggedIn.and.returnValue(true);
      authService.hasRole.and.returnValue(false);
      expect(runGuard(clientGuard)).toBe(rootUrlTree);
    });
  });
});
