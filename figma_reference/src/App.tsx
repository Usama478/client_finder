import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { SearchPage } from './components/SearchPage';
import { BusinessDetailsView } from './components/BusinessDetailsView';
import { DashboardOverview } from './components/DashboardOverview';

type View = 'dashboard' | 'search' | 'business-details' | 'verification' | 'client-management' | 'lead-tracking' | 'api-settings' | 'settings';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);

  const handleBusinessSelect = (businessId: string) => {
    setSelectedBusinessId(businessId);
    setCurrentView('business-details');
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardOverview />;
      case 'search':
        return <SearchPage onBusinessSelect={handleBusinessSelect} />;
      case 'business-details':
        return <BusinessDetailsView businessId={selectedBusinessId} onBack={() => setCurrentView('search')} />;
      case 'verification':
        return <div className="p-8 text-gray-400">Client Verification Report - Coming Soon</div>;
      case 'client-management':
        return <div className="p-8 text-gray-400">Client Management - Coming Soon</div>;
      case 'lead-tracking':
        return <div className="p-8 text-gray-400">Lead Tracking - Coming Soon</div>;
      case 'api-settings':
        return <div className="p-8 text-gray-400">API Settings - Coming Soon</div>;
      case 'settings':
        return <div className="p-8 text-gray-400">Settings - Coming Soon</div>;
      default:
        return <DashboardOverview />;
    }
  };

  return (
    <div className="flex h-screen bg-black">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-[#0a0a0a]">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
