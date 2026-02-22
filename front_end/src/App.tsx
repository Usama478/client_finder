import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { DashboardOverview } from './components/DashboardOverview';
import { SearchBusinesses } from './components/SearchBusinesses';
import { RelevancyFilter } from './components/RelevancyFilter';
import { BusinessValidation } from './components/BusinessValidation';
import { Clients } from './components/Clients';
import { BusinessDetails } from './components/BusinessDetails';
import { fetchHistory, startSearch, fetchResults, startRelevancyAgent, startVerificationAgent, toggleClientStatus, fetchSavedClients } from './services/api';

function App() {
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState([]);
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);

  type ViewType = 'dashboard' | 'clients' | 'search' | 'relevancy' | 'validation' | 'business-details' | 'email' | 'settings';
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [previousView, setPreviousView] = useState<ViewType>('search');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [processingAction, setProcessingAction] = useState<'relevancy' | 'verification'>('relevancy');
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);

  // Funnel tracking states
  const [activeRelevancyIds, setActiveRelevancyIds] = useState<string[]>([]);
  const [activeValidationIds, setActiveValidationIds] = useState<string[]>([]);

  // Polling for live agent updates
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (processingIds.size > 0 && results.length > 0) {
      const processingItem = results.find(r => processingIds.has((r.id || r.result_id || r.place_id).toString()));
      const currentSearchId = processingItem?.search_id || (results[0] as any).search_id;

      if (currentSearchId) {
        interval = setInterval(async () => {
          try {
            const resultsRes = await fetchResults(currentSearchId);
            const newResults: any[] = Array.isArray(resultsRes) ? resultsRes : resultsRes.results || [];

            setResults(newResults);

            setProcessingIds(prev => {
              const stillProcessing = new Set<string>();
              prev.forEach(idStr => {
                const r = newResults.find((res: any) => (res.id || res.result_id || res.place_id).toString() === idStr);
                if (r) {
                  let isRelevancyDone = false;
                  let isVerificationDone = false;

                  if (processingAction === 'relevancy') {
                    isRelevancyDone = r.relevance_status && r.relevance_status.toLowerCase() !== 'pending';
                  } else if (processingAction === 'verification') {
                    isVerificationDone = r.verification_status && r.verification_status.toLowerCase() !== 'pending';
                  }

                  if (isRelevancyDone || isVerificationDone) {
                    // Remove from processingIds
                  } else {
                    stillProcessing.add(idStr);
                  }
                }
              });
              return stillProcessing;
            });
          } catch (e) {
            console.error('Polling error:', e);
          }
        }, 3000);
      }
    }

    return () => {
      if (interval) clearInterval(interval);
    };
    // STRICLY REMOVED 'results' and 'processingIds' from array to prevent infinite re-renders.
    // We only depend on the size and the action string.
  }, [processingIds.size, processingAction]);

  // Load history and saved clients on mount
  useEffect(() => {
    loadHistory();
    loadSavedClients();
  }, []);

  const loadSavedClients = async () => {
    try {
      const saved = await fetchSavedClients();
      if (Array.isArray(saved) && saved.length > 0) {
        setResults(prev => {
          const map = new Map(prev.map(r => [r.place_id, r]));
          saved.forEach(r => map.set(r.place_id, r));
          return Array.from(map.values());
        });
      }
    } catch (err) {
      console.error('Failed to load saved clients exactly on mount:', err);
    }
  };

  const loadHistory = async () => {
    try {
      const data = await fetchHistory();
      setHistory(Array.isArray(data) ? data : data.history || []);
    } catch (err) {
      console.error('Failed to load history:', err);
      // Fallback for empty state or error
      setHistory([]);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setCurrentView('search');

    try {
      // 1. Trigger search
      const searchRes = await startSearch(query);

      // 2. Refresh history immediately to show new search
      await loadHistory();

      setSelectedIds(new Set());
      setProcessingIds(new Set());
      setActiveRelevancyIds([]);
      setActiveValidationIds([]);
      setNextPageToken(searchRes.next_page_token || null);

      // 3. Wait 2 seconds before fetching to prevent 404 race condition
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 4. Fetch results for this exact search ID
      const resultsRes = await fetchResults(searchRes.search_id);
      console.log("Leads received from backend:", resultsRes);
      setResults(prev => {
        const newRes = Array.isArray(resultsRes) ? resultsRes : resultsRes.results || [];
        const map = new Map(prev.filter(r => r.is_saved_client).map(r => [r.place_id, r])); // keep saved clients
        newRes.forEach((r: any) => map.set(r.place_id, r));
        return Array.from(map.values());
      });

    } catch (err: any) {
      console.error('Search failed:', err);
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      let errorMessage = detail || 'An error occurred while searching. Please try again.';

      if (status === 404) {
        errorMessage = `Results not found (404). The background scan might need more time or the search ID is invalid. Details: ${detail || ''}`;
      } else if (status === 500) {
        errorMessage = `Internal Server Error (500). Something went wrong on the backend. Details: ${detail || ''}`;
      } else if (status) {
        errorMessage = `Error ${status}: ${detail || 'Unknown error'}`;
      }

      console.error(errorMessage);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectHistory = async (searchId: string) => {
    setIsSearching(true);
    setCurrentView('search');
    try {
      const data = await fetchResults(searchId);
      console.log("Leads received from backend:", data);
      setResults(prev => {
        const newRes = Array.isArray(data) ? data : data.results || [];
        const map = new Map(prev.filter(r => r.is_saved_client).map(r => [r.place_id, r])); // keep saved clients
        newRes.forEach((r: any) => map.set(r.place_id, r));
        return Array.from(map.values());
      });

      setSelectedIds(new Set());
      setProcessingIds(new Set());
      setActiveRelevancyIds([]);
      setActiveValidationIds([]);
      const session = Array.isArray(history) ? history.find((h: any) => h.search_id?.toString() === searchId || h.id?.toString() === searchId) : null;
      setNextPageToken((session as any)?.next_page_token || null);
    } catch (err: any) {
      console.error(err.response?.data?.detail || 'Failed to load historical results.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleLoadMore = async () => {
    if (!nextPageToken) return;
    setIsSearching(true);
    try {
      const searchRes = await startSearch(query, nextPageToken);
      await new Promise(resolve => setTimeout(resolve, 2000));
      const resultsRes = await fetchResults(searchRes.search_id);

      const newResults: any[] = Array.isArray(resultsRes) ? resultsRes : resultsRes.results || [];

      setResults((prev: any[]) => {
        const map = new Map(prev.map((r: any) => [r.place_id, r]));
        newResults.forEach(r => map.set(r.place_id, r));
        return Array.from(map.values()) as any;
      });
      setNextPageToken(searchRes.next_page_token || null);
    } catch (err: any) {
      console.error(err);
      console.error(err.response?.data?.detail || 'Failed to load more results.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleStartRelevancy = async () => {
    if (selectedIds.size === 0) return;
    try {
      const idsArray = Array.from(selectedIds);
      setActiveRelevancyIds(idsArray);
      await startRelevancyAgent(idsArray);
      setProcessingIds(new Set([...processingIds, ...selectedIds]));
      setProcessingAction('relevancy');
      setSelectedIds(new Set());
    } catch (err: any) {
      console.error(err);
      console.error('Failed to start Relevancy Agent.');
    }
  };

  const handleAdvanceToRelevancy = async () => {
    await handleStartRelevancy();
    setCurrentView('relevancy');
  };

  const handleAdvanceToValidation = async (idsToValidate: string[]) => {
    if (idsToValidate.length > 0) {
      try {
        setActiveValidationIds(idsToValidate);
        await startVerificationAgent(idsToValidate);
        setProcessingIds(new Set([...processingIds, ...idsToValidate]));
        setProcessingAction('verification');
        setSelectedIds(new Set());
        setCurrentView('validation');
      } catch (err: any) {
        console.error(err);
        console.error('Failed to start Verification Agent.');
      }
    }
  };

  // Calculate stats for Dashboard
  const totalLeads = results.length;

  const handleBusinessSelect = (businessId: string) => {
    setPreviousView(currentView);
    setSelectedBusinessId(businessId);
    setCurrentView('business-details');
  };

  const handleAddToClients = async (business: any) => {
    const idStr = (business.id || business.result_id || business.place_id).toString();
    try {
      await toggleClientStatus(idStr, true);
      setResults(prev => prev.map(r => {
        if ((r.id || r.result_id || r.place_id).toString() === idStr) {
          return { ...r, is_saved_client: true };
        }
        return r;
      }));
    } catch (err) {
      console.error('Failed to quick add to clients:', err);
    }
  };

  const handleAddMultipleToClients = async (ids: string[]) => {
    try {
      await Promise.all(ids.map(id => toggleClientStatus(id, true)));
      setResults(prev => prev.map(r => {
        if (ids.includes((r.id || r.result_id || r.place_id).toString())) {
          return { ...r, is_saved_client: true };
        }
        return r;
      }));
    } catch (err) {
      console.error('Failed to add multiple to clients:', err);
    }
  };

  const handleRemoveFromClients = async (ids: string[]) => {
    try {
      await Promise.all(ids.map(id => toggleClientStatus(id, false)));
      setResults(prev => prev.map(r => {
        if (ids.includes((r.id || r.result_id || r.place_id).toString())) {
          return { ...r, is_saved_client: false };
        }
        return r;
      }));
    } catch (err) {
      console.error('Failed to remove from clients:', err);
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <DashboardOverview
            totalLeads={totalLeads}
            history={history}
            onSelectHistory={handleSelectHistory}
            results={results}
          />
        );
      case 'search':
        return (
          <SearchBusinesses
            query={query}
            setQuery={setQuery}
            handleSearch={handleSearch}
            results={results}
            isSearching={isSearching}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            hasMore={!!nextPageToken}
            handleLoadMore={handleLoadMore}
            onBusinessSelect={handleBusinessSelect}
            onFilterRelevant={handleAdvanceToRelevancy}
            history={history}
            onSelectHistory={handleSelectHistory}
            onAddToClients={handleAddToClients}
          />
        );
      case 'relevancy':
        return (
          <RelevancyFilter
            results={results.filter(r => activeRelevancyIds.includes((r.id || r.result_id || r.place_id)?.toString()))}
            processingIds={processingIds}
            isVerifying={processingIds.size > 0 && processingAction === 'verification'}
            onValidate={handleAdvanceToValidation}
            onBack={() => setCurrentView('search')}
            onSelectBusiness={handleBusinessSelect}
          />
        );
      case 'validation':
        return (
          <BusinessValidation
            results={results.filter(r => activeValidationIds.includes((r.id || r.result_id || r.place_id)?.toString()))}
            processingIds={processingIds}
            onAddToClients={(ids) => {
              handleAddMultipleToClients(ids);
              setCurrentView('clients');
            }}
            onBack={() => setCurrentView('search')}
            onSelectBusiness={handleBusinessSelect}
          />
        );
      case 'clients':
        return (
          <Clients
            results={results}
            processingIds={processingIds}
            processingAction={processingAction}
            onSelectBusiness={handleBusinessSelect}
            onRunRelevancy={(ids) => {
              setProcessingIds(prev => new Set([...prev, ...ids]));
              setProcessingAction('relevancy');
              startRelevancyAgent(ids).catch(console.error);
            }}
            onRunVerification={(ids) => {
              setProcessingIds(prev => new Set([...prev, ...ids]));
              setProcessingAction('verification');
              startVerificationAgent(ids).catch(console.error);
            }}
            onRemoveFromClients={handleRemoveFromClients}
          />
        );
      case 'business-details':
        const selectedBusiness = results.find(r => (r.id || r.result_id || r.place_id)?.toString() === selectedBusinessId) || null;
        return (
          <BusinessDetails
            business={selectedBusiness}
            onBack={() => setCurrentView(previousView)}
          />
        );
      default:
        return (
          <DashboardOverview
            totalLeads={totalLeads}
            history={history}
            onSelectHistory={handleSelectHistory}
            results={results}
          />
        );
    }
  };

  return (
    <div className="flex h-screen bg-black">
      <Sidebar currentPage={currentView} onNavigate={setCurrentView as any} />
      <main className="flex-1 overflow-auto bg-black">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
