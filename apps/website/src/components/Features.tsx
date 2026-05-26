'use client';

const features = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ),
    title: 'SSH Key Yönetimi',
    description: 'Şifre yok, sadece key.',
    tag: 'Anahtar',
    tagColor: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    title: 'Docker Yönetimi',
    description: 'Konteynerları uzaktan yönet.',
    tag: 'Konteyner',
    tagColor: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Gerçek Zamanlı İzleme',
    description: 'CPU, RAM, Disk, Network.',
    tag: 'Canlı',
    tagColor: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Mobil Erişim',
    description: 'Her yerden acil müdahale.',
    tag: 'Mobil',
    tagColor: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    title: 'Güvenli Bağlantı',
    description: 'AES-256 şifreli iletişim.',
    tag: 'AES-256',
    tagColor: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Ajan Gerektirmez',
    description: 'Sadece SSH yeterli.',
    tag: 'Ajansız',
    tagColor: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  },
];

export default function Features() {
  return (
    <section id="features" className="section-divider py-28 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="max-w-2xl mb-16">
          <p className="text-blue-500 text-sm font-medium tracking-wide uppercase mb-4">Özellikler</p>
          <h2 className="text-4xl md:text-5xl font-extrabold text-white leading-tight mb-4">
            İhtiyacın olan her şey,<br />
            <span className="text-gradient">fazlası değil.</span>
          </h2>
          <p className="text-slate-400 text-lg leading-relaxed">
            Sunucularınızı güvenle ve kolayca kontrol edebilmeniz için tüm özellikler hazır.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5 rounded-2xl overflow-hidden">
          {features.map((f, i) => (
            <div
              key={i}
              className="group bg-slate-950 p-8 hover:bg-slate-900 transition-colors duration-200 flex flex-col gap-4"
            >
              {/* Icon */}
              <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-slate-300 group-hover:text-white group-hover:border-blue-500/30 transition-all duration-200">
                {f.icon}
              </div>

              {/* Title + tag */}
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-white font-semibold text-[15px]">{f.title}</h3>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${f.tagColor}`}>
                  {f.tag}
                </span>
              </div>

              {/* Description */}
              <p className="text-slate-500 text-sm leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
