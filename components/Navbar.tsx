'use client';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/log',       label: 'Log Meal',  icon: '📝' },
  { href: '/goals',     label: 'Goals',     icon: '🎯' },
  { href: '/recipes',   label: 'Recipes',   icon: '🍽' },
  { href: '/recommendations', label: 'Suggestions', icon: '✨' },
  { href: '/profile',   label: 'Profile',   icon: '👤' },
  { href: '/about',     label: 'About',     icon: 'ℹ' },
  { href: '/review',    label: 'Review Console', icon: '🔬', badge: 'Demo' },
];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 px-4 pt-3 pb-2">
      <nav className="max-w-7xl mx-auto rounded-2xl glass-panel px-4 py-2.5 transition-all">
        <div className="flex items-center justify-between">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-indigo-600 flex items-center justify-center text-white text-lg shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              🥗
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-base tracking-tight bg-gradient-to-r from-emerald-700 via-teal-700 to-indigo-800 bg-clip-text text-transparent">
                NutriTrack
              </span>
              <span className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase -mt-0.5">
                DBMS Project
              </span>
            </div>
          </Link>

          {/* Desktop links */}
          <div className="hidden lg:flex items-center gap-1">
            {links.map((l) => {
              const active = pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`relative px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    active
                      ? 'bg-emerald-600/10 text-emerald-800 shadow-sm border border-emerald-500/30'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                  }`}
                >
                  <span className="text-xs">{l.icon}</span>
                  <span>{l.label}</span>
                  {l.badge && (
                    <span className="ml-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-purple-600/15 text-purple-700 border border-purple-300">
                      {l.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right Action */}
          <div className="hidden lg:flex items-center gap-2">
            <button
              onClick={logout}
              className="px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50/80 rounded-xl transition-all border border-rose-200/60"
            >
              Log Out
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen(!open)}
            aria-label="Toggle navigation"
            className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100/80 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d={open ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>
        </div>

        {/* Mobile dropdown */}
        {open && (
          <div className="lg:hidden mt-3 pt-3 border-t border-slate-200/60 flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`px-3 py-2 rounded-xl text-sm font-semibold flex items-center justify-between ${
                  pathname.startsWith(l.href)
                    ? 'bg-emerald-600/10 text-emerald-800'
                    : 'text-slate-600 hover:bg-slate-100/80'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>{l.icon}</span>
                  <span>{l.label}</span>
                </span>
                {l.badge && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                    {l.badge}
                  </span>
                )}
              </Link>
            ))}
            <button
              onClick={() => { setOpen(false); logout(); }}
              className="mt-2 text-left px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 rounded-xl"
            >
              Log Out
            </button>
          </div>
        )}
      </nav>
    </header>
  );
}
