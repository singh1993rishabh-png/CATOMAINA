'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import { LayoutDashboard, LogOut, BookOpen, Info, Menu, X, GraduationCap } from 'lucide-react';

const Navbar = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  // Hide navbar on admin and test pages (exam must be fullscreen)
  if (pathname?.startsWith('/admin') || pathname?.startsWith('/test/')) return null;

  if (loading) return <nav className="h-16 bg-[#050505] border-b border-white/8 sticky top-0 z-50" />;

  return (
    <nav className="sticky top-0 z-50 bg-[#050505]/90 backdrop-blur-xl border-b border-white/8">
      <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-[0_0_12px_rgba(249,115,22,0.4)] group-hover:shadow-[0_0_20px_rgba(249,115,22,0.6)] transition-all">
            <span className="text-white font-black text-xs">C</span>
          </div>
          <span className="text-white font-black text-base tracking-tight">
            CAT<span className="text-orange-500">OMAINA</span>
          </span>
        </Link>

        {/* Center links (desktop) */}
        <div className="hidden md:flex items-center gap-6">
          {user ? (
            <>
              <Link href="/dashboard" className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest transition ${pathname === '/dashboard' ? 'text-orange-400' : 'text-gray-500 hover:text-white'}`}>
                <LayoutDashboard size={13} />Dashboard
              </Link>
              <Link href="/mocktest" className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest transition ${pathname === '/mocktest' ? 'text-orange-400' : 'text-gray-500 hover:text-white'}`}>
                <BookOpen size={13} />Practice
              </Link>
              <Link href="/study" className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest transition ${pathname?.startsWith('/study') ? 'text-orange-400' : 'text-gray-500 hover:text-white'}`}>
                <GraduationCap size={13} />Study
              </Link>
            </>
          ) : (
            <>
              {/* <Link href="/blog" className="text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-white transition">Blog</Link> */}
              {/* <Link href="/about" className="text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-white transition">About</Link> */}
            </>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {/* Avatar dot */}
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-[9px] font-black text-white">
                  {user.email?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <span className="text-white text-xs font-bold truncate max-w-20">{user.email?.split('@')[0]}</span>
              </div>
              <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition text-xs font-bold">
                <LogOut size={13} />Logout
              </button>
            </>
          ) : (
            <>
              {/* <Link href="/login" className="text-xs font-bold text-gray-500 hover:text-white transition px-3 py-2">
                Sign in
              </Link> */}
              <Link href="/login" className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-black text-xs hover:opacity-90 transition shadow-[0_0_15px_rgba(249,115,22,0.3)]">
                Get Started →
              </Link>
            </>
          )}
          {/* Mobile menu toggle */}
          <button className="md:hidden p-2 text-gray-400 hover:text-white" onClick={() => setMenuOpen(o => !o)}>
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden border-t border-white/8 bg-[#050505] px-5 py-4 space-y-3">
          {user ? (
            <>
              <Link href="/dashboard" className="block text-sm font-bold text-gray-300" onClick={() => setMenuOpen(false)}>Dashboard</Link>
              <Link href="/mocktest" className="block text-sm font-bold text-gray-300" onClick={() => setMenuOpen(false)}>Practice</Link>
              <Link href="/study" className="block text-sm font-bold text-gray-300" onClick={() => setMenuOpen(false)}>Study</Link>
              <button onClick={handleLogout} className="block text-sm font-bold text-red-400">Logout</button>
            </>
          ) : (
            <>
              <Link href="/login" className="block text-sm font-bold text-gray-300" onClick={() => setMenuOpen(false)}>Sign in</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
