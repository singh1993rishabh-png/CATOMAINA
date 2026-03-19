'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { motion, type Variants } from 'framer-motion';
import { createClient } from '../utils/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Clock, LogIn, Flame, TrendingUp, Brain, BarChart2, Play, ChevronRight, GraduationCap, FileText, Video, HelpCircle } from 'lucide-react';
import { Leaderboard } from '../components/leaderboard';
import DailyContestCard from '../components/quizz';
import StudentProfileCard from '../components/studentprofile';

import ActiveContestsSection from '../components/activecontest';



// ── Activity Card — Last Login + Time Spent ───────────────────
//
// Architecture (all bugs fixed):
//
// - "Session" = seconds since THIS page load (window.performance.now based)
//   → never stored, never double-counted, always fresh
//
// - "Today" = DB today_secs (loaded once) + current session seconds
//   → DB value is the accumulated total BEFORE this session started
//   → display = dbToday + sessionSecs   (no double counting)
//
// - "All Time" = DB total_secs (loaded once) + current session seconds
//   → same pattern
//
// - Save to DB: writes (dbToday + sessionSecs) and (dbTotal + sessionSecs)
//   → after each save we do NOT update dbToday/dbTotal refs — we keep them
//     as "value at session start" and always add fresh sessionSecs on top.
//     This is correct: dbToday + sessionSecs = total today including this session.
//
// - Midnight reset: if today_date in DB ≠ today, dbToday = 0 (new day)
//   DB write sends today_secs=sessionSecs (starts fresh for today)
//
// - lastLoginAt: stored in profiles.last_login_at by THIS code on mount,
//   so it always reflects the *previous* login, not the current one.

function ActivityCard({ userId, lastLoginAt }: { userId: string; lastLoginAt: string | null }) {
  const supabase = useMemo(() => createClient(), []);

  const [sessionSecs, setSessionSecs] = useState(0);
  const [todaySecs,   setTodaySecs]   = useState(0);
  const [totalSecs,   setTotalSecs]   = useState<number | null>(null);
  const [prevLogin,   setPrevLogin]   = useState<string | null>(null);
  const [synced,      setSynced]      = useState(false);

  // DB values at session start — never change after mount
  const dbToday = useRef(0);
  const dbTotal = useRef(0);
  // Ref always holds latest session seconds for saves
  const sessionRef = useRef(0);
  const savingRef  = useRef(false);
  // Session start timestamp (ms) — set once on mount
  const sessionStart = useRef(Date.now());

  function fmtRelative(iso: string | null): string {
    if (!iso) return '—';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60)     return 'Just now';
    if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 172800) return 'Yesterday';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  function fmtDuration(s: number): string {
    if (s <= 0) return '0m';
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return `${sec}s`;
  }

  // Save: always writes dbToday + sessionElapsed (correct — no drift)
  const saveToDb = useCallback(async (sessionElapsed: number) => {
    if (!userId || savingRef.current) return;
    savingRef.current = true;
    try {
      await supabase.from('profiles').update({
        today_secs: dbToday.current + sessionElapsed,
        total_secs: dbTotal.current + sessionElapsed,
        today_date: new Date().toISOString().split('T')[0],
      }).eq('id', userId);
    } finally {
      savingRef.current = false;
    }
  }, [userId, supabase]);

  useEffect(() => {
    if (!userId) return;

    (async () => {
      // 1. Load DB values
      const { data } = await supabase
        .from('profiles')
        .select('today_secs, today_date, total_secs, last_login_at')
        .eq('id', userId)
        .single();

      const todayStr = new Date().toISOString().split('T')[0];
      // If today_date in DB is a past day, today starts at 0
      const loadedToday = (data?.today_date === todayStr) ? (data?.today_secs ?? 0) : 0;
      const loadedTotal = data?.total_secs ?? 0;

      dbToday.current = loadedToday;
      dbTotal.current = loadedTotal;

      // Display prev login BEFORE we overwrite it
      setPrevLogin(data?.last_login_at ?? lastLoginAt ?? null);

      // Update last_login_at to now (so next visit shows this login as "previous")
      await supabase.from('profiles')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', userId);

      // Set initial display values (session=0 at this point)
      setTodaySecs(loadedToday);
      setTotalSecs(loadedTotal);
      setSynced(true);
    })();

    // 2. Tick every second
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - sessionStart.current) / 1000);
      sessionRef.current = elapsed;
      setSessionSecs(elapsed);
      // Display = DB base + current session (always correct, no drift)
      setTodaySecs(dbToday.current + elapsed);
      setTotalSecs(dbTotal.current + elapsed);
    }, 1000);

    // 3. Save to DB every 30s
    const saveInterval = setInterval(() => {
      saveToDb(sessionRef.current);
    }, 30_000);

    // 4. Save on tab hide
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') saveToDb(sessionRef.current);
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      clearInterval(saveInterval);
      document.removeEventListener('visibilitychange', onVisibility);
      saveToDb(sessionRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, supabase, saveToDb]);

  const loginFull = prevLogin
    ? new Date(prevLogin).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      + ' · ' + new Date(prevLogin).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-4 flex flex-col gap-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center">
            <Flame size={13} className="text-orange-400" />
          </div>
          <span className="text-white font-black text-xs">Activity</span>
        </div>
        <span className={`flex items-center gap-1 text-[10px] font-bold ${synced ? 'text-emerald-400' : 'text-gray-600'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${synced ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
          {synced ? 'LIVE' : 'SYNCING…'}
        </span>
      </div>

      {/* Last login */}
      <div className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
        <div className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
          <LogIn size={12} className="text-indigo-400" />
        </div>
        <div className="min-w-0">
          <p className="text-gray-600 text-[9px] font-bold uppercase tracking-widest mb-0.5">Last Login</p>
          <p className="text-white text-xs font-bold">{fmtRelative(prevLogin)}</p>
          <p className="text-gray-700 text-[10px] truncate">{loginFull}</p>
        </div>
      </div>

      {/* Session + Today */}
      <div className="grid grid-cols-2 gap-2">
        <div className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock size={10} className="text-yellow-400" />
            <p className="text-gray-600 text-[9px] font-bold uppercase tracking-widest">Session</p>
          </div>
          <p className="text-yellow-400 font-black text-sm tabular-nums">{fmtDuration(sessionSecs)}</p>
          <p className="text-gray-700 text-[9px] mt-0.5">This visit</p>
        </div>
        <div className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
          <div className="flex items-center gap-1.5 mb-1">
            <Flame size={10} className="text-orange-400" />
            <p className="text-gray-600 text-[9px] font-bold uppercase tracking-widest">Today</p>
          </div>
          <p className="text-orange-400 font-black text-sm tabular-nums">{fmtDuration(todaySecs)}</p>
          <p className="text-gray-700 text-[9px] mt-0.5">Total today</p>
        </div>
      </div>

      {/* All time */}
      <div className="px-3 py-2.5 rounded-xl bg-gradient-to-r from-purple-500/8 to-indigo-500/8 border border-purple-500/15">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={10} className="text-purple-400" />
            <p className="text-gray-600 text-[9px] font-bold uppercase tracking-widest">All Time</p>
          </div>
          <p className="text-purple-400 font-black text-sm tabular-nums">
            {totalSecs === null ? '…' : fmtDuration(totalSecs)}
          </p>
        </div>
        <p className="text-gray-700 text-[9px] mt-0.5">Synced across all devices</p>
      </div>

    </div>
  );
}

// ── Insight Mini Card ─────────────────────────────────────────
function InsightMiniCard({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [count,    setCount]    = useState<number | null>(null);
  const [latest,   setLatest]   = useState<number | null>(null);
  const [trend,    setTrend]    = useState<'up'|'down'|'flat'>('flat');

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('contest_results')
      .select('id, score, total_marks')
      .eq('user_id', userId)
      .order('id', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        setCount(data.length);
        const pct = (r: any) => r.total_marks > 0 ? Math.round((r.score / r.total_marks) * 100) : 0;
        const latest = pct(data[0]);
        setLatest(latest);
        if (data.length >= 2) {
          const prev = pct(data[1]);
          setTrend(latest - prev > 5 ? 'up' : latest - prev < -5 ? 'down' : 'flat');
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, supabase]);

  return (
    <Link href="/dashboard/insight" className="block rounded-2xl bg-white/[0.03] border border-white/[0.07] p-4 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all group">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
            <Brain size={13} className="text-purple-400" />
          </div>
          <span className="text-white font-black text-xs">Student Insight</span>
        </div>
        <ChevronRight size={14} className="text-gray-600 group-hover:text-purple-400 transition-colors group-hover:translate-x-0.5 transition-transform" />
      </div>
      {count === null ? (
        <p className="text-gray-600 text-xs">Take a test to unlock insights</p>
      ) : (
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-black text-purple-400 tabular-nums">{latest ?? '—'}%</p>
            <p className="text-gray-600 text-[10px] mt-0.5">Latest score · {count} test{count !== 1 ? 's' : ''}</p>
          </div>
          <div className={`text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
            trend === 'up' ? 'text-emerald-400 bg-emerald-500/10' :
            trend === 'down' ? 'text-red-400 bg-red-500/10' :
            'text-gray-500 bg-white/5'
          }`}>
            {trend === 'up' ? '↑ Improving' : trend === 'down' ? '↓ Declining' : '→ Stable'}
          </div>
        </div>
      )}
      <p className="text-purple-400/60 text-[10px] mt-2 font-bold group-hover:text-purple-400 transition-colors">
        View full analysis →
      </p>
    </Link>
  );
}

// ── Drill Mini Card ───────────────────────────────────────────
function DrillMiniCard() {
  return (
    <Link href="/dashboard/drill" className="block rounded-2xl bg-white/[0.03] border border-white/[0.07] p-4 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all group">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
            <Play size={12} className="text-purple-400 fill-purple-400" />
          </div>
          <span className="text-white font-black text-xs">Student Drill</span>
        </div>
        <ChevronRight size={14} className="text-gray-600 group-hover:text-purple-400 transition-colors group-hover:translate-x-0.5 transition-transform" />
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {['Topic', 'Sectional', 'Full Mock', 'PYQ', 'Custom'].map(m => (
          <span key={m} className="text-[9px] font-bold uppercase tracking-wider text-gray-600 bg-white/5 border border-white/8 px-2 py-0.5 rounded-full">{m}</span>
        ))}
      </div>
      <p className="text-gray-600 text-xs leading-relaxed">Configure difficulty, subject, count & timing then launch.</p>
      <p className="text-purple-400/60 text-[10px] mt-2 font-bold group-hover:text-purple-400 transition-colors">
        Configure & launch →
      </p>
    </Link>
  );
}


// ── Study Mini Card ───────────────────────────────────────────
function StudyMiniCard() {
  const supabase = useMemo(() => createClient(), []);
  const [counts, setCounts] = useState({ qa: 0, dilr: 0, varc: 0, total: 0 });

  useEffect(() => {
    supabase
      .from('study_topics')
      .select('subject_section')
      .eq('is_published', true)
      .then(({ data }) => {
        if (!data) return;
        const qa   = data.filter((t: any) => t.subject_section === 'qa').length;
        const dilr = data.filter((t: any) => t.subject_section === 'dilr').length;
        const varc = data.filter((t: any) => t.subject_section === 'varc').length;
        setCounts({ qa, dilr, varc, total: data.length });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  return (
    <Link href="/study" className="block rounded-2xl bg-white/[0.03] border border-white/[0.07] p-4 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all group">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
            <GraduationCap size={13} className="text-indigo-400" />
          </div>
          <span className="text-white font-black text-xs">Study Room</span>
        </div>
        <ChevronRight size={14} className="text-gray-600 group-hover:text-indigo-400 transition-colors group-hover:translate-x-0.5 transition-transform" />
      </div>

      {counts.total === 0 ? (
        <p className="text-gray-600 text-xs">No topics published yet.</p>
      ) : (
        <div className="flex gap-2 mb-3">
          {[
            { label: 'QA',   count: counts.qa,   color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
            { label: 'DILR', count: counts.dilr, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20'       },
            { label: 'VARC', count: counts.varc, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
          ].map(s => (
            <div key={s.label} className={`flex-1 text-center py-2 rounded-xl border text-[10px] font-black ${s.color}`}>
              <p className="text-sm font-black">{s.count}</p>
              <p className="text-[8px] uppercase tracking-widest opacity-80">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 text-[10px] text-gray-600 mb-2">
        <span className="flex items-center gap-1"><FileText size={9} />PDF notes</span>
        <span className="flex items-center gap-1"><Video size={9} />Video lectures</span>
        <span className="flex items-center gap-1"><HelpCircle size={9} />Practice Qs</span>
      </div>

      <p className="text-indigo-400/60 text-[10px] font-bold group-hover:text-indigo-400 transition-colors">
        Browse topics →
      </p>
    </Link>
  );
}

// ── Ambient canvas ────────────────────────────────────────────
function AmbientBg() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d')!; let id: number;
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
    resize(); window.addEventListener('resize', resize);
    type O = { x:number;y:number;vx:number;vy:number;r:number;color:string };
    const orbs: O[] = Array.from({ length: 8 }, () => ({
      x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
      vx: (Math.random() - .5) * .2, vy: (Math.random() - .5) * .2,
      r: 150 + Math.random() * 200,
      color: ['#f97316','#ef4444','#fbbf24','#fb923c'][Math.floor(Math.random() * 4)],
    }));
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      orbs.forEach(o => {
        o.x += o.vx; o.y += o.vy;
        if (o.x < -o.r) o.x = c.width + o.r; if (o.x > c.width + o.r) o.x = -o.r;
        if (o.y < -o.r) o.y = c.height + o.r; if (o.y > c.height + o.r) o.y = -o.r;
        const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        g.addColorStop(0, o.color + '18'); g.addColorStop(1, 'transparent');
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();
      });
      id = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} className="fixed inset-0 z-0 pointer-events-none" />;
}

// ── Stagger variants ──────────────────────────────────────────
const fade: Variants = {
  hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
  show: (i: number) => ({
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { duration: 0.6, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [userName, setUserName]     = useState('');
  const [userId, setUserId]         = useState('');
  const [lastLoginAt, setLastLoginAt] = useState<string | null>(null);
  const [hour] = useState(new Date().getHours());

  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/login'); return; }
      setUserId(user.id);
      // lastLoginAt passed to ActivityCard — ActivityCard reads prev login from profiles.last_login_at
      if (user.last_sign_in_at) setLastLoginAt(user.last_sign_in_at);
      supabase.from('profiles').select('name').eq('id', user.id).single()
        .then(({ data }) => {
          if (data?.name) {
            setUserName(data.name.split(' ')[0]);
          } else {
            const meta = user.user_metadata;
            const name = meta?.full_name || meta?.name || user.email?.split('@')[0] || '';
            if (name) setUserName(name.split(' ')[0]);
          }
        });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, router]);

  return (
    <div className="min-h-screen bg-[#060608] text-white overflow-x-hidden">
      {/* Fixed backgrounds */}
      <div className="fixed inset-0 z-0 opacity-[0.022]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.6) 1px,transparent 1px)', backgroundSize: '44px 44px' }} />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_80%_40%_at_50%_-10%,rgba(249,115,22,0.08),transparent)]" />
      <AmbientBg />

      <div className="relative z-10 max-w-360 mx-auto px-4 md:px-6 lg:px-10 pt-6 pb-16">

        {/* ── Greeting ── */}
        <motion.div variants={fade} initial="hidden" animate="show" custom={0} className="mb-7">
          <p className="text-orange-500/70 font-mono text-[10px] tracking-[0.4em] uppercase mb-1.5">
            {hour < 12 ? '☀️' : hour < 17 ? '🌤' : '🌙'} {greeting}
          </p>
          <h1 className="text-3xl lg:text-4xl font-black tracking-tighter text-white leading-tight">
            {userName ? `Hey ${userName},` : 'Your CAT Dashboard'}<br />
            <span className="text-white/30 font-light text-2xl lg:text-3xl">ready to crack the CAT?</span>
          </h1>
        </motion.div>

        {/* ── Main 3-column grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

          {/* LEFT — Activity + mini cards */}
          <div className="lg:col-span-3 space-y-5">
            <motion.div variants={fade} initial="hidden" animate="show" custom={1}>
              <ActivityCard userId={userId} lastLoginAt={lastLoginAt} />
            </motion.div>
            <motion.div variants={fade} initial="hidden" animate="show" custom={2}>
              <InsightMiniCard userId={userId} />
            </motion.div>
            <motion.div variants={fade} initial="hidden" animate="show" custom={4}>
              <StudyMiniCard />
            </motion.div>
          </div>

          {/* CENTER — Contest card + Active contests */}
          <div className="lg:col-span-5 space-y-5">
            {/* <motion.div variants={fade} initial="hidden" animate="show" custom={3}>
              <DailyContestCard />
            </motion.div> */}
            <motion.div variants={fade} initial="hidden" animate="show" custom={4}>
              <div className="rounded-3xl bg-white/[0.03] border border-white/[0.07] p-5">
                <ActiveContestsSection />
              </div>
            </motion.div>
            <motion.div variants={fade} initial="hidden" animate="show" custom={3}>
              <DrillMiniCard />
            </motion.div>
          </div>

          {/* RIGHT — Leaderboard (sticky) */}
          <div className="lg:col-span-4">
            <motion.div variants={fade} initial="hidden" animate="show" custom={5}
              className="rounded-3xl bg-white/[0.03] border border-white/[0.07] p-5 lg:sticky lg:top-24"
              style={{ maxHeight: 'calc(100vh - 7rem)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <Leaderboard />
            </motion.div>
          </div>

        </div>
      </div>
    </div>
  );
}
