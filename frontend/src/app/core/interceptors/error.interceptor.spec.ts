import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let consoleSpy: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    consoleSpy = spyOn(console, 'error');
  });

  afterEach(() => httpMock.verify());

  it('should pass through successful requests', () => {
    httpClient.get('/api/test/').subscribe((res) => {
      expect(res).toEqual({ ok: true });
    });

    httpMock.expectOne('/api/test/').flush({ ok: true });
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('should extract detail message from error body', () => {
    httpClient.get('/api/test/').subscribe({ error: () => {} });

    httpMock.expectOne('/api/test/').flush(
      { detail: 'Invalid credentials' },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(consoleSpy).toHaveBeenCalledWith('HTTP Error 400: Invalid credentials');
  });

  it('should show "Unable to connect" for status 0', () => {
    httpClient.get('/api/test/').subscribe({ error: () => {} });

    httpMock.expectOne('/api/test/').error(new ProgressEvent('error'), {
      status: 0, statusText: 'Unknown',
    });

    expect(consoleSpy).toHaveBeenCalledWith('HTTP Error 0: Unable to connect to the server');
  });

  it('should show "Access denied" for status 403', () => {
    httpClient.get('/api/test/').subscribe({ error: () => {} });

    httpMock.expectOne('/api/test/').flush(
      {},
      { status: 403, statusText: 'Forbidden' },
    );

    expect(consoleSpy).toHaveBeenCalledWith('HTTP Error 403: Access denied');
  });

  it('should show "Resource not found" for status 404', () => {
    httpClient.get('/api/test/').subscribe({ error: () => {} });

    httpMock.expectOne('/api/test/').flush(
      {},
      { status: 404, statusText: 'Not Found' },
    );

    expect(consoleSpy).toHaveBeenCalledWith('HTTP Error 404: Resource not found');
  });

  it('should show generic message for other errors', () => {
    httpClient.get('/api/test/').subscribe({ error: () => {} });

    httpMock.expectOne('/api/test/').flush(
      {},
      { status: 500, statusText: 'Server Error' },
    );

    expect(consoleSpy).toHaveBeenCalledWith('HTTP Error 500: An unexpected error occurred');
  });

  it('should re-throw the error', () => {
    let errorReceived = false;

    httpClient.get('/api/test/').subscribe({
      error: (err) => {
        errorReceived = true;
        expect(err.status).toBe(422);
      },
    });

    httpMock.expectOne('/api/test/').flush(
      {},
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    expect(errorReceived).toBeTrue();
  });
});
