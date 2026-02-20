import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Dna, Calculator, AlignJustify, Search, Home, LogOut, User, Folder, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';

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
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
      logout();
      navigate('/login');
  };

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
          <SidebarItem to="/projects" icon={Folder} label="Projects" />
          <SidebarItem to="/sequence-analysis" icon={Dna} label="Sequence Analysis" />
          <SidebarItem to="/peptide-calc" icon={Calculator} label="Peptide Calculator" />
          <SidebarItem to="/blast" icon={Search} label="BLAST Search" />
          <SidebarItem to="/msa" icon={AlignJustify} label="MSA" />
          
          {user?.is_staff && (
              <div className="mt-6 pt-4 border-t border-slate-100">
                  <span className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Admin</span>
                  <div className="mt-2 space-y-1">
                      <SidebarItem to="/admin-dashboard" icon={ShieldCheck} label="Approvals" />
                  </div>
              </div>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100 text-xs text-slate-400 text-center">
            v2.1.0 (RBAC)
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between">
            <h1 className="text-lg font-semibold text-slate-800">
                Bioinformatics Toolkit
            </h1>
            <div className="flex items-center gap-4">
                {user ? (
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                            <User className="w-4 h-4" />
                            <span>{user.username}</span>
                        </div>
                        <button 
                            onClick={handleLogout}
                            className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-red-50 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            Logout
                        </button>
                    </div>
                ) : (
                    <Link 
                        to="/login"
                        className="text-sm bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 transition-colors"
                    >
                        Login
                    </Link>
                )}
            </div>
        </header>
        <div className="p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
