import React, { useState, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { ResultsTable } from './components/ResultsTable';
import { fetchHistory, startSearch, fetchResults, startRelevancyAgent, startVerificationAgent } from './services/api';

function App() {
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState([]);
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [visibleIds, setVisibleIds] = useState<string[] | null>(null);
  const [processingAction, setProcessingAction] = useState<'relevancy' | 'verification'>('relevancy');

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

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);

    try {
      // 1. Trigger search
      const searchRes = await startSearch(query);

      // 2. Refresh history immediately to show new search
      await loadHistory();

      setSelectedIds(new Set());
      setNextPageToken(searchRes.next_page_token || null);

      // 3. Wait 2 seconds before fetching to prevent 404 race condition
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 4. Fetch results for this exact search ID
      const resultsRes = await fetchResults(searchRes.search_id);
      console.log("Leads received from backend:", resultsRes);
      setResults(Array.isArray(resultsRes) ? resultsRes : resultsRes.results || []);

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

      setError(errorMessage);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectHistory = async (searchId: string) => {
    setIsSearching(true);
    setError(null);
    try {
      const data = await fetchResults(searchId);
      console.log("Leads received from backend:", data);
      setResults(Array.isArray(data) ? data : data.results || []);

      setSelectedIds(new Set());
      const session = history.find((h: any) => h.search_id?.toString() === searchId || h.id?.toString() === searchId);
      setNextPageToken((session as any)?.next_page_token || null);
      setVisibleIds(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load historical results.');
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
      setError(err.response?.data?.detail || 'Failed to load more results.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleStartRelevancy = async () => {
    if (selectedIds.size === 0) return;
    try {
      const idsArray = Array.from(selectedIds);
      await startRelevancyAgent(idsArray);
      setProcessingIds(new Set([...processingIds, ...selectedIds]));
      setVisibleIds(idsArray);
      setProcessingAction('relevancy');
      setSelectedIds(new Set());
    } catch (err: any) {
      console.error(err);
      setError('Failed to start Relevancy Agent.');
    }
  };

  const handleStartVerification = async () => {
    if (selectedIds.size === 0) return;
    try {
      const idsArray = Array.from(selectedIds);
      await startVerificationAgent(idsArray);
      setProcessingIds(new Set([...processingIds, ...selectedIds]));
      setVisibleIds(idsArray);
      setProcessingAction('verification');
      setSelectedIds(new Set());
    } catch (err: any) {
      console.error(err);
      setError('Failed to start Verification Agent.');
    }
  };

  // Calculate stats for Dashboard
  const totalLeads = results.length;
  const verifiedLeads = results.filter((r: any) => r.is_verified).length;

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      <Sidebar history={history} onSelectSearch={handleSelectHistory} />

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Header Region */}
        <header className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between sticky top-0 z-10 shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-brand">Smart Client</h1>
            <p className="text-sm text-slate-500 font-medium">Deep-Web Intelligence Platform</p>
          </div>

          <form onSubmit={handleSearch} className="relative w-full max-w-lg">
            <div className="relative flex items-center">
              <Search className="absolute left-4 w-5 h-5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search businesses (e.g., 'plumbers in Seattle')..."
                className="w-full pl-12 pr-32 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all placeholder:text-slate-400 font-medium text-slate-700 shadow-inner"
                disabled={isSearching}
              />
              <button
                type="submit"
                disabled={isSearching || !query.trim()}
                className="absolute right-2 px-6 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Scanning
                  </>
                ) : (
                  'Search'
                )}
              </button>
            </div>
          </form>
        </header>

        {/* Content Region */}
        <div className="flex-1 overflow-y-auto p-8 relative">

          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 flex-shrink-0 mt-0.5">
                !
              </div>
              <div>
                <h4 className="text-sm font-semibold text-rose-800">Scan Failed</h4>
                <p className="text-sm text-rose-600 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <div className="max-w-7xl mx-auto space-y-6">
            <Dashboard totalLeads={totalLeads} verifiedLeads={verifiedLeads} />

            {results.length > 0 && (
              <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-slate-700">
                    Selected: {selectedIds.size} / {results.length}
                  </span>
                  <button
                    onClick={() => {
                      if (selectedIds.size === results.length) {
                        setSelectedIds(new Set());
                      } else {
                        const allIds = results.map((r: any) => (r.id || r.result_id || r.place_id).toString());
                        setSelectedIds(new Set(allIds));
                      }
                    }}
                    className="text-sm text-primary-600 font-medium hover:text-primary-700 hover:underline"
                  >
                    {selectedIds.size === results.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleStartRelevancy}
                    disabled={selectedIds.size === 0}
                    className="px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                  >
                    🚀 Run Relevancy AI
                  </button>
                  <button
                    onClick={handleStartVerification}
                    disabled={selectedIds.size === 0}
                    className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                  >
                    🛡️ Run Verification AI
                  </button>
                </div>
              </div>
            )}

            <div className="h-[calc(100vh-320px)] min-h-[400px]">
              <ResultsTable
                results={results}
                isLoading={isSearching}
                onLoadMore={handleLoadMore}
                hasMore={!!nextPageToken}
                selectedIds={selectedIds}
                processingIds={processingIds}
                processingAction={processingAction}
                visibleIds={visibleIds}
                onSelect={(id) => {
                  const newSet = new Set(selectedIds);
                  if (newSet.has(id)) newSet.delete(id);
                  else newSet.add(id);
                  setSelectedIds(newSet);
                }}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
