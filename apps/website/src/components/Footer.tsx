'use client';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="section-divider py-16 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                </svg>
              </div>
              <span className="font-semibold text-[15px] text-white">ONEServer</span>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed">
              ONEServer — Açık kaynak sunucu yönetim aracı
            </p>
          </div>

          {/* Product links */}
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-5">Ürün</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a href="#features" className="text-slate-500 hover:text-slate-300 transition-colors">
                  Özellikler
                </a>
              </li>
              <li>
                <a href="#platforms" className="text-slate-500 hover:text-slate-300 transition-colors">
                  Platformlar
                </a>
              </li>
              <li>
                <a href="#download" className="text-slate-500 hover:text-slate-300 transition-colors">
                  İndir
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/oneserver/oneserver"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5 text-slate-500 group-hover:text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.11.82-.26.82-.577v-2.234c-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.43.372.82 1.102.82 2.222v3.293c0 .319.22.694.825.576C20.565 21.795 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  GitHub’da İncele
                </a>
              </li>
            </ul>
          </div>

          {/* Platforms */}
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-5">Platformlar</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2 text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Windows — Mevcut
              </li>
              <li className="flex items-center gap-2 text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Android — Mevcut
              </li>
              <li className="flex items-center gap-2 text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                Linux — Yakında
              </li>
              <li className="flex items-center gap-2 text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                iOS — Yakında
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-600 text-sm">
            © {year} ONEServer. Tüm hakları saklıdır.
          </p>
          <div className="flex items-center gap-2 text-slate-600 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Tüm sistemler çalışıyor
          </div>
        </div>
      </div>
    </footer>
  );
}
