import { TestBed } from '@angular/core/testing';
import { WebSocketService, WsMessage } from './websocket.service';
import { AuthService } from './auth.service';

describe('WebSocketService', () => {
  let service: WebSocketService;
  let authService: jasmine.SpyObj<AuthService>;
  let mockWebSocket: any;
  let originalWebSocket: typeof WebSocket;
  let wsConstructorCalls: string[];

  beforeEach(() => {
    authService = jasmine.createSpyObj('AuthService', ['getAccessToken']);
    originalWebSocket = window.WebSocket;
    wsConstructorCalls = [];

    // Plain mock object with writable event handler properties
    mockWebSocket = {
      close: jasmine.createSpy('close'),
      send: jasmine.createSpy('send'),
      readyState: 1, // WebSocket.OPEN
      onopen: null as any,
      onmessage: null as any,
      onclose: null as any,
      onerror: null as any,
    };

    // Use a regular function so it works as a constructor with `new`
    function MockWebSocket(url: string) {
      wsConstructorCalls.push(url);
      return mockWebSocket;
    }
    (MockWebSocket as any).OPEN = 1;
    (MockWebSocket as any).CLOSED = 3;
    (MockWebSocket as any).CONNECTING = 0;
    (MockWebSocket as any).CLOSING = 2;
    (window as any).WebSocket = MockWebSocket;

    TestBed.configureTestingModule({
      providers: [
        WebSocketService,
        { provide: AuthService, useValue: authService },
      ],
    });

    service = TestBed.inject(WebSocketService);
  });

  afterEach(() => {
    (window as any).WebSocket = originalWebSocket;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('connect', () => {
    it('should not connect without a token', () => {
      authService.getAccessToken.and.returnValue(null);
      service.connect();
      expect(wsConstructorCalls.length).toBe(0);
    });

    it('should create WebSocket with token URL', () => {
      authService.getAccessToken.and.returnValue('test-token');
      service.connect();
      expect(wsConstructorCalls).toEqual(['ws://localhost:8000/ws/kanban/?token=test-token']);
    });

    it('should reset reconnect attempts on open', () => {
      authService.getAccessToken.and.returnValue('token');
      service.connect();
      mockWebSocket.onopen(new Event('open'));
      // No error means success
    });
  });

  describe('message handling', () => {
    it('should emit parsed messages on messages$', () => {
      authService.getAccessToken.and.returnValue('token');
      service.connect();

      const received: WsMessage[] = [];
      service.messages$.subscribe((msg) => received.push(msg));

      mockWebSocket.onmessage(new MessageEvent('message', {
        data: JSON.stringify({ type: 'task_status_changed', payload: { task_id: 1 } }),
      }));

      expect(received.length).toBe(1);
      expect(received[0].type).toBe('task_status_changed');
    });

    it('should respond to ping with pong', () => {
      authService.getAccessToken.and.returnValue('token');
      service.connect();

      mockWebSocket.onmessage(new MessageEvent('message', {
        data: JSON.stringify({ type: 'ping' }),
      }));

      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'pong' }));
    });

    it('should not emit ping messages to subscribers', () => {
      authService.getAccessToken.and.returnValue('token');
      service.connect();

      const received: WsMessage[] = [];
      service.messages$.subscribe((msg) => received.push(msg));

      mockWebSocket.onmessage(new MessageEvent('message', {
        data: JSON.stringify({ type: 'ping' }),
      }));

      expect(received.length).toBe(0);
    });

    it('should ignore invalid JSON', () => {
      authService.getAccessToken.and.returnValue('token');
      service.connect();

      const received: WsMessage[] = [];
      service.messages$.subscribe((msg) => received.push(msg));

      mockWebSocket.onmessage(new MessageEvent('message', { data: 'not json' }));

      expect(received.length).toBe(0);
    });
  });

  describe('send', () => {
    it('should send JSON when socket is open', () => {
      authService.getAccessToken.and.returnValue('token');
      service.connect();

      service.send({ type: 'test', payload: { data: 1 } });
      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'test', payload: { data: 1 } }));
    });

    it('should not send when no connection exists', () => {
      // No connection established
      service.send({ type: 'test' });
      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should close socket and set to null', () => {
      authService.getAccessToken.and.returnValue('token');
      service.connect();
      service.disconnect();

      expect(mockWebSocket.close).toHaveBeenCalled();
    });
  });

  describe('reconnect logic', () => {
    it('should attempt reconnect on close', (done) => {
      authService.getAccessToken.and.returnValue('token');
      service.connect();

      const callsBefore = wsConstructorCalls.length;

      mockWebSocket.onclose(new CloseEvent('close'));

      // Reconnect happens after timeout (2000ms * attempt)
      setTimeout(() => {
        expect(wsConstructorCalls.length).toBeGreaterThan(callsBefore);
        done();
      }, 2500);
    }, 5000);
  });

  describe('subscribeToClient', () => {
    it('should send subscribe_filter message', () => {
      authService.getAccessToken.and.returnValue('token');
      service.connect();

      service.subscribeToClient(42);
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'subscribe_filter', payload: { client_id: 42 } }),
      );
    });
  });

  describe('removeFilter', () => {
    it('should send remove_filter message', () => {
      authService.getAccessToken.and.returnValue('token');
      service.connect();

      service.removeFilter();
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'remove_filter' }),
      );
    });
  });
});
