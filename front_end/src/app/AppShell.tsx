import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();

  // Extract the current path segment for the sidebar active state (e.g. "/search" -> "search")
  const currentPage = location.pathname.split('/')[1] || 'dashboard';

  const handleNavigate = (page: string) => {
    navigate(`/${page}`);
  };

  return (
    <div className={`flex h-screen bg-gray-50 dark:bg-black transition-colors duration-200`}>
      <Sidebar currentPage={currentPage} onNavigate={handleNavigate} />
      <main className="flex-1 overflow-auto bg-gray-50 dark:bg-black transition-colors duration-200">
        <Outlet />
      </main>
    </div>
  );
}
