import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import { Toaster } from '@/components/Toaster';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'NutriTrack — Personalized Nutrition & Recipe Tracker',
  description: 'DBMS Experiential Learning Level 3 — Hybrid MySQL & MongoDB Architecture',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.className} bg-slate-50/60 text-slate-900 antialiased relative min-h-screen selection:bg-emerald-500 selection:text-white`}>
        {/* Ambient background glows */}
        <div className="ambient-glow-1" />
        <div className="ambient-glow-2" />
        <div className="ambient-glow-3" />
        
        <div className="relative z-10 flex flex-col min-h-screen">
          <Navbar />
          <main className="flex-1 pb-16">{children}</main>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
