import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Dna,
  Calculator,
  AlignJustify,
  Search,
  Home,
  LogOut,
  User,
  Folder,
  ShieldCheck,
  Sun,
  Moon,
  TestTube,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const SidebarItem = ({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: any;
  label: string;
}) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={clsx(
        "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
        isActive
          ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-medium"
          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700",
      )}
    >
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </Link>
  );
};

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col transition-colors duration-200">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold">
            B
          </div>
          <span className="text-xl font-bold text-slate-800 dark:text-white">
            BioDjango
          </span>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <SidebarItem to="/" icon={Home} label="Dashboard" />
          <SidebarItem to="/projects" icon={Folder} label="Projects" />
          <SidebarItem
            to="/sequence-analysis"
            icon={Dna}
            label="Sequence Analysis"
          />
          <SidebarItem
            to="/peptide-calc"
            icon={Calculator}
            label="Peptide Calculator"
          />
          <SidebarItem to="/blast" icon={Search} label="BLAST Search" />
          <SidebarItem to="/msa" icon={AlignJustify} label="MSA" />

          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
            <span className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Advanced Tools
            </span>
            <div className="mt-2 space-y-1">
              <SidebarItem
                to="/primer-design"
                icon={TestTube}
                label="Primer Design"
              />
              <SidebarItem
                to="/antibody-annotation"
                icon={ShieldCheck}
                label="Antibody Annotation"
              />
            </div>
          </div>

          {user?.is_staff && (
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
              <span className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Admin
              </span>
              <div className="mt-2 space-y-1">
                <SidebarItem
                  to="/admin-dashboard"
                  icon={ShieldCheck}
                  label="Approvals"
                />
              </div>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-400 text-center">
          v2.2.0 (Audit & Dark)
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 flex items-center justify-between transition-colors duration-200">
          <h1 className="text-lg font-semibold text-slate-800 dark:text-white">
            Bioinformatics Toolkit
          </h1>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
              title={
                theme === "dark"
                  ? "Switch to Light Mode"
                  : "Switch to Dark Mode"
              }
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>

            {user ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <User className="w-4 h-4" />
                  <span>{user.username}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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
        <div className="p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
};
