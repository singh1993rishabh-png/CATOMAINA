'use client'
import React from 'react';
import { Lock, Zap, Target, BookOpen, ChevronRight, Sparkles, Orbit, Shield } from 'lucide-react';
import Link from 'next/link';

const roadmapData = [
  {
    step: "01",
    phase: "Phase Alpha",
    category: "Quantitative Mastery",
    color: "from-yellow-400 via-amber-500 to-orange-600",
    shadow: "shadow-yellow-500/10",
    modules: ["Number System Logic", "Arithmetic Proficiency", "Geometric Visualization"]
  },
  {
    step: "02",
    phase: "Phase Beta",
    category: "Logical Intelligence",
    color: "from-blue-400 via-cyan-500 to-indigo-600",
    shadow: "shadow-blue-500/10",
    modules: ["Structural Caselets", "Abstract Arrangements", "Game Theory Basics"]
  },
  {
    step: "03",
    phase: "Phase Omega",
    category: "Verbal Precision",
    color: "from-emerald-400 via-teal-500 to-green-600",
    shadow: "shadow-emerald-500/10",
    modules: ["Contextual Reading", "Tone Identification", "Logical Deductions"]
  }
];

const UltraAttractiveRoadmap = () => {
  return (
    <div className="relative min-h-screen w-full bg-[#020202] text-white overflow-hidden flex flex-col items-center py-24 font-sans selection:bg-yellow-500/30">
      
      {/* 1. CINEMATIC BACKGROUND */}
      <div className="absolute inset-0 z-0">
        {/* Deep Radial Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[800px] bg-yellow-500/[0.03] blur-[150px] rounded-full" />
        {/* Animated Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
      </div>

      {/* 2. HERO SECTION */}
      <div className="relative z-10 text-center mb-48 px-6 space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/5 bg-white/5 backdrop-blur-md mb-4 animate-bounce">
          <Orbit size={14} className="text-yellow-400" />
          <span className="text-[10px] font-mono uppercase tracking-[0.5em] text-yellow-500 font-bold">Evolution Engine v3</span>
        </div>
        <h1 className="text-6xl md:text-9xl font-black tracking-tighter leading-[0.85]">
          MANAGEMENT <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-white/80 to-white/20">TOPPERS.</span>
        </h1>
        <p className="text-white/40 max-w-xl mx-auto text-sm md:text-lg font-light tracking-widest uppercase">
          Precision Roadmap for <span className="text-white border-b border-yellow-500/50">CAT 2025</span> Aspirants
        </p>
      </div>

      {/* 3. THE SPATIAL ROADMAP */}
      <div className="relative z-10 w-full max-w-7xl px-6">
        
        {/* The Pulsing Energy Line */}
        <div className="absolute top-0 bottom-0 left-[30px] lg:left-1/2 lg:-translate-x-1/2 w-[2px] bg-white/[0.03]">
          <div className="w-full h-32 bg-gradient-to-b from-transparent via-yellow-500 to-transparent animate-infinite-scroll" />
        </div>

        <div className="space-y-40">
          {roadmapData.map((data, idx) => (
            <div key={idx} className={`relative flex flex-col lg:items-center ${idx % 2 === 0 ? 'lg:flex-row-reverse' : 'lg:flex-row'} gap-16 group`}>
              
              {/* Floating Stage Orb */}
              <div className="lg:absolute lg:left-1/2 lg:-translate-x-1/2 z-20">
                <div className={`relative w-16 h-16 rounded-2xl bg-[#050505] border border-white/10 flex items-center justify-center transition-all duration-700 group-hover:rotate-[360deg] group-hover:border-yellow-500/50 ${data.shadow}`}>
                  <span className={`text-xl font-black bg-clip-text text-transparent bg-gradient-to-br ${data.color}`}>
                    {data.step}
                  </span>
                  {/* Outer Ring Glow */}
                  <div className="absolute inset-[-4px] rounded-2xl border border-white/5 opacity-50" />
                </div>
              </div>

              {/* Content Card (The Bento Glass) */}
              <div className={`flex flex-col lg:w-[calc(50%-80px)] space-y-6 ${idx % 2 === 0 ? 'lg:pl-12' : 'lg:pr-12'}`}>
                
                {/* Header with Depth */}
                <div className="space-y-2 [transform:translateZ(40px)]">
                  <span className={`text-[11px] font-mono font-black uppercase tracking-[0.4em] bg-clip-text text-transparent bg-gradient-to-r ${data.color}`}>
                    {data.phase}
                  </span>
                  <h3 className="text-4xl font-black text-white/90 group-hover:text-white transition-colors">{data.category}</h3>
                </div>

                {/* Sub-cards Container */}
                <div className="grid gap-4">
                  {data.modules.map((module, mIdx) => (
                    <div 
                      key={mIdx}
                      className="group/item relative p-6 rounded-3xl bg-white/[0.01] border border-white/[0.05] backdrop-blur-xl transition-all duration-500 hover:bg-white/[0.04] hover:border-white/20 hover:translate-x-2"
                    >
                      <div className="flex justify-between items-center relative z-10">
                        <div className="flex items-center gap-5">
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${data.color} opacity-10 flex items-center justify-center group-hover/item:opacity-100 transition-all duration-500`}>
                            {idx === 0 ? <Zap size={18} className="text-white" /> : idx === 1 ? <Target size={18} className="text-white" /> : <BookOpen size={18} className="text-white" />}
                          </div>
                          <div>
                            <p className="font-bold text-white/80 group-hover/item:text-white transition-colors tracking-tight">{module}</p>
                            <p className="text-[9px] text-white/20 uppercase tracking-[0.2em] mt-1">Status: Classified</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-end mr-4">
                             <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                               <div className="h-full bg-yellow-500/50 w-0 group-hover/item:w-1/3 transition-all duration-1000" />
                             </div>
                          </div>
                          <Lock size={14} className="text-white/10 group-hover/item:text-yellow-500 transition-colors" />
                        </div>
                      </div>
                      
                      {/* Interactive Hover Background Effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent translate-x-[-100%] group-hover/item:translate-x-[100%] transition-transform duration-1000" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. THE GRAND FINALE CTA */}
      <div className="mt-56 relative group">
        <div className="absolute inset-0 blur-[100px] bg-yellow-500/10 group-hover:bg-yellow-500/20 transition-all" />
        
        <div className="text-center relative z-10 space-y-10">
          <div className="space-y-2">
            <h4 className="text-white/20 font-mono text-xs tracking-[0.6em] uppercase italic">System Ready for Deployment</h4>
            <h2 className="text-4xl font-black italic tracking-tighter">THE 99 PERCENTILE <span className="text-yellow-500 underline decoration-white/10">STARTS HERE.</span></h2>
          </div>

          <Link href="/login" className="block w-fit mx-auto"> 
  <button className="group relative px-16 py-7 bg-white rounded-2xl overflow-hidden transition-all duration-500 hover:scale-[1.05] hover:rotate-[-1deg] shadow-[0_30px_60px_-15px_rgba(255,255,255,0.1)] active:scale-95 cursor-pointer">
    {/* Hover Background Layer */}
    <div className="absolute inset-0 bg-yellow-500 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
    
    {/* Content */}
    <div className="relative z-10 flex items-center gap-4">
      <Shield size={20} className="text-black fill-black/10" />
      <span className="text-black font-black uppercase tracking-[0.3em] text-sm">
        Create Student ID
      </span>
      <ChevronRight size={20} className="text-black group-hover:translate-x-2 transition-transform" />
    </div>
  </button>
</Link>
          
          <div className="pt-6">
             <p className="text-[10px] text-white/30 font-mono tracking-widest uppercase">Secured by CATOMAINA Infrastructure</p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes infinite-scroll {
          from { transform: translateY(-100%); }
          to { transform: translateY(1000%); }
        }
        .animate-infinite-scroll {
          animation: infinite-scroll 5s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default UltraAttractiveRoadmap;