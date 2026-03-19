'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { motion } from 'framer-motion';
import { ShieldCheck, Eye, EyeOff } from 'lucide-react';

function Particles() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d')!; let id: number;
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
    resize(); window.addEventListener('resize', resize);
    const pts = Array.from({ length: 40 }, () => ({
      x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
      vx: (Math.random()-.5)*.3, vy: (Math.random()-.5)*.3, r: 1+Math.random()*1.5
    }));
    const draw = () => {
      ctx.clearRect(0,0,c.width,c.height);
      pts.forEach(p => {
        p.x+=p.vx; p.y+=p.vy;
        if(p.x<0)p.x=c.width; if(p.x>c.width)p.x=0;
        if(p.y<0)p.y=c.height; if(p.y>c.height)p.y=0;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.fillStyle='rgba(249,115,22,0.2)'; ctx.fill();
      });
      pts.forEach((a,i)=>pts.slice(i+1).forEach(b=>{
        const d=Math.hypot(a.x-b.x,a.y-b.y);
        if(d<100){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
          ctx.strokeStyle=`rgba(249,115,22,${0.05*(1-d/100)})`;ctx.lineWidth=.5;ctx.stroke();}
      }));
      id=requestAnimationFrame(draw);
    };
    draw();
    return ()=>{cancelAnimationFrame(id);window.removeEventListener('resize',resize);};
  },[]);
  return <canvas ref={ref} className="fixed inset-0 z-0 pointer-events-none"/>;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);

  const onMove = (e: React.MouseEvent) => {
    const el = cardRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(1000px) rotateY(${x*10}deg) rotateX(${-y*10}deg) translateZ(15px)`;
  };
  const onLeave = () => { if (cardRef.current) cardRef.current.style.transform = 'perspective(1000px) rotateY(0) rotateX(0) translateZ(0)'; };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const email = `${formData.username}@admin.com`;
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password: formData.password });
      if (authError) throw authError;
      const { data: profile, error: profileError } = await supabase.from('admin_profiles').select('*').eq('id', authData.user.id).single();
      if (profileError || !profile) { await supabase.auth.signOut(); throw new Error('Not authorised as admin'); }
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('adminUser', profile.username);
      router.push('/admin/adminpanel');
    } catch (err: any) {
      setError(err.message === 'Invalid login credentials' ? 'Wrong username or password' : err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_50%_40%_at_50%_0%,rgba(249,115,22,0.1),transparent)]"/>
      <div className="fixed inset-0 z-0 opacity-[0.025]" style={{backgroundImage:'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)',backgroundSize:'40px 40px'}}/>
      <Particles/>

      <motion.div initial={{opacity:0,y:30,filter:'blur(12px)'}} animate={{opacity:1,y:0,filter:'blur(0px)'}} transition={{duration:0.7,ease:[0.22,1,0.36,1]}} className="relative z-10 w-full max-w-sm">
        <div ref={cardRef} onMouseMove={onMove} onMouseLeave={onLeave} style={{transition:'transform 0.25s ease-out',willChange:'transform'}}>
          <div className="bg-white/4 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-[0_40px_80px_rgba(0,0,0,0.7)]">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 w-24 h-24 bg-orange-500/15 rounded-full blur-3xl pointer-events-none"/>

            {/* Logo */}
            <div className="text-center mb-7">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 mb-4 shadow-[0_0_25px_rgba(249,115,22,0.5)]">
                <ShieldCheck size={26} className="text-white"/>
              </div>
              <h1 className="text-white font-black text-xl tracking-tight">Admin Portal</h1>
              <p className="text-orange-500 font-black text-sm tracking-wider mt-0.5">CATOMAINA</p>
              <p className="text-gray-600 text-xs mt-1">Restricted access — authorised personnel only</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}}
                  className="p-3 bg-red-500/10 border border-red-500/25 rounded-xl text-red-400 text-xs text-center">
                  {error}
                </motion.div>
              )}

              <div>
                <label className="text-gray-600 text-[10px] uppercase tracking-widest font-bold block mb-1.5">Username</label>
                <input name="username" type="text" required value={formData.username}
                  onChange={e => setFormData(p => ({...p, username: e.target.value}))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-700 focus:outline-none focus:border-orange-500/50 transition"
                  placeholder="your_username"/>
              </div>

              <div>
                <label className="text-gray-600 text-[10px] uppercase tracking-widest font-bold block mb-1.5">Password</label>
                <div className="relative">
                  <input name="password" type={showPw ? 'text' : 'password'} required value={formData.password}
                    onChange={e => setFormData(p => ({...p, password: e.target.value}))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-700 focus:outline-none focus:border-orange-500/50 transition pr-10"
                    placeholder="••••••••"/>
                  <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                    {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
              </div>

              <button disabled={loading} type="submit"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-black text-sm hover:opacity-90 transition disabled:opacity-50 shadow-[0_0_20px_rgba(249,115,22,0.3)] mt-2">
                {loading ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Verifying...</span> : 'Enter Admin Panel'}
              </button>
            </form>
          </div>
        </div>

        {/* 3D floating accents */}
        <motion.div animate={{y:[-5,5,-5]}} transition={{repeat:Infinity,duration:4,ease:'easeInOut'}}
          className="absolute -top-5 -right-5 w-10 h-10 rounded-2xl bg-orange-500/20 border border-orange-500/20 backdrop-blur-sm"/>
        <motion.div animate={{y:[5,-5,5]}} transition={{repeat:Infinity,duration:5,ease:'easeInOut'}}
          className="absolute -bottom-4 -left-5 w-7 h-7 rounded-xl bg-red-500/15 border border-red-500/15 backdrop-blur-sm"/>
      </motion.div>
    </div>
  );
}
