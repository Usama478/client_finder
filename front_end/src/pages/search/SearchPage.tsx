import { useEffect, useState, type FormEvent } from 'react';

import { useNavigate, useLocation } from 'react-router-dom';
import { SearchBusinesses } from '../../components/SearchBusinesses';
import { fetchHistory, startSearch, fetchResults, fetchContexts, createContext, toggleClientStatus } from '../../services/api';
import type { SearchContext } from '../../types/search-context';
import type { SearchResult } from '../../types/search-result';
import type { SearchSession } from '../../types/search-session';
import { getResultId } from '../../types/search-result';
import type { BusinessDetailsNavigationState } from '../../types/workflow';

export function SearchPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialSearchId = queryParams.get('id');
  const requestedContextId = queryParams.get('context');

  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<SearchSession[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [currentSearchId, setCurrentSearchId] = useState<string | null>(initialSearchId);
  const [contexts, setContexts] = useState<SearchContext[]>([]);
  const [selectedContextId, setSelectedContextId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [savingClientIds, setSavingClientIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
    loadContexts();
  }, []);

  useEffect(() => {
    if (initialSearchId && initialSearchId !== currentSearchId) {
      handleSelectHistory(initialSearchId);
    }
  }, [initialSearchId]);

  const loadContexts = async () => {
    try {
      const data = await fetchContexts();
      const availableContexts: SearchContext[] = Array.isArray(data) ? data : [];
      setContexts(availableContexts);
      if (requestedContextId && availableContexts.some((context) => context.id.toString() === requestedContextId)) {
        setSelectedContextId(requestedContextId);
      } else if (availableContexts.length > 0) {
        setSelectedContextId(availableContexts[0].id.toString());
      }
    } catch (err) {
      console.error('Failed to load contexts:', err);
    }
  };

  const loadHistory = async () => {
    try {
      const data = await fetchHistory();
      setHistory(Array.isArray(data) ? data : data.history || []);
    } catch (err) {
      console.error('Failed to load history:', err);
      setHistory([]);
    }
  };

  const handleSearch = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setActionError(null);

    try {
      const searchRes = await startSearch(query, undefined, selectedContextId);
      await loadHistory();
      
      setSelectedIds(new Set());
      setNextPageToken(searchRes.next_page_token || null);

      await new Promise(resolve => setTimeout(resolve, 2000));

      const resultsRes = await fetchResults(searchRes.search_id);
      setCurrentSearchId(searchRes.search_id.toString());
      // Update URL without triggering a full reload
      navigate(`/search?id=${searchRes.search_id}`, { replace: true });

      setResults((prev: SearchResult[]) => {
        const newRes: SearchResult[] = Array.isArray(resultsRes) ? resultsRes : resultsRes.results || [];
        const map = new Map(prev.filter((r: SearchResult) => r.is_saved_client).map((r: SearchResult) => [r.result_id, r])); 
        newRes.forEach((r: SearchResult) => map.set(r.result_id, r));
        return Array.from(map.values());
      });

    } catch (err: any) {
      console.error('Search failed:', err);
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      setSearchError(detail || `Error ${status || 'Unknown'}: An error occurred while searching.`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectHistory = async (searchId: string) => {
    setIsSearching(true);
    setCurrentSearchId(searchId.toString());
    setSearchError(null);
    setActionError(null);
    navigate(`/search?id=${searchId}`, { replace: true });
    
    try {
      const data = await fetchResults(searchId);
      setResults((prev: SearchResult[]) => {
        const newRes: SearchResult[] = Array.isArray(data) ? data : [];
        const map = new Map(prev.filter((r: SearchResult) => r.is_saved_client).map((r: SearchResult) => [r.result_id, r]));
        newRes.forEach((r: SearchResult) => map.set(r.result_id, r));
        return Array.from(map.values());
      });

      setSelectedIds(new Set());
      const session = history.find((h) => h.search_id?.toString() === searchId);
      if (session?.query || session?.search_query) {
        setQuery(session.query || session.search_query || '');
      }
      setNextPageToken(session?.next_page_token || null);
    } catch (err: any) {
      setSearchError(err.response?.data?.detail || 'Failed to load historical results.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleLoadMore = async () => {
    if (!nextPageToken) return;
    setIsSearching(true);
    try {
      const searchRes = await startSearch(query, nextPageToken, selectedContextId);
      await new Promise(resolve => setTimeout(resolve, 2000));
      const resultsRes = await fetchResults(searchRes.search_id);
      const newResults: SearchResult[] = Array.isArray(resultsRes) ? resultsRes : resultsRes.results || [];

      setResults((prev: SearchResult[]) => {
        const map = new Map(prev.map((r: SearchResult) => [r.result_id, r]));
        newResults.forEach((r: SearchResult) => map.set(r.result_id, r));
        return Array.from(map.values());
      });
      setNextPageToken(searchRes.next_page_token || null);
    } catch (err: any) {
      console.error(err);
      setSearchError(err.response?.data?.detail || 'Failed to load more results for this search session.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAdvanceToRelevancy = () => {
    if (selectedIds.size === 0) return;
    // Pass selected IDs via state to the relevancy page
    navigate('/relevancy', { state: { selectedIds: Array.from(selectedIds), searchId: currentSearchId } });
  };

  const handleBusinessSelect = (businessId: string) => {
    const business = results.find((result) => getResultId(result) === businessId) ?? null;
    const state: BusinessDetailsNavigationState = {
      business,
      sourceStage: 'search',
      sourceLabel: 'Search',
      searchId: currentSearchId,
    };

    navigate(`/business/${businessId}`, { state });
  };

  const handleAddToClients = async (business: SearchResult) => {
    const resultId = getResultId(business);

    setActionError(null);
    setSavingClientIds((prev) => new Set(prev).add(resultId));

    try {
      await toggleClientStatus(resultId, true);
      setResults((prev) =>
        prev.map((result) =>
          getResultId(result) === resultId
            ? { ...result, is_saved_client: true }
            : result,
        ),
      );
    } catch (err: any) {
      console.error('Failed to add business to clients:', err);
      setActionError(err.response?.data?.detail || 'Unable to save this business to Clients right now.');
    } finally {
      setSavingClientIds((prev) => {
        const next = new Set(prev);
        next.delete(resultId);
        return next;
      });
    }
  };

  return (
    <SearchBusinesses
      query={query}
      setQuery={setQuery}
      handleSearch={handleSearch}
      results={currentSearchId ? results.filter((r) => r.search_id?.toString() === currentSearchId) : []}
      searchError={searchError}
      actionError={actionError}
      isSearching={isSearching}
      currentSearchId={currentSearchId}
      selectedIds={selectedIds}
      setSelectedIds={setSelectedIds}
      savingClientIds={savingClientIds}
      hasMore={!!nextPageToken}
      handleLoadMore={handleLoadMore}
      onBusinessSelect={handleBusinessSelect}
      onFilterRelevant={handleAdvanceToRelevancy}
      history={history}
      onSelectHistory={handleSelectHistory}
      onAddToClients={handleAddToClients}
      contexts={contexts}
      selectedContextId={selectedContextId}
      setSelectedContextId={setSelectedContextId}
      createContext={async (name: string, prompt_text: string) => {
        const newContext = await createContext(name, prompt_text);
        setContexts([...contexts, newContext]);
        setSelectedContextId(newContext.id.toString());
      }}
    />
  );
}
