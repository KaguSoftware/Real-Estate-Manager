import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes a signed-in user may visit BEFORE they belong to a team.
// Includes the public legal pages (linked from signup/landing/footer).
const NO_TEAM_ALLOWED = [
  /^\/onboarding/, /^\/join\//, /^\/auth\//, /^\/api\//, /^\/reset-password/,
  /^\/kullanim-kosullari/, /^\/gizlilik-politikasi/, /^\/kvkk-aydinlatma/,
]

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return supabaseResponse // unauthenticated UX is handled client-side

  const { pathname } = request.nextUrl

  // Already signed in — /login and /signup have nothing to offer; send them
  // home (the no-team rule below then bounces team-less users to /onboarding).
  if (pathname.startsWith('/login') || pathname.startsWith('/signup')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  const allowedWithoutTeam = NO_TEAM_ALLOWED.some((re) => re.test(pathname))

  // Single indexed PK lookup; RLS-safe (user can always read their own row).
  const { data: membership } = await supabase
    .from('team_members')
    .select('team_id')
    .maybeSingle()

  if (!membership && !allowedWithoutTeam) {
    const url = request.nextUrl.clone()
    url.pathname = '/onboarding'
    url.search = ''
    return NextResponse.redirect(url)
  }
  if (membership && pathname.startsWith('/onboarding')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
