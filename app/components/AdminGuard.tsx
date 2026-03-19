'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function verify() {
      try {
        // Step 1: Check localStorage quick flag (fast UX)
        const quickFlag = localStorage.getItem('isLoggedIn');
        if (quickFlag !== 'true') {
          router.replace('/admin');
          return;
        }

        // Step 2: Verify real Supabase session exists
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          localStorage.removeItem('isLoggedIn');
          localStorage.removeItem('adminUser');
          router.replace('/admin');
          return;
        }

        // Step 3: Verify user is actually in admin_profiles table
        const { data: profile, error: profileError } = await supabase
          .from('admin_profiles')
          .select('id, username')
          .eq('id', user.id)
          .single();

        if (profileError || !profile) {
          // Valid Supabase user but NOT an admin — sign them out and redirect
          await supabase.auth.signOut();
          localStorage.removeItem('isLoggedIn');
          localStorage.removeItem('adminUser');
          router.replace('/admin');
          return;
        }

        // All three checks passed — genuine admin
        setVerified(true);
      } catch {
        router.replace('/admin');
      } finally {
        setChecking(false);
      }
    }

    verify();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, supabase]);

  if (checking || !verified) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm font-bold uppercase tracking-widest">
            {checking ? 'Verifying access...' : 'Redirecting...'}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
