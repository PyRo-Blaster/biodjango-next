import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Dna, Calculator, AlignJustify, Search, Home } from 'lucide-react';
import clsx from 'clsx';

const SidebarItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={clsx(
        'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
        isActive
          ? 'bg-primary-50 text-primary-700 font-medium'
          : 'text-slate-600 hover:bg-slate-100'
      )}
    >
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </Link>
  );
};

export const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold">
                B
            </div>
            <span className="text-xl font-bold text-slate-800">BioDjango</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <SidebarItem to="/" icon={Home} label="Dashboard" />
          <SidebarItem to="/sequence-analysis" icon={Dna} label="Sequence Analysis" />
          <SidebarItem to="/peptide-calc" icon={Calculator} label="Peptide Calculator" />
          <SidebarItem to="/blast" icon={Search} label="BLAST Search" />
          <SidebarItem to="/msa" icon={AlignJustify} label="MSA" />
        </nav>

        <div className="p-4 border-t border-slate-100 text-xs text-slate-400 text-center">
            v2.0.0 (Beta)
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between">
            <h1 className="text-lg font-semibold text-slate-800">
                Bioinformatics Toolkit
            </h1>
            <div className="flex items-center gap-4">
                {/* User profile or other actions could go here */}
            </div>
        </header>
        <div className="p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
