// Re-export the SSR-compatible Supabase client so all code uses one consistent client.
// The admin panel imports from here — this ensures cookie-based sessions work correctly.
import { createBrowserClient } from '@supabase/ssr';

// Singleton instance — created once, reused everywhere
let instance: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseClient() {
  if (!instance) {
    instance = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return instance;
}

// Named export 'supabase' to keep existing imports working without changes
export const supabase = getSupabaseClient();
