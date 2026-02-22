import { LayoutDashboard, Search, ShieldCheck, Users, Target, Settings, Code } from 'lucide-react';

type View = 'dashboard' | 'search' | 'verification' | 'client-management' | 'lead-tracking' | 'api-settings' | 'settings';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: View) => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'search', label: 'Search Businesses', icon: Search },
  { id: 'verification', label: 'Client Verification', icon: ShieldCheck },
  { id: 'client-management', label: 'Client Management', icon: Users },
  { id: 'lead-tracking', label: 'Lead Tracking', icon: Target },
  { id: 'api-settings', label: 'API Settings', icon: Code },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  return (
    <aside className="w-64 bg-[#1a1a1a] border-r border-gray-800 flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-600 rounded-lg" />
          <span className="text-white">ClientFinder</span>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id as View)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-gray-800">
        <div className="px-4 py-3 bg-gray-800/50 rounded-lg">
          <div className="text-xs text-gray-500">API Status</div>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-sm text-gray-300">Operational</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
