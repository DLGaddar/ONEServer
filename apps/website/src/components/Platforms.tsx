'use client';

import { FaLinux } from 'react-icons/fa';

const platforms = [
  {
    name: 'Windows',
    version: 'Windows 10 / 11',
    status: 'available' as const,
    icon: (
      <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
        <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.551H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
      </svg>
    ),
    downloadUrl: 'https://oneserver.app/releases/ONEServer-1.0.0-setup.exe',
    downloadLabel: '.exe — 64-bit Kurulum',
    color: 'from-blue-500/20 to-blue-500/5',
    iconColor: 'text-blue-400',
    borderColor: 'border-blue-500/20',
  },
  {
    name: 'Android',
    version: 'Android 9+',
    status: 'available' as const,
    icon: (
      <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
        <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4483-.9993.9993-.9993c.5511 0 .9993.4483.9993.9993.0001.5511-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4483.9993.9993 0 .5511-.4483.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.2439 13.8533 7.8508 12 7.8508s-3.5902.3931-5.1367 1.0989L4.841 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 10.1588.3432 13.2015 0 16.9502h24c-.3435-3.7487-2.6892-6.7914-6.1185-7.6288" />
      </svg>
    ),
    downloadUrl: '#download',
    downloadLabel: 'APK — Google Play Yakında',
    color: 'from-blue-500/20 to-blue-500/5',
    iconColor: 'text-blue-400',
    borderColor: 'border-blue-500/20',
  },
  {
    name: 'iOS',
    version: 'iPhone & iPad',
    status: 'coming' as const,
    icon: (
      <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
    ),
    downloadUrl: '#',
    downloadLabel: 'Yakında — App Store',
    color: 'from-slate-500/10 to-slate-500/5',
    iconColor: 'text-slate-500',
    borderColor: 'border-slate-700/30',
  },
  {
    name: 'Linux',
    version: 'Ubuntu, Debian, Arch',
    status: 'coming' as const,
    icon: <FaLinux className="w-10 h-10 text-current" style={{ width: 40, height: 40 }} />,
    downloadUrl: '#',
    downloadLabel: 'Yakında — AppImage / .deb',
    color: 'from-slate-500/10 to-slate-500/5',
    iconColor: 'text-slate-500',
    borderColor: 'border-slate-700/30',
  },
];

export default function Platforms() {
  return (
    <section id="platforms" className="section-divider py-28 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-blue-500 text-sm font-medium tracking-wide uppercase mb-4">Platformlar</p>
          <h2 className="text-4xl md:text-5xl font-extrabold text-white leading-tight mb-4">
            Her cihazında <span className="text-gradient">çalışır.</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Windows ve Android uygulamaları şu an kullanılabilir.
            iOS ve Linux sürümleri geliştirme aşamasında.
          </p>
        </div>

        {/* Platform cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {platforms.map((p) => (
            <div
              key={p.name}
              className={`relative rounded-2xl border ${p.borderColor} bg-slate-900/50 p-6 flex flex-col gap-5 ${
                p.status === 'coming' ? 'opacity-60' : ''
              }`}
            >
              {/* Status badge */}
              {p.status === 'available' ? (
                <div className="absolute top-4 right-4 flex items-center gap-1.5 text-xs text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Mevcut
                </div>
              ) : (
                <div className="absolute top-4 right-4 text-xs text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded-full">
                  Yakında
                </div>
              )}

              {/* Icon */}
              <div className={`${p.iconColor}`}>{p.icon}</div>

              {/* Info */}
              <div>
                <h3 className="text-white font-bold text-lg">{p.name}</h3>
                <p className="text-slate-500 text-sm mt-0.5">{p.version}</p>
              </div>

              {/* Download link */}
              {p.status === 'available' ? (
                <a
                  id={`platform-download-${p.name.toLowerCase()}`}
                  href={p.downloadUrl}
                  className="mt-auto flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors duration-150 group"
                >
                  <svg className="w-4 h-4 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {p.downloadLabel}
                </a>
              ) : (
                <p className="mt-auto text-sm text-slate-600">{p.downloadLabel}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
