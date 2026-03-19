"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

// ─── Custom Cursor ─────────────────────────────────────────────
function Cursor() {
  const dotRef  = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let mx = 0, my = 0, rx = 0, ry = 0;
    const onMove = (e: MouseEvent) => { mx = e.clientX; my = e.clientY; };
    document.addEventListener("mousemove", onMove);
    let raf: number;
    const tick = () => {
      if (dotRef.current)  { dotRef.current.style.left  = mx+"px"; dotRef.current.style.top  = my+"px"; }
      rx += (mx-rx)*0.1; ry += (my-ry)*0.1;
      if (ringRef.current) { ringRef.current.style.left = rx+"px"; ringRef.current.style.top = ry+"px"; }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { document.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  }, []);
  return (
    <>
      <div ref={dotRef}  className="fixed z-[9999] w-3 h-3 bg-white rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2 mix-blend-difference" />
      <div ref={ringRef} className="fixed z-[9998] w-10 h-10 border border-white/40 rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2 transition-[width,height] duration-300" />
    </>
  );
}

// ─── Scroll Reveal Hook ────────────────────────────────────────
function useReveal(threshold = 0.12) {
  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("is-visible"); });
    }, { threshold });
    document.querySelectorAll(".reveal, .reveal-l, .reveal-r").forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

// ─── Animated Counter ──────────────────────────────────────────
function Counter({ to, suffix="" }: { to:number; suffix?:string }) {
  const [v, setV] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      let n=0; const step=to/60;
      const t = setInterval(()=>{ n+=step; if(n>=to){setV(to);clearInterval(t);}else setV(Math.floor(n)); },16);
      obs.disconnect();
    }, { threshold:0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  },[to]);
  return <span ref={ref}>{v.toLocaleString()}{suffix}</span>;
}

// ─── 3D Tilt Card ──────────────────────────────────────────────
function TiltCard({ children, className="" }: { children:React.ReactNode; className?:string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el=ref.current; if(!el) return;
    const r=el.getBoundingClientRect();
    const x=(e.clientX-r.left)/r.width-0.5, y=(e.clientY-r.top)/r.height-0.5;
    el.style.transform=`perspective(900px) rotateY(${x*14}deg) rotateX(${-y*14}deg) scale3d(1.02,1.02,1.02)`;
  };
  const onLeave = ()=>{ if(ref.current) ref.current.style.transform="perspective(900px) rotateY(0) rotateX(0) scale3d(1,1,1)"; };
  return <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} className={className} style={{transition:"transform 0.18s ease-out",willChange:"transform"}}>{children}</div>;
}

// ─── Hero 3D Student Canvas ────────────────────────────────────
function StudentCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if(!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let t=0, raf:number;
    let mx=0.5, my=0.5;
    const resize = () => { canvas.width=canvas.offsetWidth; canvas.height=canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);
    canvas.addEventListener("mousemove", e => {
      const r=canvas.getBoundingClientRect();
      mx=(e.clientX-r.left)/r.width; my=(e.clientY-r.top)/r.height;
    });

    const pts = Array.from({length:50}, ()=>({
      x:Math.random()*canvas.width, y:Math.random()*canvas.height,
      vx:(Math.random()-.5)*.5, vy:(Math.random()-.5)*.5,
      r:Math.random()*2+.5, a:Math.random()*.5+.1
    }));

    function glow(x:number,y:number,r:number,c:string,a:number) {
      const g=ctx.createRadialGradient(x,y,0,x,y,r);
      // c is a partial rgba string like "rgba(249,115,22," — append alpha + closing paren
      g.addColorStop(0, c + a + ")");
      g.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    }

    function drawStudent(cx: number, cy: number, bob: number, tilt: number) {
  // 1. Fallback for canvas dimensions (?? 0 ensures it's never undefined)
  const W = canvas?.width ?? 0; 
  const H = canvas?.height ?? 0;
  const s = Math.min(W, H) * 0.003;

  // 2. Ensure ctx exists before calling methods
  if (!ctx) return; 

  ctx.save(); 
  ctx.translate(cx + tilt * 10, cy + bob);

  // Body glow
  glow(0, 50 * s, 120 * s, "rgba(249,115,22,", 0.22);
  glow(-20 * s, 80 * s, 70 * s, "rgba(139,92,246,", 0.15);

  // Body
  ctx.fillStyle = "#1a0a0a";
  ctx.beginPath(); 
  ctx.ellipse(0, 80 * s, 42 * s, 55 * s, 0, 0, Math.PI * 2); 
  ctx.fill();

  // Shirt / collar accent
  ctx.fillStyle = "#f97316";
  ctx.beginPath(); 
  ctx.ellipse(0, 48 * s, 16 * s, 12 * s, 0, 0, Math.PI * 2); 
  ctx.fill();

  // Neck
  ctx.fillStyle = "#c8a882"; 
  ctx.fillRect(-9 * s, 12 * s, 18 * s, 28 * s);

  // Head
  ctx.fillStyle = "#c8a882";
  ctx.beginPath(); 
  ctx.arc(0, 0, 40 * s, 0, Math.PI * 2); 
  ctx.fill();

  // Hair
  ctx.fillStyle = "#0d0508";
  ctx.beginPath(); 
  ctx.arc(0, -8 * s, 40 * s, Math.PI, 0); 
  ctx.fill();
  ctx.fillRect(-40 * s, -10 * s, 80 * s, 16 * s);
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath(); 
    ctx.ellipse(i * 11 * s, -20 * s, 9 * s, 16 * s, i * 0.08, 0, Math.PI * 2); 
    ctx.fill();
  }

  // Face shade
  ctx.fillStyle = "#d4b896";
  ctx.beginPath(); 
  ctx.arc(0, 6 * s, 32 * s, 0, Math.PI); 
  ctx.fill();
  ctx.fillRect(-32 * s, -14 * s, 64 * s, 22 * s);

  // Blink - Ensure 't' is defined globally or passed as an argument
  // If 't' is a variable from your animation loop:
  const currentTime = typeof t !== 'undefined' ? t : Date.now() / 1000;
  const blink = Math.sin(currentTime * 0.5) > 0.97 ? 0.08 : 1;
  
  ctx.fillStyle = "#1a0520";
  ctx.beginPath(); ctx.ellipse(-14 * s, 4 * s, 7.5 * s, 7.5 * s * blink, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(14 * s, 4 * s, 7.5 * s, 7.5 * s * blink, 0, 0, Math.PI * 2); ctx.fill();
  
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(-11 * s, 1 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(16 * s, 1 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();

  // Eyebrows
  ctx.strokeStyle = "#1a0508"; ctx.lineWidth = 3.5 * s; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-21 * s, -12 * s); ctx.quadraticCurveTo(-14 * s, -17 * s, -7 * s, -12 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(7 * s, -12 * s); ctx.quadraticCurveTo(14 * s, -17 * s, 21 * s, -12 * s); ctx.stroke();

  // Nose
  ctx.strokeStyle = "#b89070"; ctx.lineWidth = 1.5 * s;
  ctx.beginPath(); ctx.moveTo(0, -2 * s); ctx.lineTo(-5 * s, 12 * s); ctx.lineTo(5 * s, 12 * s); ctx.stroke();

  // Smile
  ctx.strokeStyle = "#8a4030"; ctx.lineWidth = 2.2 * s;
  ctx.beginPath(); ctx.moveTo(-11 * s, 21 * s); ctx.quadraticCurveTo(0, 28 * s, 11 * s, 21 * s); ctx.stroke();

  // Ears
  ctx.fillStyle = "#c8a882";
  ctx.beginPath(); ctx.ellipse(-40 * s, 5 * s, 8 * s, 11 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(40 * s, 5 * s, 8 * s, 11 * s, 0, 0, Math.PI * 2); ctx.fill();

  // Floating book
  const bookT = Math.sin(currentTime * 0.8 + 1) * 8;
  ctx.save(); 
  ctx.translate(56 * s + bookT * 0.3, -30 * s + Math.sin(currentTime + 2) * 6);
  ctx.rotate(-0.3 + Math.sin(currentTime * 0.4) * 0.08);
  ctx.fillStyle = "#f97316";
  ctx.fillRect(-18 * s, -22 * s, 36 * s, 44 * s);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(-2 * s, -20 * s, 2 * s, 40 * s);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  for (let i = 0; i < 5; i++) ctx.fillRect(-12 * s, -14 * s + i * 8 * s, 24 * s, 1.5 * s);
  glow(0, 0, 28 * s, "rgba(249,115,22,", 0.4);
  ctx.restore();

  // Floating pencil
  ctx.save(); 
  ctx.translate(-58 * s, -20 * s + Math.sin(currentTime * 0.9) * 7);
  ctx.rotate(0.4 + Math.sin(currentTime * 0.3) * 0.06);
  ctx.fillStyle = "#facc15"; ctx.fillRect(-4 * s, -30 * s, 8 * s, 52 * s);
  ctx.fillStyle = "#f97316"; ctx.beginPath(); ctx.moveTo(-4 * s, 22 * s); ctx.lineTo(4 * s, 22 * s); ctx.lineTo(0, 36 * s); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#1a0a0a"; ctx.beginPath(); ctx.moveTo(-4 * s, -30 * s); ctx.lineTo(4 * s, -30 * s); ctx.lineTo(4 * s, -24 * s); ctx.lineTo(-4 * s, -24 * s); ctx.closePath(); ctx.fill();
  ctx.restore();

  // Ground glow
  glow(0, 130 * s + bob, 100 * s, "rgba(249,115,22,", 0.2);
  ctx.restore();
}

    const draw = () => {
      const W=canvas.width, H=canvas.height;
      ctx.clearRect(0,0,W,H); t+=0.016;
      pts.forEach(p=>{
        p.x+=p.vx; p.y+=p.vy;
        if(p.x<0||p.x>W) p.vx*=-1; if(p.y<0||p.y>H) p.vy*=-1;
        ctx.globalAlpha=p.a;
        ctx.fillStyle=Math.random()>.7?"#f97316":"rgba(255,255,255,0.6)";
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
      });
      ctx.globalAlpha=1;
      const bob=Math.sin(t*1.1)*12;
      const tilt=(mx-0.5)*0.4;
      drawStudent(W/2,H*0.46,bob,tilt);
      raf=requestAnimationFrame(draw);
    };
    draw();
    return ()=>{ cancelAnimationFrame(raf); window.removeEventListener("resize",resize); };
  },[]);
  return <canvas ref={ref} className="w-full" style={{height:480}} />;
}

// ─── Orbiting Tech Spheres Canvas ─────────────────────────────
function TechOrbit() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=ref.current; if(!canvas) return;
    const ctx=canvas.getContext("2d")!;
    let t=0, raf:number;
    const resize=()=>{ canvas.width=canvas.offsetWidth; canvas.height=canvas.offsetHeight; };
    resize(); window.addEventListener("resize",resize);

    const techs = [
      {name:"React",    color:"#61dafb", size:52},
      {name:"Next.js",  color:"#ffffff", size:48},
      {name:"Node.js",  color:"#8cc84b", size:50},
      {name:"TypeScript",color:"#3178c6",size:46},
      {name:"Supabase", color:"#3ecf8e", size:44},
      {name:"Python",   color:"#ffd43b", size:46},
      {name:"Tailwind", color:"#38bdf8", size:44},
      {name:"Figma",    color:"#f24e1e", size:42},
    ];

    const spheres = techs.map((tech,i)=>({
      ...tech, baseAngle:(i/techs.length)*Math.PI*2, speed:0.18+(i%3)*0.04
    }));

    function drawSphere(x:number,y:number,r:number,color:string,label:string,depth:number) {
      const alpha=0.35+depth*0.65, scale=0.55+depth*0.45, sr=r*scale;
      // shadow
      const sh=ctx.createRadialGradient(x,y+sr,0,x,y+sr,sr*2);
      sh.addColorStop(0,"rgba(0,0,0,0.35)"); sh.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle=sh; ctx.globalAlpha=alpha*0.4;
      ctx.beginPath(); ctx.ellipse(x,y+sr*1.2,sr*1.3,sr*0.3,0,0,Math.PI*2); ctx.fill();
      // sphere
      const g=ctx.createRadialGradient(x-sr*.35,y-sr*.35,sr*.05,x,y,sr);
      g.addColorStop(0,"rgba(255,255,255,0.95)"); g.addColorStop(0.28,color); g.addColorStop(1,"rgba(0,0,0,0.65)");
      ctx.fillStyle=g; ctx.globalAlpha=alpha;
      ctx.beginPath(); ctx.arc(x,y,sr,0,Math.PI*2); ctx.fill();
      // highlight
      const hl=ctx.createRadialGradient(x-sr*.4,y-sr*.4,0,x-sr*.2,y-sr*.2,sr*.5);
      hl.addColorStop(0,"rgba(255,255,255,0.85)"); hl.addColorStop(1,"rgba(255,255,255,0)");
      ctx.fillStyle=hl; ctx.globalAlpha=alpha*.5;
      ctx.beginPath(); ctx.arc(x,y,sr,0,Math.PI*2); ctx.fill();
      // label
      ctx.globalAlpha=alpha;
      ctx.fillStyle="#fff";
      ctx.font=`${Math.round(9+scale*5)}px 'system-ui',sans-serif`;
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText(label,x,y);
      ctx.globalAlpha=1;
    }

    const draw=()=>{
      const W=canvas.width,H=canvas.height;
      ctx.clearRect(0,0,W,H); t+=0.008;
      const cx=W/2,cy=H/2,rx=W*.38,ry=H*.3;
      const computed=spheres.map(s=>{
        const angle=s.baseAngle+t*s.speed;
        return {...s, x:cx+Math.cos(angle)*rx, y:cy+Math.sin(angle)*ry, depth:(Math.sin(angle)+1)/2};
      }).sort((a,b)=>a.depth-b.depth);
      computed.forEach(s=>drawSphere(s.x,s.y,s.size,s.color,s.name,s.depth));
      raf=requestAnimationFrame(draw);
    };
    draw();
    return()=>{ cancelAnimationFrame(raf); window.removeEventListener("resize",resize); };
  },[]);
  return <canvas ref={ref} className="w-full max-w-4xl" style={{height:400}} />;
}

// ─── Main Page ─────────────────────────────────────────────────
export default function Home() {
  const [scrollY, setScrollY] = useState(0);
  const [navScrolled, setNavScrolled] = useState(false);

  useReveal();

  useEffect(()=>{
    const onScroll=()=>{ setScrollY(window.scrollY); setNavScrolled(window.scrollY>50); };
    window.addEventListener("scroll",onScroll);
    // Hero title in
    setTimeout(()=>{
      document.querySelectorAll(".title-in").forEach(el=>el.classList.add("title-revealed"));
    },80);
    return ()=>window.removeEventListener("scroll",onScroll);
  },[]);

  return (
    <div className="bg-[#000] text-white overflow-x-hidden" style={{cursor:"none"}}>

      {/* Cursor */}
      <Cursor />

      {/* Global styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;700&display=swap');

        * { cursor: none !important; }

        .bebas { font-family: 'Bebas Neue', 'Impact', sans-serif; }
        .dmsans { font-family: 'DM Sans', system-ui, sans-serif; }

        /* Reveal */
        .reveal  { opacity:0; transform:translateY(40px);  transition:opacity .85s cubic-bezier(.16,1,.3,1), transform .85s cubic-bezier(.16,1,.3,1); }
        .reveal-l{ opacity:0; transform:translateX(-60px); transition:opacity .9s cubic-bezier(.16,1,.3,1), transform .9s cubic-bezier(.16,1,.3,1); }
        .reveal-r{ opacity:0; transform:translateX(60px);  transition:opacity .9s cubic-bezier(.16,1,.3,1), transform .9s cubic-bezier(.16,1,.3,1); }
        .reveal.is-visible,.reveal-l.is-visible,.reveal-r.is-visible{ opacity:1; transform:none; }
        .d1{ transition-delay:.1s; } .d2{ transition-delay:.22s; } .d3{ transition-delay:.34s; } .d4{ transition-delay:.46s; }

        /* Title clip reveal */
        .title-clip { overflow:hidden; display:block; }
        .title-in   { display:block; transform:translateY(115%); transition:transform 1s cubic-bezier(.16,1,.3,1); }
        .title-in.d1{ transition-delay:.12s; }
        .title-in.d2{ transition-delay:.26s; }
        .title-in.d3{ transition-delay:.40s; }
        .title-in.title-revealed{ transform:translateY(0); }

        /* Section line */
        .sec-line::before{
          content:''; display:block; width:28px; height:2px;
          background:#f97316; margin-bottom:14px;
        }

        /* Work card */
        .wcard{ position:relative; overflow:hidden; aspect-ratio:4/3; cursor:none; }
        .wcard-bg{ position:absolute; inset:0; transition:transform .65s cubic-bezier(.16,1,.3,1); }
        .wcard:hover .wcard-bg{ transform:scale(1.07); }
        .wcard-overlay{ position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.92) 0%,rgba(0,0,0,.05) 65%); }
        .wcard-content{ position:absolute;bottom:0;left:0;right:0;padding:28px;transform:translateY(10px);transition:transform .4s; }
        .wcard:hover .wcard-content{ transform:translateY(0); }
        .wcard-arrow{ position:absolute;top:20px;right:20px;width:36px;height:36px;border:1px solid rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:15px;opacity:0;transform:translateY(-6px);transition:opacity .3s,transform .3s; }
        .wcard:hover .wcard-arrow{ opacity:1;transform:translateY(0); }
        .wcard:hover .wcard-arrow:hover{ border-color:#f97316;background:rgba(249,115,22,.15); }

        /* Nav link hover */
        .nav-a{ position:relative; }
        .nav-a::after{ content:''; position:absolute;bottom:-3px;left:0;width:0;height:1px;background:#f97316;transition:width .3s; }
        .nav-a:hover::after{ width:100%; }
        .nav-a:hover{ color:#fff !important; }

        /* CTA hover */
        .cta-primary{ transition:transform .2s,box-shadow .2s; }
        .cta-primary:hover{ transform:scale(1.05); }
        .cta-secondary{ border:1px solid rgba(255,255,255,.18); transition:border-color .3s,background .3s,gap .3s; }
        .cta-secondary:hover{ border-color:#f97316; background:rgba(249,115,22,.08); gap:20px; }
      `}</style>

      {/* ── NAV ─────────────────────────────────────────────── */}
      {/* <nav className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-10 py-6 transition-all duration-400 ${navScrolled?"backdrop-blur-xl bg-black/70":""}`}>
        <span className="bebas text-xl tracking-[3px] text-white">CAT<span className="text-orange-500">OMAINA</span></span>
        <ul className="hidden md:flex gap-10 list-none">
          {[["About","#about"],["Features","#features"],["Exams","#exams"],["Join","#cta"]].map(([l,h])=>(
            <li key={l}><a href={h} className="nav-a text-[11px] font-bold tracking-[2px] uppercase text-white/40 no-underline">{l}</a></li>
          ))}
        </ul>
        <Link href="/login" className="hidden md:block text-[11px] font-bold tracking-[2px] uppercase text-orange-400 border border-orange-500/30 px-5 py-2 hover:bg-orange-500/10 transition-colors">
          Sign In →
        </Link>
      </nav> */}

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center px-10 overflow-hidden">
        {/* bg glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none"
          style={{background:"radial-gradient(circle,rgba(249,115,22,.18) 0%,transparent 70%)"}} />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{background:"radial-gradient(circle,rgba(139,92,246,.12) 0%,transparent 70%)"}} />
        {/* grid */}
        <div className="absolute inset-0 opacity-[0.035]" style={{backgroundImage:"linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)",backgroundSize:"60px 60px"}} />

        <div className="relative z-10 w-full max-w-[1200px] mx-auto grid md:grid-cols-2 gap-16 items-center">
          {/* Text */}
          <div>
            <div className="flex items-center gap-2 mb-7 reveal">
              <span className="w-6 h-px bg-orange-500" />
              <span className="text-orange-400 text-[10px] font-bold tracking-[4px] uppercase">CAT 2025 · Live Now</span>
            </div>
            <h1 className="bebas leading-[.9] mb-7"
              style={{fontSize:"clamp(80px,9vw,128px)",letterSpacing:"2px",
                transform:`translateY(${scrollY*-0.06}px)`,opacity:Math.max(0,1-scrollY/500)}}>
              <span className="title-clip"><span className="title-in block text-white">CRACK</span></span>
              <span className="title-clip"><span className="title-in d1 block" style={{WebkitTextFillColor:"transparent",background:"linear-gradient(90deg,#f97316,#facc15)",WebkitBackgroundClip:"text",backgroundClip:"text"}}>YOUR CAT</span></span>
              <span className="title-clip"><span className="title-in d2 block text-white">EXAM</span></span>
            </h1>
            <p className="dmsans text-white/40 text-lg leading-relaxed max-w-md mb-10 reveal d1 font-light">
              CATOMAINA — the next-generation prep platform. AI-powered mocks, live leaderboards, and deep analysis in one place.
            </p>
            <div className="flex flex-wrap gap-4 reveal d2">
              <Link href="/login" className="cta-primary bebas text-base tracking-[3px] text-black bg-orange-500 px-9 py-4 shadow-[0_0_40px_rgba(249,115,22,.35)] inline-block">
                START FREE →
              </Link>
              <Link href="/mocktest" className="cta-secondary flex items-center gap-3 bebas text-base tracking-[3px] text-white px-8 py-4 inline-flex">
                VIEW TESTS <span className="text-lg">→</span>
              </Link>
            </div>
          </div>
          {/* Student Canvas */}
          <div className="reveal-r">
            <StudentCanvas />
          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          style={{opacity:Math.max(0,.5-scrollY/150)}}>
          <span className="text-[9px] tracking-[4px] uppercase text-white/30 font-mono">Scroll</span>
          <div className="w-px h-10 animate-pulse" style={{background:"linear-gradient(to bottom,rgba(255,255,255,.4),transparent)"}} />
        </div>
      </section>

      {/* ── STATS ────────────────────────────────────────────── */}
      <section className="relative z-10 py-20 px-10">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-white/8 border border-white/8 reveal">
          {[{label:"Students",value:12400,suffix:"+"},{label:"Mock Tests",value:850,suffix:"+"},{label:"Questions",value:50000,suffix:"+"},{label:"Avg Score Lift",value:43,suffix:"%"}].map(s=>(
            <div key={s.label} className="flex flex-col items-center py-12 px-6 hover:bg-white/3 transition-colors">
              <p className="bebas text-5xl text-orange-400 mb-1"><Counter to={s.value} suffix={s.suffix} /></p>
              <p className="text-[10px] font-bold uppercase tracking-[2px] text-white/35 text-center">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── ABOUT / FEATURES ─────────────────────────────────── */}
      <section id="features" className="relative z-10 py-28 px-10">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16 reveal">
            <p className="sec-line text-orange-400 text-[10px] font-bold tracking-[4px] uppercase">Why CATOMAINA</p>
            <h2 className="bebas" style={{fontSize:"clamp(52px,6vw,84px)",letterSpacing:"2px"}}>BUILT<br/>DIFFERENT.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-px bg-white/5 border border-white/8">
            {[
              {icon:"⚡",title:"Live Mock Tests",desc:"Full CAT-pattern mocks. Compete live against thousands of students with real-time score updates.",accent:"#f97316"},
              {icon:"🧠",title:"AI Insights",desc:"Know exactly where you lose marks. Topic-wise analysis, weak-area drills, and smart study plans.",accent:"#a78bfa"},
              {icon:"🏆",title:"Leaderboards",desc:"Live rankings that update every second after submit. See where you stand nationally.",accent:"#facc15"},
              {icon:"📝",title:"50K+ Questions",desc:"Curated question bank with full solutions, difficulty tags, PYQ filters, and topic mapping.",accent:"#60a5fa"},
              {icon:"🎯",title:"Drill Mode",desc:"Hyper-focused drills on your weakest chapters. Custom time, question count, and difficulty.",accent:"#34d399"},
              {icon:"📊",title:"Deep Analysis",desc:"After every test — score ring, subject breakdown, time insights, difficulty heatmap, smart feedback.",accent:"#fb923c"},
            ].map((f,i)=>(
              <TiltCard key={f.title} className={`reveal d${(i%3)+1}`}>
                <div className="h-full p-8 bg-black hover:bg-white/3 transition-colors group border-0"
                  style={{borderLeft:`3px solid transparent`}}>
                  <div className="w-12 h-12 flex items-center justify-center text-2xl mb-5 rounded-none"
                    style={{background:`${f.accent}14`,border:`1px solid ${f.accent}28`}}>{f.icon}</div>
                  <h3 className="bebas text-xl tracking-[1px] mb-3">{f.title}</h3>
                  <p className="dmsans text-white/40 text-sm leading-relaxed font-light">{f.desc}</p>
                  <div className="mt-6 w-0 h-px group-hover:w-full transition-all duration-500" style={{background:f.accent}} />
                </div>
              </TiltCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── EXAM TRACKS ──────────────────────────────────────── */}
      <section id="exams" className="relative z-10 py-28 px-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-end mb-16 flex-wrap gap-6 reveal">
            <div>
              <p className="sec-line text-orange-400 text-[10px] font-bold tracking-[4px] uppercase">Exam Tracks</p>
              <h2 className="bebas" style={{fontSize:"clamp(52px,6vw,84px)",letterSpacing:"2px"}}>MY<br/>WORK</h2>
            </div>
            <p className="dmsans text-white/30 text-sm max-w-[200px] text-right leading-relaxed font-light">
              Curated tracks for every competitive exam
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-px">
            {[
              {num:"01",title:"CAT 2025",sub:"VARC · DILR · QA",desc:"Full CAT-pattern mocks with AI-driven score prediction. Sectional tests, slot simulations, and PYQ drills.",href:"/mocktest",grad:"linear-gradient(135deg,#1a0800,#2a1000,#000)",accent:"#f97316"},
              {num:"02",title:"Mock Tests",sub:"Topic · Sectional · Full",desc:"Pick your focus — topic-wise short tests or full 3-hour mock exams. All with detailed analysis after submit.",href:"/mocktest",grad:"linear-gradient(135deg,#08001a,#10002a,#000)",accent:"#a78bfa"},
              {num:"03",title:"Custom Drill",sub:"Any Chapter · Any Difficulty",desc:"Build your own test with exact question count, difficulty mix, subject filters and timed mode.",href:"/dashboard",grad:"linear-gradient(135deg,#001a0a,#002a10,#000)",accent:"#34d399"},
              {num:"04",title:"Analysis",sub:"Deep Performance Report",desc:"After every test — score ring, subject breakdown, time per question, smart insights, and full solutions.",href:"/dashboard",grad:"linear-gradient(135deg,#1a1a00,#2a2000,#000)",accent:"#facc15"},
            ].map((w,i)=>(
              <Link key={w.num} href={w.href} className={`wcard reveal d${i%2+1} no-underline block`}>
                <div className="wcard-bg" style={{background:w.grad}} />
                <div className="wcard-overlay" />
                <div className="wcard-content">
                  <div className="text-[10px] tracking-[3px] uppercase mb-2 font-bold" style={{color:w.accent}}>{w.num}</div>
                  <div className="bebas text-3xl tracking-[1px] mb-1">{w.title}</div>
                  <div className="text-[10px] tracking-[2px] uppercase text-white/40 mb-3">{w.sub}</div>
                  <p className="dmsans text-white/35 text-xs leading-relaxed font-light max-w-xs">{w.desc}</p>
                </div>
                <div className="wcard-arrow text-white">↗</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── TECH STACK (Orbiting Spheres) ────────────────────── */}
      <section className="relative z-10 py-28 px-10 flex flex-col items-center">
        <div className="max-w-6xl w-full mb-12 reveal">
          <p className="sec-line text-orange-400 text-[10px] font-bold tracking-[4px] uppercase">Technology</p>
          <h2 className="bebas" style={{fontSize:"clamp(52px,6vw,84px)",letterSpacing:"2px"}}>
            MY TECH<span className="text-orange-500">STACK</span>
          </h2>
        </div>
        <div className="reveal w-full flex justify-center">
          <TechOrbit />
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section className="relative z-10 py-28 px-10 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20 reveal">
            <p className="text-orange-400 text-[10px] font-bold tracking-[4px] uppercase mb-4">Process</p>
            <h2 className="bebas" style={{fontSize:"clamp(52px,6vw,80px)",letterSpacing:"2px"}}>HOW IT WORKS</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-px bg-white/5 border border-white/8">
            {[
              {step:"01",title:"Sign Up Free",desc:"Create your account with Google in one click. No credit card needed.",icon:"🚀"},
              {step:"02",title:"Pick a Test",desc:"Choose from mock tests, topic drills, or build your own custom session.",icon:"📋"},
              {step:"03",title:"Attempt & Submit",desc:"Full NTA-style exam interface with timer, palette, and mark-for-review.",icon:"✍️"},
              {step:"04",title:"Analyse & Improve",desc:"Deep analysis with score breakdown, time insights, and AI recommendations.",icon:"📈"},
            ].map((s,i)=>(
              <div key={s.step} className={`p-10 bg-black hover:bg-white/3 transition-colors reveal d${i+1}`}>
                <div className="bebas text-7xl text-white/5 mb-4">{s.step}</div>
                <div className="text-3xl mb-4">{s.icon}</div>
                <h3 className="bebas text-xl tracking-[1px] mb-3 text-orange-400">{s.title}</h3>
                <p className="dmsans text-white/35 text-sm leading-relaxed font-light">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────── */}
      <section id="cta" className="relative z-10 py-40 px-10 flex flex-col items-center text-center overflow-hidden">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] pointer-events-none"
          style={{background:"radial-gradient(ellipse,rgba(249,115,22,.14) 0%,transparent 70%)"}} />
        <p className="text-orange-400 text-[10px] font-bold tracking-[4px] uppercase mb-7 reveal">The Journey Starts Now</p>
        <h2 className="bebas leading-[.9] mb-10 reveal" style={{fontSize:"clamp(72px,10vw,132px)",letterSpacing:"2px"}}>
          <span className="block text-white">READY TO</span>
          <span className="block" style={{WebkitTextFillColor:"transparent",background:"linear-gradient(90deg,#f97316,#facc15,#a78bfa)",WebkitBackgroundClip:"text",backgroundClip:"text"}}>DOMINATE?</span>
        </h2>
        <p className="dmsans text-white/35 text-lg max-w-md mb-12 reveal d1 font-light leading-relaxed">
          Join 12,000+ students already preparing on CATOMAINA. Free to start — no card needed.
        </p>
        <div className="flex flex-wrap gap-5 justify-center reveal d2">
          <Link href="/login" className="cta-primary bebas text-base tracking-[3px] text-black bg-orange-500 px-12 py-5 shadow-[0_0_60px_rgba(249,115,22,.4)] inline-block">
            CREATE FREE ACCOUNT →
          </Link>
          <Link href="/mocktest" className="cta-secondary flex items-center gap-3 bebas text-base tracking-[3px] text-white px-10 py-5 inline-flex">
            TRY A TEST <span className="text-lg">→</span>
          </Link>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/5 py-10 px-10 flex flex-col md:flex-row items-center justify-between gap-4">
        <span className="bebas text-2xl tracking-[3px]">CAT<span className="text-orange-500">OMAINA</span></span>
        <div className="flex gap-8">
          <Link href="/about" className="nav-a text-white/30 text-xs tracking-[2px] uppercase no-underline">About</Link>
          <Link href="/mocktest" className="nav-a text-white/30 text-xs tracking-[2px] uppercase no-underline">Practice</Link>
          <Link href="/login" className="nav-a text-white/30 text-xs tracking-[2px] uppercase no-underline">Login</Link>
        </div>
        <p className="text-white/20 text-xs tracking-[1px]">© 2025 CATOMAINA. All rights reserved.</p>
      </footer>

    </div>
  );
}

export const dynamic = "force-dynamic";
