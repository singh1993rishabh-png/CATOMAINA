import { NextResponse } from 'next/server'
import { createClient } from '@/app/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const fullName =
          user.user_metadata?.full_name ??
          user.user_metadata?.name ??
          user.email?.split('@')[0] ??
          'Student'

        // FIX: Use try/catch instead of .then().catch() to satisfy TypeScript
        try {
          await supabase.from('profiles').upsert(
            {
              id: user.id,
              name: fullName,
              avatar_url: user.user_metadata?.avatar_url ?? null,
            },
            { onConflict: 'id', ignoreDuplicates: false }
          )
        } catch (upsertError) {
          // Log the error but don't block the redirect
          console.error("Profile upsert failed:", upsertError);
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Could not sign in with Google`)
}