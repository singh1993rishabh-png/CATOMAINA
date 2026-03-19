'use client';

import React, { useState, Suspense, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { createClient } from '@/app/utils/supabase/client';
import Link from 'next/link';
import { signup } from '../login/action';

function ParticleField() {
  const ref = useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d')!; let id: number;
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
    resize(); window.addEventListener('resize', resize);
    const pts = Array.from({ length: 50 }, () => ({
      x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
      vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35, r: 1 + Math.random() * 1.5,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = c.width; if (p.x > c.width) p.x = 0;
        if (p.y < 0) p.y = c.height; if (p.y > c.height) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(249,115,22,0.2)'; ctx.fill();
      });
      id = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} className="fixed inset-0 z-0 pointer-events-none" />;
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function SignupContent() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');
  const urlMessage = searchParams.get('message');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({ Firstname: '', Lastname: '', email: '', password: '', confirm: '' });

  const handleGoogleSignup = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setLocalError(error.message); setGoogleLoading(false); }
    // On success: browser redirects to Google, so no need to reset loading
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(''); setSuccess('');
    if (formData.password !== formData.confirm) { setLocalError('Passwords do not match.'); return; }
    if (formData.password.length < 6) { setLocalError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    const data = new FormData();
    data.append('email', formData.email);
    data.append('password', formData.password);
    data.append('Firstname', formData.Firstname);
    data.append('Lastname', formData.Lastname);
    try {
      await signup(data);
      setSuccess('Account created! Check your email to confirm.');
    } catch (err: any) {
      setLocalError(err?.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const inp = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-orange-500/50 transition";

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(249,115,22,0.1),transparent)]" />
      <div className="fixed inset-0 z-0 opacity-[0.025]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
      <ParticleField />

      <motion.div initial={{ opacity: 0, y: 24, filter: 'blur(12px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md">

        <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-[0_40px_80px_rgba(0,0,0,0.6)]">
          {/* Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Logo */}
          <div className="text-center mb-7">
            <Link href="/" className="inline-flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-[0_0_16px_rgba(249,115,22,0.4)]">
                <span className="text-white font-black text-base">C</span>
              </div>
              <span className="text-white font-black text-lg tracking-tight">CAT<span className="text-orange-500">OMAINA</span></span>
            </Link>
            <h2 className="text-white font-black text-2xl tracking-tight">Create your account</h2>
            <p className="text-gray-600 text-sm mt-1">Start your CAT prep journey today</p>
          </div>

          {/* Alerts */}
          {(localError || urlError) && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/25 rounded-xl text-red-400 text-xs text-center">
              {localError || urlError}
            </div>
          )}
          {(success || urlMessage) && (
            <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-emerald-400 text-xs text-center">
              {success || urlMessage}
            </div>
          )}

          {/* Google */}
          <motion.button onClick={handleGoogleSignup} disabled={googleLoading}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-6 bg-white rounded-2xl font-bold text-gray-800 text-sm shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_6px_25px_rgba(0,0,0,0.4)] transition-all disabled:opacity-60 mb-5">
            {googleLoading ? <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" /> : <GoogleIcon />}
            {googleLoading ? 'Connecting...' : 'Continue with Google'}
          </motion.button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-white/8" />
            <span className="text-gray-700 text-[11px] font-bold uppercase tracking-widest">or with email</span>
            <div className="flex-1 h-px bg-white/8" />
          </div>

          {/* Email form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input type="text" required placeholder="First name" value={formData.Firstname}
                onChange={e => setFormData(p => ({...p, Firstname: e.target.value}))} className={inp} />
              <input type="text" required placeholder="Last name" value={formData.Lastname}
                onChange={e => setFormData(p => ({...p, Lastname: e.target.value}))} className={inp} />
            </div>
            <input type="email" required placeholder="Email address" value={formData.email}
              onChange={e => setFormData(p => ({...p, email: e.target.value}))} className={inp} />
            <input type="password" required placeholder="Password (min 6 chars)" value={formData.password}
              onChange={e => setFormData(p => ({...p, password: e.target.value}))} className={inp} />
            <input type="password" required placeholder="Confirm password" value={formData.confirm}
              onChange={e => setFormData(p => ({...p, confirm: e.target.value}))} className={inp} />

            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-black text-sm hover:opacity-90 transition disabled:opacity-50 shadow-[0_0_20px_rgba(249,115,22,0.25)] mt-1">
              {loading ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating account...</span> : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-gray-600 text-xs mt-5">
            Already have an account?{' '}
            <Link href="/login" className="text-orange-400 hover:text-orange-300 font-bold transition">Sign in</Link>
          </p>
        </div>

        {/* Floating accents */}
        <motion.div animate={{ y: [-5, 5, -5] }} transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
          className="absolute -top-5 -right-5 w-10 h-10 rounded-2xl bg-orange-500/20 border border-orange-500/20 backdrop-blur-sm" />
        <motion.div animate={{ y: [5, -5, 5] }} transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
          className="absolute -bottom-4 -left-5 w-7 h-7 rounded-xl bg-red-500/15 border border-red-500/15 backdrop-blur-sm" />
      </motion.div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050505]" />}>
      <SignupContent />
    </Suspense>
  );
}
