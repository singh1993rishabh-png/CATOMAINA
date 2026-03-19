'use client';

import React, { useEffect, useRef, useState, Suspense, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';

// ── Floating 3D particles canvas ─────────────────────────────
function ParticleField() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    let id: number;
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
    resize(); window.addEventListener('resize', resize);

    type P = { x:number;y:number;z:number;vx:number;vy:number;r:number };
    const pts: P[] = Array.from({ length: 60 }, () => ({
      x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
      z: Math.random(), vx: (Math.random() - .5) * .4, vy: (Math.random() - .5) * .4,
      r: 1.5 + Math.random() * 2,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = c.width; if (p.x > c.width) p.x = 0;
        if (p.y < 0) p.y = c.height; if (p.y > c.height) p.y = 0;
        const alpha = 0.15 + p.z * 0.25;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.5 + p.z), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(249,115,22,${alpha})`; ctx.fill();
      });
      // Draw connections
      pts.forEach((a, i) => pts.slice(i + 1).forEach(b => {
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 120) {
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(249,115,22,${0.06 * (1 - d / 120)})`; ctx.lineWidth = .5; ctx.stroke();
        }
      }));
      id = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} className="fixed inset-0 z-0 pointer-events-none" />;
}

// ── 3D Floating Card ─────────────────────────────────────────
function FloatingCard({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(1000px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateZ(20px)`;
  };
  const onLeave = () => { if (ref.current) ref.current.style.transform = 'perspective(1000px) rotateY(0) rotateX(0) translateZ(0)'; };
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}
      style={{ transition: 'transform 0.25s ease-out', willChange: 'transform' }}>
      {children}
    </div>
  );
}

// ── Google Icon ───────────────────────────────────────────────
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

function LoginContent() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [phase] = useState<'login'>('login'); // always 'login'

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
    if (error) {
      console.error(error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Bg layers */}
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(249,115,22,0.12),transparent)]" />
      <div className="fixed inset-0 z-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
      <ParticleField />

      <AnimatePresence mode="wait">
        {phase === 'login' && (
          <motion.div key="login" initial={{ opacity: 0, y: 30, filter: 'blur(12px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 1.05, filter: 'blur(15px)' }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-full max-w-sm"
          >
            <FloatingCard>
              <div className="bg-white/4 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-[0_40px_80px_rgba(0,0,0,0.6)]">
                {/* Glow orb inside card */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-orange-500/20 rounded-full blur-3xl pointer-events-none" />

                {/* Logo */}
                <div className="text-center mb-8 relative">
                  <motion.div className="inline-flex items-center gap-3 mb-4"
                    initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.5)]">
                      <span className="text-white font-black text-xl">C</span>
                    </div>
                    <div className="text-left">
                      <h1 className="text-white font-black text-xl tracking-tight leading-none">
                        CAT<span className="text-orange-500">OMAINA</span>
                      </h1>
                      <p className="text-gray-600 text-[10px] uppercase tracking-widest font-bold mt-0.5">CAT Exam Prep</p>
                    </div>
                  </motion.div>

                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                    <h2 className="text-white font-black text-2xl tracking-tight">Welcome back</h2>
                    <p className="text-gray-600 text-sm mt-1">Sign in to continue your CAT prep journey</p>
                  </motion.div>
                </div>

                {/* Google Button */}
                <motion.button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-white rounded-2xl font-bold text-gray-800 text-sm shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] transition-all disabled:opacity-60"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
                  ) : (
                    <GoogleIcon />
                  )}
                  {loading ? 'Connecting...' : 'Continue with Google'}
                </motion.button>

                {/* Divider hint */}
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
                  className="text-center text-gray-700 text-[11px] mt-5 leading-relaxed">
                  Secure sign-in via Google OAuth.<br />
                  Your data stays private.
                </motion.p>

                {/* Feature pills */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
                  className="flex items-center justify-center gap-2 mt-5 flex-wrap">
                  {['📊 Mock Tests', '🧠 Drill Mode', '🏆 Leaderboard'].map(f => (
                    <span key={f} className="text-[10px] font-bold text-gray-600 bg-white/4 border border-white/8 px-2.5 py-1 rounded-full">{f}</span>
                  ))}
                </motion.div>
              </div>
            </FloatingCard>

            {/* Floating 3D accent elements */}
            <motion.div animate={{ y: [-6, 6, -6] }} transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
              className="absolute -top-6 -right-6 w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500/30 to-red-500/20 border border-orange-500/20 backdrop-blur-sm z-0" />
            <motion.div animate={{ y: [6, -6, 6] }} transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
              className="absolute -bottom-4 -left-6 w-8 h-8 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/10 border border-yellow-500/15 backdrop-blur-sm z-0" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050505]" />}>
      <LoginContent />
    </Suspense>
  );
}
