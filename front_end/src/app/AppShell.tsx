import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();

  // Extract the current path segment for the sidebar active state (e.g. "/search" -> "search")
  const currentPage = location.pathname.split('/')[1] || 'dashboard';

  const handleNavigate = (page: string) => {
    navigate(`/${page}`);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-black">
      {/* Sidebar */}
      <Sidebar currentPage={currentPage} onNavigate={handleNavigate} />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <Topbar 
          workspaceName="My Workspace"
          userName="John Anderson"
          userEmail="john@example.com"
        />
        
        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-black">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
