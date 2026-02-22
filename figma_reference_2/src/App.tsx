import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Clients } from './components/Clients';
import { SearchBusinesses } from './components/SearchBusinesses';
import { RelevancyFilter } from './components/RelevancyFilter';
import { BusinessValidation } from './components/BusinessValidation';
import { BusinessDetails } from './components/BusinessDetails';
import { EmailManagement } from './components/EmailManagement';
import { Settings } from './components/Settings';

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectedBusiness, setSelectedBusiness] = useState<any>(null);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'clients':
        return <Clients onSelectBusiness={(business) => {
          setSelectedBusiness(business);
          setCurrentPage('business-details');
        }} />;
      case 'search':
        return <SearchBusinesses onFilterRelevant={() => setCurrentPage('relevancy')} />;
      case 'relevancy':
        return <RelevancyFilter onValidate={() => setCurrentPage('validation')} />;
      case 'validation':
        return <BusinessValidation />;
      case 'business-details':
        return <BusinessDetails business={selectedBusiness} onBack={() => setCurrentPage('clients')} />;
      case 'email':
        return <EmailManagement />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-black">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="flex-1 overflow-auto">
        {renderPage()}
      </main>
    </div>
  );
}