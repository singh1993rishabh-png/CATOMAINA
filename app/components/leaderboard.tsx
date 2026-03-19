'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { Trophy, Crown, Medal, RefreshCw } from 'lucide-react';

interface LeaderEntry {
  id: string; user_id: string; name: string;
  score: number; total_marks: number; time_taken: number; rank?: number;
}
interface Contest { id: string; title: string; total_marks: number; }

function Card3D({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(600px) rotateY(${x*10}deg) rotateX(${-y*10}deg) translateZ(8px)`;
  };
  const onLeave = () => { if (ref.current) ref.current.style.transform = 'none'; };
  return <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} className={className}
    style={{ transition: 'transform 0.18s ease-out', willChange: 'transform' }}>{children}</div>;
}

function fmtTime(s: number) {
  if (!s || s <= 0) return '—';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/20 border border-yellow-500/50"><Crown size={14} className="text-yellow-400"/></span>;
  if (rank === 2) return <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-400/20 border border-gray-400/50"><Medal size={14} className="text-gray-300"/></span>;
  if (rank === 3) return <span className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-600/20 border border-orange-600/50"><Medal size={14} className="text-orange-400"/></span>;
  return <span className="flex items-center justify-center w-8 h-8 text-xs font-black text-gray-500">#{rank}</span>;
}

export function Leaderboard() {
  const supabase       = useMemo(() => createClient(), []);
  const [entries,      setEntries]  = useState<LeaderEntry[]>([]);
  const [contests,     setContests] = useState<Contest[]>([]);
  const [selectedId,   setSelectedId] = useState('');
  const [loading,      setLoading]  = useState(true);
  const [noData,       setNoData]   = useState(false);

  // ── Load ACTIVE contests only (is_active = true) ──────────
  useEffect(() => {
    supabase
      .from('contests')
      .select('id, title, total_marks')
      .eq('is_active', true)
      .order('start_time', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setContests(data);
          setSelectedId(data[0].id);
        } else {
          setLoading(false);
          setNoData(true);
        }
      });
  }, [supabase]);

  // ── Fetch rankings for selected contest ───────────────────
  const fetchLeaderboard = useCallback(async (contestId: string) => {
    if (!contestId) return;
    setLoading(true);
    setNoData(false);

    // Step 1: get results
    const { data: results, error: rErr } = await supabase
      .from('contest_results')
      .select('id, user_id, score, time_taken')
      .eq('contest_id', contestId)
      .order('score', { ascending: false })
      .order('time_taken', { ascending: true })
      .limit(20);

    if (rErr || !results || results.length === 0) {
      setEntries([]); setNoData(true); setLoading(false); return;
    }

    // Step 2: fetch names separately (avoids PGRST200 FK error)
    const userIds = [...new Set(results.map((r: any) => r.user_id as string))];
    const { data: profiles } = await supabase
      .from('profiles').select('id, name').in('id', userIds);

    const nameMap: Record<string, string> = {};
    (profiles ?? []).forEach((p: any) => { nameMap[p.id] = p.name?.trim() || 'Student'; });

    const meta = contests.find(c => c.id === contestId);
    const ranked: LeaderEntry[] = results.map((row: any, i: number) => ({
      id: row.id, user_id: row.user_id,
      name: nameMap[row.user_id] ?? 'Student',
      score: row.score ?? 0,
      total_marks: meta?.total_marks ?? 100,
      time_taken: row.time_taken ?? 0,
      rank: i + 1,
    }));

    setEntries(ranked);
    setLoading(false);
  }, [contests, supabase]);

  useEffect(() => { if (selectedId) fetchLeaderboard(selectedId); }, [selectedId, fetchLeaderboard]);

  // ── Realtime ──────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId) return;
    const ch = supabase.channel('lb-active')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'contest_results',
        filter: `contest_id=eq.${selectedId}`,
      }, () => fetchLeaderboard(selectedId))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedId, fetchLeaderboard, supabase]);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="h-full flex flex-col gap-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center">
            <Trophy size={15} className="text-yellow-400"/>
          </div>
          <div>
            <h3 className="text-white font-black text-sm">Leaderboard</h3>
            <p className="text-gray-600 text-[10px] uppercase tracking-widest">Active Contests</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchLeaderboard(selectedId)} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition">
            <RefreshCw size={11} className="text-gray-500"/>
          </button>
          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>LIVE
          </span>
        </div>
      </div>

      {/* Contest selector */}
      {contests.length > 1 && (
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-yellow-500/50 transition">
          {contests.map(c => <option key={c.id} value={c.id} className="bg-[#111]">{c.title}</option>)}
        </select>
      )}
      {contests.length === 1 && (
        <p className="text-gray-600 text-[10px] font-bold truncate px-1">📋 {contests[0].title}</p>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-white/10 border-t-yellow-400 rounded-full animate-spin"/>
        </div>
      )}

      {/* Empty */}
      {!loading && noData && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-8">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl">🏆</div>
          <p className="text-gray-500 text-xs text-center leading-relaxed">
            {contests.length === 0
              ? 'No active contests.\nCreate one in the Admin Panel.'
              : 'No submissions yet.\nResults appear after students submit.'}
          </p>
        </div>
      )}

      {/* Podium */}
      {!loading && !noData && entries.length > 0 && (
        <>
          <div className="flex items-end justify-center gap-2 px-1">
            {/* 2nd */}
            <Card3D className="flex-1">
              <div className="flex flex-col items-center p-3 rounded-2xl bg-gradient-to-b from-gray-400/10 to-transparent border border-gray-400/20">
                <div className="w-9 h-9 rounded-full bg-gray-600 flex items-center justify-center text-sm mb-1 border-2 border-gray-400/40 text-white font-bold">
                  {top3[1]?.name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <RankBadge rank={2}/>
                <p className="text-white text-[9px] font-bold mt-1 text-center truncate w-full">{top3[1]?.name?.split(' ')[0] ?? '—'}</p>
                <p className="text-gray-300 text-[11px] font-black">{top3[1]?.score ?? '—'}</p>
              </div>
            </Card3D>
            {/* 1st */}
            <Card3D className="flex-1">
              <div className="flex flex-col items-center p-3 rounded-2xl bg-gradient-to-b from-yellow-500/15 to-transparent border border-yellow-500/30 shadow-[0_0_20px_rgba(234,179,8,0.08)] scale-105">
                <div className="w-11 h-11 rounded-full bg-yellow-600/30 flex items-center justify-center text-base mb-1 border-2 border-yellow-400/50 text-white font-bold">
                  {top3[0]?.name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <RankBadge rank={1}/>
                <p className="text-white text-[9px] font-bold mt-1 text-center truncate w-full">{top3[0]?.name?.split(' ')[0] ?? '—'}</p>
                <p className="text-yellow-400 text-[11px] font-black">{top3[0]?.score ?? '—'}</p>
              </div>
            </Card3D>
            {/* 3rd */}
            <Card3D className="flex-1">
              <div className="flex flex-col items-center p-3 rounded-2xl bg-gradient-to-b from-orange-600/10 to-transparent border border-orange-600/20">
                <div className="w-9 h-9 rounded-full bg-orange-700/30 flex items-center justify-center text-sm mb-1 border-2 border-orange-600/30 text-white font-bold">
                  {top3[2]?.name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <RankBadge rank={3}/>
                <p className="text-white text-[9px] font-bold mt-1 text-center truncate w-full">{top3[2]?.name?.split(' ')[0] ?? '—'}</p>
                <p className="text-orange-300 text-[11px] font-black">{top3[2]?.score ?? '—'}</p>
              </div>
            </Card3D>
          </div>

          {/* Rank list */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1" style={{ scrollbarWidth:'thin', scrollbarColor:'#333 transparent' }}>
            {rest.map(e => (
              <div key={e.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/3 border border-white/5 hover:border-white/10 hover:bg-white/5 transition-all">
                <RankBadge rank={e.rank ?? 4}/>
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-600/30 flex items-center justify-center text-xs font-bold text-white border border-white/10">
                  {e.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-semibold truncate">{e.name}</p>
                  <p className="text-gray-600 text-[10px]">{fmtTime(e.time_taken)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-white text-xs font-black">{e.score}</p>
                  <p className="text-gray-600 text-[10px]">/{e.total_marks}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
