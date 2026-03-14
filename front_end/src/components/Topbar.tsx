import { Bell, HelpCircle, ChevronDown, User, Settings, LogOut } from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface TopbarProps {
  workspaceName?: string;
  userName?: string;
  userEmail?: string;
}

export function Topbar({ 
  workspaceName = "My Workspace", 
  userName = "John Anderson",
  userEmail = "john@example.com"
}: TopbarProps) {
  // Get initials from name
  const initials = userName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="h-14 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between px-6">
      {/* Left side - Workspace indicator */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-primary-500/10 flex items-center justify-center">
            <span className="text-xs font-semibold text-primary-500">
              {workspaceName.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {workspaceName}
          </span>
        </div>
      </div>

      {/* Right side - Actions and user */}
      <div className="flex items-center gap-2">
        {/* Help button */}
        <button 
          className="flex items-center justify-center h-8 w-8 rounded-md text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Help"
        >
          <HelpCircle className="h-4 w-4" />
        </button>

        {/* Notifications button */}
        <button 
          className="relative flex items-center justify-center h-8 w-8 rounded-md text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {/* Notification dot - placeholder for future */}
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
        </button>

        {/* Separator */}
        <div className="h-6 w-px bg-gray-200 dark:bg-zinc-700 mx-1" />

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary-500/10 text-primary-500 text-xs font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="h-3.5 w-3.5 text-gray-500 dark:text-zinc-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{userName}</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400">{userEmail}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-gray-200 dark:bg-zinc-800" />
            <DropdownMenuItem className="text-gray-700 dark:text-zinc-300 focus:bg-gray-100 dark:focus:bg-zinc-800 cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="text-gray-700 dark:text-zinc-300 focus:bg-gray-100 dark:focus:bg-zinc-800 cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-gray-200 dark:bg-zinc-800" />
            <DropdownMenuItem className="text-red-600 dark:text-red-400 focus:bg-red-50 dark:focus:bg-red-900/20 cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
