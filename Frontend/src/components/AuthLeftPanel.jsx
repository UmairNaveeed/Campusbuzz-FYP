export default function AuthLeftPanel() {
  return (
    <div className="relative flex flex-col justify-center px-10 lg:px-16 xl:px-20 py-12 bg-gradient-to-br from-[#7C3AED] via-[#6D28D9] to-[#5B21B6] min-h-screen h-full w-full overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute bottom-32 right-20 w-80 h-80 rounded-full bg-[#A78BFA]/20 blur-3xl" />

      {/* Logo */}
      <div className="relative z-10 flex items-center gap-3 mb-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/95 shadow-lg">
          <span className="text-2xl font-bold bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] bg-clip-text text-transparent">C</span>
        </div>
        <span className="text-2xl font-bold text-white tracking-tight">CampusBuzz</span>
      </div>

      {/* Tagline */}
      <div className="relative z-10 max-w-md mb-10">
        <p className="text-3xl lg:text-4xl font-bold text-white leading-tight">
          See everyday moments from{' '}
          <span className="bg-gradient-to-r from-[#F9A8D4] to-[#FBBF24] bg-clip-text text-transparent">your campus community.</span>
        </p>
      </div>

      {/* Illustration: overlapping post-style cards (university social feed) */}
      <div className="relative z-10 flex items-center justify-start gap-0">
        <div className="relative" style={{ width: 280 }}>
          {/* Back card */}
          <div className="absolute rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 shadow-xl p-4 w-44 -left-2 top-4 rotate-[-6deg]">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-white/80" />
              <div className="h-2 w-16 rounded bg-white/50" />
            </div>
            <div className="h-2 w-full rounded bg-white/40 mb-1" />
            <div className="h-2 w-3/4 rounded bg-white/30 mb-3" />
            <div className="flex gap-2">
              <span className="h-5 w-5 rounded bg-white/40" />
              <span className="h-5 w-5 rounded bg-white/40" />
            </div>
          </div>
          {/* Middle card - main */}
          <div className="relative rounded-2xl bg-white/95 backdrop-blur-sm border border-white shadow-2xl p-5 w-52 mx-auto rotate-[2deg]">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#8B5CF6] flex items-center justify-center text-white text-sm font-bold">S</div>
              <div>
                <div className="h-2.5 w-24 rounded bg-gray-200 mb-1" />
                <div className="h-2 w-16 rounded bg-gray-100" />
              </div>
            </div>
            <p className="text-xs text-gray-600 mb-3">Just finished my capstone! 🎉 #SEAS #campus</p>
            <div className="flex gap-3 text-gray-400">
              <span className="text-xs">❤️ 42</span>
              <span className="text-xs">💬 8</span>
            </div>
          </div>
          {/* Front card */}
          <div className="absolute rounded-2xl bg-white/25 backdrop-blur-sm border border-white/40 shadow-xl p-3 w-36 -right-4 bottom-2 rotate-[8deg]">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="h-6 w-6 rounded-full bg-white/90" />
              <div className="h-1.5 w-12 rounded bg-white/60" />
            </div>
            <div className="h-1.5 w-full rounded bg-white/40 mb-1" />
            <div className="h-1.5 w-2/3 rounded bg-white/30" />
          </div>
        </div>
      </div>

      {/* Subtext */}
      <p className="relative z-10 mt-10 text-white/80 text-sm max-w-sm">
        Connect with students, share projects, and stay in the loop with campus life—all in one place.
      </p>
    </div>
  );
}
