import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Exchanges the OAuth callback authorization code for a Supabase session
 * and writes the session cookies into the redirect response.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const oauthError = searchParams.get('error_description') || searchParams.get('error');

  let next = searchParams.get('next') ?? '/';
  if (!next.startsWith('/')) {
    next = '/';
  }

  const forwardedHost = request.headers.get('x-forwarded-host');
  const isLocalEnv = process.env.NODE_ENV === 'development';
  const redirectOrigin = (!isLocalEnv && forwardedHost) ? `https://${forwardedHost}` : origin;

  if (oauthError) {
    console.error(`OAuth provider returned error: ${oauthError}`);
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(oauthError)}`, redirectOrigin));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/', redirectOrigin));
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase credentials missing in auth callback.');
    return NextResponse.redirect(new URL('/?error=Supabase+credentials+missing', redirectOrigin));
  }

  const response = NextResponse.redirect(new URL(next, redirectOrigin));

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('Error exchanging code for session:', error.message);
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error.message)}`, redirectOrigin)
    );
  }

  return response;
}
