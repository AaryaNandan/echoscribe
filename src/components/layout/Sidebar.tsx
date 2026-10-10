import React from 'react';
import {
  LayoutDashboard,
  CalendarCheck,
  CheckSquare,
  PlusCircle,
  BarChart3,
  History,
  Settings,
  Sparkles,
} from 'lucide-react';

export type NavItem =
  | 'dashboard'
  | 'meetings'
  | 'action-items'
  | 'new-meeting'
  | 'analytics'
  | 'audit-log'
  | 'settings';

interface SidebarProps {
  currentTab: NavItem;
  onSelectTab: (tab: NavItem) => void;
  pendingCount?: number;
  reviewCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  pendingCount = 0,
  reviewCount = 0,
}) => {
  const navItems = [
    {
      id: 'dashboard' as NavItem,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'new-meeting' as NavItem,
      label: 'New Meeting',
      icon: PlusCircle,
      highlight: true,
    },
    {
      id: 'meetings' as NavItem,
      label: 'Meetings',
      icon: CalendarCheck,
    },
    {
      id: 'action-items' as NavItem,
      label: 'Action Items',
      icon: CheckSquare,
      badge: pendingCount > 0 ? pendingCount : undefined,
      badgeColor: 'bg-amber-100 text-amber-800',
    },
    {
      id: 'analytics' as NavItem,
      label: 'Analytics',
      icon: BarChart3,
    },
    {
      id: 'audit-log' as NavItem,
      label: 'Audit Trail',
      icon: History,
      badge: reviewCount > 0 ? `${reviewCount} review` : undefined,
      badgeColor: 'bg-rose-100 text-rose-800',
    },
    {
      id: 'settings' as NavItem,
      label: 'Settings',
      icon: Settings,
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 min-h-screen border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-white text-sm tracking-tight leading-tight">
            Action Tracker
          </h1>
          <p className="text-[11px] text-slate-400 font-mono font-medium">
            Forward Deployed AI
          </p>
        </div>
      </div>

      {/* Navigation list */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Core Workflow
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                  : item.highlight
                  ? 'bg-slate-800/80 text-cyan-300 hover:bg-slate-800 hover:text-cyan-200'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 ${
                    isActive
                      ? 'text-white'
                      : item.highlight
                      ? 'text-cyan-400'
                      : 'text-slate-400'
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : item.badgeColor || 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Architecture Badge */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="rounded-lg bg-slate-800/60 p-3 border border-slate-700/50">
          <div className="flex items-center justify-between text-xs text-slate-300 font-medium mb-1.5">
            <span>Model Engine</span>
            <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/80 px-1.5 py-0.2 rounded font-mono">
              gemini-3.8-flash
            </span>
          </div>
          <div className="text-[11px] text-slate-400 leading-relaxed">
            Enterprise extraction with confidence scoring & duplicate detection.
          </div>
        </div>
      </div>
    </aside>
  );
};
