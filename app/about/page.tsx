export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white px-6 py-24">
      <div className="max-w-4xl mx-auto">
        <p className="text-yellow-500 font-mono text-[11px] tracking-[0.4em] uppercase mb-4">Our Story</p>
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-8 leading-none">
          Built by students,<br />
          <span style={{ background: "linear-gradient(90deg,#facc15,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            for students.
          </span>
        </h1>
        <p className="text-gray-400 text-lg leading-relaxed max-w-2xl">
          CATOMAINA was founded by IIT & IIM graduates who lived through the grind and knew the tools weren&apos;t good enough. 
          We built the platform we wished existed — data-driven, beautifully designed, and obsessively focused on results.
        </p>
        <div className="mt-16 grid md:grid-cols-3 gap-6">
          {[
            { label: "Founded", value: "2024" },
            { label: "Students Helped", value: "12,000+" },
            { label: "Avg. Rank Gain", value: "43%" },
          ].map((s) => (
            <div key={s.label} className="p-6 rounded-3xl bg-white/5 border border-white/10">
              <p className="text-3xl font-black text-yellow-400 mb-1">{s.value}</p>
              <p className="text-gray-500 text-sm uppercase tracking-widest">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
