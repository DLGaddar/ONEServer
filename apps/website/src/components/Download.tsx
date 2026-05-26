'use client';

import { useEffect, useState } from 'react';
import { FaLinux } from 'react-icons/fa';

interface VersionData {
  version: string;
  releaseDate: string;
  downloads: { windows: string; linux: string; android: string };
  changelog: string[];
}

export default function Download() {
  const [data, setData] = useState<VersionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/version')
      .then((r) => r.json())
      .then((d: VersionData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <section id="download" className="section-divider py-28 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Left — main download */}
          <div>
            <p className="text-blue-500 text-sm font-medium tracking-wide uppercase mb-4">İndir</p>
            <h2 className="text-4xl font-extrabold text-white leading-tight mb-4">
              Hemen başla.<br />
              <span className="text-gradient">Ücretsiz.</span>
            </h2>
            <p className="text-slate-400 mb-10 leading-relaxed">
              Kurulum sihirbazını çalıştır, sunucularını ekle — hazırsın.
              {data && (
                <span className="block mt-2 text-sm text-slate-500">
                  Son sürüm: <span className="font-mono-custom text-slate-400">v{data.version}</span>
                  {' '}— {formatDate(data.releaseDate)}
                </span>
              )}
            </p>

            {/* Windows download */}
            <div className="rounded-2xl border border-white/8 overflow-hidden mb-4">
              <div className="bg-slate-900 px-6 py-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.551H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-white font-semibold text-sm">Windows</div>
                  <div className="text-slate-500 text-xs">64-bit · Windows 10 / 11</div>
                </div>
                <a
                  id="download-btn-windows"
                  href={data?.downloads.windows ?? '#'}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors duration-150"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  İndir
                </a>
              </div>
            </div>

            {/* Linux download */}
            <div className="rounded-2xl border border-white/8 overflow-hidden mb-4">
              <div className="bg-slate-900 px-6 py-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-500">
                  <FaLinux className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-white font-semibold text-sm">Linux</div>
                  <div className="text-slate-500 text-xs">AppImage / .deb</div>
                </div>
                <a
                  id="download-btn-linux"
                  href={data?.downloads.linux ?? '#'}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors duration-150"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  İndir
                </a>
              </div>
            </div>

            {/* Android APK download */}
            <div className="rounded-2xl border border-white/8 overflow-hidden">
              <div className="bg-slate-900 px-6 py-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-white font-semibold text-sm">Android APK</div>
                  <div className="text-slate-500 text-xs">Direct Installer · iOS / Android</div>
                </div>
                <a
                  id="download-btn-android"
                  href={data?.downloads.android ?? '#'}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors duration-150"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  İndir
                </a>
              </div>
            </div>

            {/* Info note */}
            <p className="text-slate-500 text-xs mt-4 flex items-center gap-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Tüm veriler cihazınızda şifrelenerek saklanır.
            </p>
          </div>

          {/* Right — changelog */}
          <div className="rounded-2xl border border-white/8 bg-slate-900 p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-bold text-lg">Sürüm Notları</h3>
              {loading ? (
                <div className="skeleton w-12 h-5 rounded" />
              ) : data ? (
                <span className="font-mono-custom text-xs px-2.5 py-1 rounded-md bg-blue-500/15 border border-blue-500/25 text-blue-300">
                  v{data.version}
                </span>
              ) : null}
            </div>

            {loading ? (
              <div className="space-y-4">
                {[80, 65, 75, 55].map((w, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full skeleton flex-shrink-0" />
                    <div className={`skeleton h-4 rounded`} style={{ width: `${w}%` }} />
                  </div>
                ))}
              </div>
            ) : data ? (
              <ul className="space-y-4">
                {data.changelog.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-400">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-600 text-sm">Bilgi alınamadı.</p>
            )}

            <div className="mt-8 pt-6 border-t border-white/5">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                iOS ve Android sürümleri geliştirme aşamasında.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
