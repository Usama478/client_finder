import {
  Shield,
  CreditCard,
  History,
  LayoutDashboard,
  Layers3,
  Mail,
  Search,
  Users,
  Target,
  ShieldCheck,
} from 'lucide-react';
import { cn } from './ui/utils';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const menuSections = [
  {
    title: 'Workspace',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'search', label: 'Search', icon: Search },
      { id: 'relevancy', label: 'Relevancy', icon: Target },
      { id: 'validation', label: 'Verification', icon: ShieldCheck },
      { id: 'clients', label: 'Clients', icon: Users },
      { id: 'activity', label: 'Activity', icon: History },
    ],
  },
  {
    title: 'System',
    items: [
      { id: 'contexts', label: 'Contexts', icon: Layers3 },
      { id: 'email', label: 'Outreach', icon: Mail },
      { id: 'billing', label: 'Billing', icon: CreditCard },
      { id: 'admin', label: 'Admin', icon: Shield },
    ],
  },
];

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="w-60 bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 flex flex-col">
      {/* Brand Header */}
      <div className="h-14 flex items-center px-5 border-b border-gray-200 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary-500 flex items-center justify-center">
            <Search className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
              Client Finder
            </h1>
          </div>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <div className="space-y-6">
          {menuSections.map((section) => (
            <div key={section.title}>
              {/* Section Label */}
              <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                {section.title}
              </div>
              
              {/* Section Items */}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.id)}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary-500/10 text-primary-600 dark:text-primary-400"
                          : "text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white"
                      )}
                    >
                      <Icon className={cn(
                        "h-4 w-4 shrink-0",
                        isActive 
                          ? "text-primary-500" 
                          : "text-gray-400 dark:text-zinc-500 group-hover:text-gray-600 dark:group-hover:text-zinc-300"
                      )} />
                      <span>{item.label}</span>
                      
                      {/* Active indicator */}
                      {isActive && (
                        <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* Footer - Version or status */}
      <div className="px-5 py-3 border-t border-gray-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-xs text-gray-500 dark:text-zinc-500">All systems operational</span>
        </div>
      </div>
    </aside>
  );
}
