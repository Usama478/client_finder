import { Bell, User } from 'lucide-react';
import { Badge } from './ui/badge';

export function Header() {
  return (
    <header className="h-16 bg-[#1a1a1a] border-b border-gray-800 flex items-center justify-between px-8">
      <div className="flex items-center gap-4">
        <div>
          <div className="text-sm text-gray-400">Welcome back</div>
          <div className="text-white">John Anderson</div>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span className="text-sm text-gray-400">All Systems Operational</span>
        </div>
        
        <div className="w-px h-6 bg-gray-800" />
        
        <button className="relative p-2 text-gray-400 hover:text-gray-200 rounded-lg hover:bg-gray-800 transition-colors">
          <Bell className="w-5 h-5" />
          <Badge className="absolute -top-1 -right-1 bg-red-500 text-white border-0 px-1.5 min-w-5 h-5">
            3
          </Badge>
        </button>
        
        <button className="flex items-center gap-2 p-2 text-gray-400 hover:text-gray-200 rounded-lg hover:bg-gray-800 transition-colors">
          <div className="w-8 h-8 bg-gradient-to-br from-gray-600 to-gray-800 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-gray-300" />
          </div>
        </button>
      </div>
    </header>
  );
}
