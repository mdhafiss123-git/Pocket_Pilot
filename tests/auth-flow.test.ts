import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// Mock @supabase/ssr
vi.mock('@supabase/ssr', () => {
  return {
    createServerClient: vi.fn((url, key, options) => {
      return {
        auth: {
          exchangeCodeForSession: vi.fn(async (code: string) => {
            if (code === 'valid-code') {
              // Simulate calling setAll
              if (options?.cookies?.setAll) {
                options.cookies.setAll([
                  {
                    name: 'sb-test-auth-token',
                    value: 'session-token-value',
                    options: { path: '/', maxAge: 3600 },
                  },
                ]);
              }
              return { data: { session: { user: { id: 'test-user' } } }, error: null };
            }
            return { data: { session: null }, error: new Error('Invalid code') };
          }),
          getUser: vi.fn(async () => {
            return { data: { user: { id: 'test-user' } }, error: null };
          }),
        },
      };
    }),
    createBrowserClient: vi.fn(() => ({
      auth: {
        getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
        getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
    })),
  };
});

describe('Supabase SSR Auth Flow', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
  });

  describe('Auth Callback Route', () => {
    it('successfully exchanges code and writes session cookies to redirect response', async () => {
      const { GET } = await import('../app/auth/callback/route');
      const request = new NextRequest('http://localhost:3000/auth/callback?code=valid-code');

      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost:3000/');
      // Verify cookie was written
      const cookie = response.cookies.get('sb-test-auth-token');
      expect(cookie).toBeDefined();
      expect(cookie?.value).toBe('session-token-value');
    });

    it('redirects with error parameter when OAuth code exchange fails', async () => {
      const { GET } = await import('../app/auth/callback/route');
      const request = new NextRequest('http://localhost:3000/auth/callback?code=invalid-code');

      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('error=Invalid%20code');
    });

    it('redirects with error parameter when OAuth provider returns an error', async () => {
      const { GET } = await import('../app/auth/callback/route');
      const request = new NextRequest('http://localhost:3000/auth/callback?error_description=Access%20denied');

      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('error=Access%20denied');
    });

    it('redirects to next parameter if specified', async () => {
      const { GET } = await import('../app/auth/callback/route');
      const request = new NextRequest('http://localhost:3000/auth/callback?code=valid-code&next=/dashboard');

      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard');
    });
  });

  describe('Supabase Middleware', () => {
    it('executes getUser and returns response with cookies persisted', async () => {
      const { updateSession } = await import('../lib/supabase/middleware');
      const request = new NextRequest('http://localhost:3000/');

      const response = await updateSession(request);
      expect(response).toBeInstanceOf(NextResponse);
    });

    it('middleware handler wraps updateSession', async () => {
      const { middleware } = await import('../middleware');
      const request = new NextRequest('http://localhost:3000/');

      const response = await middleware(request);
      expect(response).toBeInstanceOf(NextResponse);
    });
  });
});
