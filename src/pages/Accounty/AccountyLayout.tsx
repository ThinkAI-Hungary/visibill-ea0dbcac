import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { 
  Briefcase, 
  FileWarning, 
  Calendar, 
  BarChart2, 
  Settings, 
  HelpCircle,
  Search,
  Bell,
  Sun,
  Moon,
  User,
  LogOut,
  ChevronDown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export default function AccountyLayout() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const pathname = location.pathname;

  const getUserInitials = () => {
    if (user?.user_metadata?.name) {
      return user.user_metadata.name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase();
    }
    return user?.email?.substring(0, 2).toUpperCase() || 'U';
  };

  const isActive = (path: string) => {
    if (path === '/accounty') {
      return pathname === '/accounty' || pathname.startsWith('/accounty/client');
    }
    return pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col bg-[#1A1F2C] text-slate-300">
        {/* Logo Area */}
        <div className="h-16 flex items-center px-6 border-b border-white/10 shrink-0 gap-2">
          <Link to="/" className="text-2xl font-black text-emerald-500 tracking-tight hover:opacity-80 transition-opacity" title="Vissza a Visibillbe">
            Visibill
          </Link>
          <span className="text-xl font-light text-slate-500">|</span>
          <Link to="/accounty" className="text-2xl font-black text-red-500 tracking-tight hover:opacity-80 transition-opacity">
            Accounty
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          <Link 
            to="/accounty" 
            className={cn(
              "flex items-center justify-between px-3 py-2.5 rounded-md font-medium transition-colors",
              isActive('/accounty') ? "bg-white/10 text-white" : "hover:bg-white/5 text-slate-300 hover:text-white"
            )}
          >
            <div className="flex items-center gap-3">
              <Briefcase className="w-5 h-5" />
              <span>Portfólió</span>
            </div>
          </Link>
          <Link 
            to="/accounty/missing-invoices" 
            className={cn(
              "flex items-center justify-between px-3 py-2.5 rounded-md font-medium transition-colors",
              isActive('/accounty/missing-invoices') ? "bg-white/10 text-white" : "hover:bg-white/5 text-slate-300 hover:text-white"
            )}
          >
            <div className="flex items-center gap-3">
              <FileWarning className="w-5 h-5" />
              <span>Hiányzó számlák</span>
            </div>
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">12</span>
          </Link>
          <Link 
            to="/accounty/tax-calendar" 
            className={cn(
              "flex items-center justify-between px-3 py-2.5 rounded-md font-medium transition-colors",
              isActive('/accounty/tax-calendar') ? "bg-white/10 text-white" : "hover:bg-white/5 text-slate-300 hover:text-white"
            )}
          >
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5" />
              <span>Adó naptár</span>
            </div>
          </Link>
          <Link 
            to="/accounty/reports" 
            className={cn(
              "flex items-center justify-between px-3 py-2.5 rounded-md font-medium transition-colors",
              isActive('/accounty/reports') ? "bg-white/10 text-white" : "hover:bg-white/5 text-slate-300 hover:text-white"
            )}
          >
            <div className="flex items-center gap-3">
              <BarChart2 className="w-5 h-5" />
              <span>Riportok</span>
            </div>
          </Link>
          <Link 
            to="#" 
            className="flex items-center justify-between px-3 py-2.5 hover:bg-white/5 text-slate-300 hover:text-white rounded-md font-medium transition-colors"
          >
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5" />
              <span>Beállítások</span>
            </div>
          </Link>
          <Link 
            to="#" 
            className="flex items-center justify-between px-3 py-2.5 hover:bg-white/5 text-slate-300 hover:text-white rounded-md font-medium transition-colors"
          >
            <div className="flex items-center gap-3">
              <HelpCircle className="w-5 h-5" />
              <span>Segítség</span>
            </div>
          </Link>
        </nav>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-white/10 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center gap-3 cursor-pointer hover:bg-white/5 p-2 rounded-md transition-colors group">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {getUserInitials()}
                </div>
                <div className="flex-1 min-w-0 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white truncate">
                      {user?.user_metadata?.name || 'Kovács János'}
                    </p>
                    <p className="text-xs text-slate-400 truncate">Könyvelő</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors opacity-50 group-hover:opacity-100" />
                </div>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 mb-2" align="start" side="top">
              <DropdownMenuLabel className="font-semibold text-slate-900">Fiókom</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer flex items-center gap-2 text-slate-700">
                <User className="w-4 h-4" />
                <span>Profil</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer flex items-center gap-2 text-slate-700">
                <Settings className="w-4 h-4" />
                <span>Beállítások</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer flex items-center gap-2 text-slate-700"
                onClick={(e) => {
                  e.preventDefault();
                  setTheme(theme === 'dark' ? 'light' : 'dark');
                }}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                <span>{theme === 'dark' ? 'Világos mód' : 'Sötét mód'}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer flex items-center gap-2 text-red-600 focus:bg-red-50 focus:text-red-700">
                <LogOut className="w-4 h-4" />
                <span>Kijelentkezés</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div className="flex-1"></div>
          <div className="flex items-center gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 rounded-md">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0 mt-2 border-slate-200 shadow-lg rounded-xl overflow-hidden" align="end" sideOffset={8}>
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-semibold text-sm text-slate-900">Értesítések</h3>
                </div>
                <div className="p-8 flex items-center justify-center">
                  <span className="text-sm text-slate-500">Nincs új értesítés</span>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
