import {
  Shield,
  CreditCard,
  History,
  LayoutDashboard,
  Layers3,
  Mail,
  Search,
  Settings,
  Users,
} from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const menuSections = [
  {
    title: 'Workspace',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'search', label: 'Search Businesses', icon: Search },
      { id: 'clients', label: 'Clients', icon: Users },
      { id: 'contexts', label: 'Contexts', icon: Layers3 },
      { id: 'activity', label: 'Activity', icon: History },
    ],
  },
  {
    title: 'Account',
    items: [
      { id: 'billing', label: 'Billing', icon: CreditCard },
      { id: 'settings', label: 'Settings', icon: Settings },
      { id: 'email', label: 'Email Management', icon: Mail },
      { id: 'admin', label: 'Admin', icon: Shield },
    ],
  },
];

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <div className="w-64 bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 flex flex-col">
      <div className="p-6 border-b border-gray-200 dark:border-zinc-800">
        <h1 className="text-gray-900 dark:text-white text-xl">Client Finder</h1>
        <p className="text-gray-500 dark:text-zinc-400 text-sm mt-1">Verification System</p>
      </div>
      
      <nav className="flex-1 p-4">
        <div className="space-y-6">
          {menuSections.map((section) => (
            <div key={section.title}>
              <div className="mb-2 px-4 text-xs font-semibold uppercase tracking-[0.22em] text-gray-400 dark:text-zinc-500">
                {section.title}
              </div>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`mb-1 flex w-full items-center gap-3 rounded-lg px-4 py-3 transition-all ${
                      isActive
                        ? 'bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white'
                        : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800/50 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}
