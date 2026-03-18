import { useState, type FormEvent, type MouseEvent } from 'react';
import { Search, MapPin, ChevronDown, Filter, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Select } from './ui/select';
import type { SearchResult } from '../types/search-result';
import { getResultId, getVerificationStatusText } from '../types/search-result';
import { EmptyState } from './page/EmptyState';
import { ErrorState } from './page/ErrorState';
import { PageHeader } from './page/PageHeader';
import { StatusNotice } from './page/StatusNotice';
import { WorkflowProgress } from './page/WorkflowProgress';
import { LeadCard } from './LeadCard';
interface SearchBusinessesProps {
  onFilterRelevant: () => void;
  query: string;
  setQuery: (q: string) => void;
  handleSearch: (e?: FormEvent) => void;
  results: SearchResult[];
  searchError?: string | null;
  actionError?: string | null;
  isSearching: boolean;
  currentSearchId?: string | null;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  savingClientIds?: Set<string>;
  hasMore: boolean;
  handleLoadMore: () => void;
  onBusinessSelect: (id: string) => void;
  history: any[];
  onSelectHistory: (searchId: string) => Promise<void>;
  onAddToClients: (business: SearchResult) => void;
  contexts?: any[];
  selectedContextId?: string | null;
  setSelectedContextId?: (id: string) => void;
  createContext?: (name: string, prompt_text: string) => Promise<void>;
}

export function SearchBusinesses({
  onFilterRelevant, query, setQuery, handleSearch, results, searchError, actionError,
  isSearching, currentSearchId, selectedIds, setSelectedIds, savingClientIds = new Set(), hasMore, handleLoadMore, onBusinessSelect,
  history, onSelectHistory, onAddToClients,
  contexts = [], selectedContextId, setSelectedContextId, createContext
}: SearchBusinessesProps) {
  const [isNewContextModalOpen, setIsNewContextModalOpen] = useState(false);
  const [newContextName, setNewContextName] = useState('');
  const [newContextPrompt, setNewContextPrompt] = useState('');
  const [isCreatingContext, setIsCreatingContext] = useState(false);

  const handleSelectAll = () => {
    if (selectedIds.size === results.length) {
      setSelectedIds(new Set());
    } else {
      const allIds = results.map((r) => getResultId(r));
      setSelectedIds(new Set(allIds));
    }
  };

  const toggleSelection = (e: MouseEvent, id: string) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleCreateContextSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newContextName.trim() || !newContextPrompt.trim() || !createContext) return;

    setIsCreatingContext(true);
    try {
      await createContext(newContextName, newContextPrompt);
      setIsNewContextModalOpen(false);
      setNewContextName('');
      setNewContextPrompt('');
    } catch (err) {
      console.error('Failed to create context:', err);
    } finally {
      setIsCreatingContext(false);
    }
  };

  return (
    <div className="p-8 bg-gray-50 dark:bg-black min-h-screen">
      <PageHeader
        title="Search Businesses"
        description="Discover new businesses from multiple sources"
      />
      <WorkflowProgress
        currentStage="search"
        summary="Start with a search, review the results, and choose which businesses should move into the pipeline."
        nextAction={
          isSearching
            ? 'Wait for the current search session to return results.'
            : selectedIds.size > 0
              ? `Continue ${selectedIds.size} selected businesses to relevancy.`
              : results.length > 0
                ? 'Select one or more businesses to continue to relevancy.'
                : 'Run a search to begin the workflow.'
        }
        detail={currentSearchId ? `Search session #${currentSearchId}` : undefined}
      />

      {(isSearching || results.length > 0) && (
        <StatusNotice
          tone={isSearching ? 'info' : selectedIds.size > 0 ? 'success' : 'info'}
          title={
            isSearching
              ? results.length > 0
                ? 'Loading more results from this session'
                : 'Search in progress'
              : selectedIds.size > 0
                ? `${selectedIds.size} businesses selected for relevancy`
                : 'Review the results and choose what moves forward'
          }
          description={
            isSearching
              ? 'The backend is still gathering results. Existing cards remain interactive while the current search session updates.'
              : selectedIds.size > 0
                ? 'Continue to relevancy when you are ready. Businesses already saved to Clients stay marked as saved.'
                : 'Select the businesses that should be scored for relevance before sending them to validation.'
          }
          className="mb-6"
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Top Search Bar */}
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
            <CardContent className="p-6">
              <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500 dark:text-zinc-400" />
                  <Input
                    placeholder="Search new businesses (e.g., Doctors in New York)..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-10 h-12 w-full bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white text-lg"
                    disabled={isSearching}
                  />
                </div>

                {/* AI Context Selector */}
                <div className="flex gap-2 w-full md:w-auto">
                  <Select
                    className="h-12 px-4 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white rounded-md flex-1 md:w-48 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={selectedContextId || ''}
                    onChange={(e) => setSelectedContextId && setSelectedContextId(e.target.value)}
                    disabled={isSearching}
                  >
                    {contexts.length === 0 ? (
                      <option value="">Default AI Context</option>
                    ) : (
                      contexts.map(ctx => (
                        <option key={ctx.id} value={ctx.id.toString()}>
                          {ctx.name}
                        </option>
                      ))
                    )}
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 px-4 bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:text-gray-900 dark:text-white"
                    onClick={() => setIsNewContextModalOpen(true)}
                    disabled={isSearching}
                  >
                    + New
                  </Button>
                </div>

                <Button type="submit" disabled={isSearching || !query.trim()} className="h-12 px-8 bg-blue-600 hover:bg-blue-700 text-gray-900 dark:text-white">
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {isSearching ? 'Scanning...' : 'Search'}
                </Button>
              </form>


            </CardContent>
          </Card>

          {/* Error Message */}
          {searchError && (
            <ErrorState title="Search Failed" message={searchError} />
          )}

          {actionError && (
            <ErrorState title="Unable to update Clients" message={actionError} />
          )}

          {/* Empty State */}
          {!isSearching && !searchError && results.length === 0 && (
            <EmptyState
              title="No businesses found"
              description="Try adjusting your search query or AI context, then select businesses to continue to relevancy."
            />
          )}

          {/* Search Results List */}
          {results.length > 0 && (
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                Selected: {selectedIds.size} / {results.length}
              </span>
              <button
                onClick={handleSelectAll}
                className="text-sm text-blue-400 font-medium hover:text-blue-300 hover:underline"
              >
                {selectedIds.size === results.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          )}

          <div className="space-y-4 mb-6">
            {results.map((business) => {
              const cardId = getResultId(business);
              const isSelected = selectedIds.has(cardId);
              const category = business.types?.[0]?.replace(/_/g, ' ') || 'Local Business';
              const isSavingToClients = savingClientIds.has(cardId);
              const isSavedClient = !!business.is_saved_client;

              return (
                <LeadCard
                  key={cardId}
                  selected={isSelected}
                  onToggleSelect={(e) => toggleSelection(e, cardId)}
                  title={business.business_name || 'Unknown Business'}
                  subtitle={<p className="capitalize truncate">{category}</p>}
                  location={(
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span className="text-sm">{business.address || 'Address not found'}</span>
                    </div>
                  )}
                  badges={(
                    <>
                      <Badge className={
                        getVerificationStatusText(business) === "Verified"
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 inline-flex items-center"
                          : getVerificationStatusText(business) === "Partially Verified"
                            ? "bg-amber-500/10 text-amber-500 border-amber-500/20 inline-flex items-center"
                            : "bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border-gray-300 dark:border-zinc-700 inline-flex items-center"
                      }>
                        {getVerificationStatusText(business) === "Verified" ? (
                          <CheckCircle className="w-3 h-3 mr-1 inline" />
                        ) : (
                          <XCircle className="w-3 h-3 mr-1 inline" />
                        )}
                        {getVerificationStatusText(business)}
                      </Badge>
                      {business.relevance_score != null ? (
                        <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                          Score: {business.relevance_score}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border-gray-300 dark:border-zinc-700">
                          Pending Score
                        </Badge>
                      )}
                      {business.verification_status !== 'completed' && business.relevance_score == null && (
                        <Badge className="bg-blue-600 text-gray-900 dark:text-white border-blue-500 text-xs">
                          New
                        </Badge>
                      )}
                    </>
                  )}
                  actions={(
                    <>
                      <Button variant="outline" className="bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white hover:bg-zinc-700 w-full" onClick={(e) => { e.stopPropagation(); onBusinessSelect(cardId); }}>
                        View Details
                      </Button>
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700 text-gray-900 dark:text-white w-full"
                        onClick={(e) => { e.stopPropagation(); onAddToClients(business); }}
                        disabled={isSavingToClients || isSavedClient}
                      >
                        {isSavingToClients ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {isSavedClient ? 'Saved to Clients' : isSavingToClients ? 'Saving...' : 'Quick Add'}
                      </Button>
                    </>
                  )}
                />
              );
            })}
          </div>

          {/* Bottom Controls */}
          {results.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6 mb-8 lg:col-span-3">
              {hasMore && (
                <Button onClick={handleLoadMore} disabled={isSearching} variant="outline" className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-white hover:bg-gray-100 dark:bg-zinc-800">
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
                  {isSearching ? 'Loading...' : 'Show More Results'}
                </Button>
              )}
              <Button
                onClick={onFilterRelevant}
                disabled={selectedIds.size === 0}
                className="bg-blue-600 hover:bg-blue-700 text-gray-900 dark:text-white disabled:opacity-50"
              >
                <Filter className="w-4 h-4 mr-2" />
                Continue to Relevancy ({selectedIds.size})
              </Button>
            </div>
          )}
        </div>

        {/* Sidebar for History */}
        <div className="lg:col-span-1">
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 overflow-y-auto max-h-[800px] sticky top-8">
            <CardContent className="p-6">
              <h3 className="text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Search className="w-4 h-4 text-gray-500 dark:text-zinc-400" />
                Recent Searches
              </h3>
              {!Array.isArray(history) || history.length === 0 ? (
                <EmptyState
                  title="No recent searches"
                  description="Your recent search sessions will appear here."
                  className="px-4 py-8"
                />
              ) : (
                <div className="space-y-3">
                  {history.map((search: any) => {
                    const searchId = search?.search_id;
                    if (!searchId) return null;

                    return (
                      <div
                        key={searchId}
                        className="p-3 bg-gray-100 dark:bg-zinc-800/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:bg-zinc-800 transition-colors"
                        onClick={() => {
                          if (search.query) setQuery(search.query);
                          if (onSelectHistory) onSelectHistory(searchId.toString());
                        }}
                      >
                        <div className="text-gray-700 dark:text-zinc-300 text-sm font-medium mb-1 truncate">{search.query || search.search_query || 'Unknown Search'}</div>
                        <div className="flex justify-between items-center text-xs text-zinc-500">
                          <span>{search.total_results || 0} results</span>
                          <span>{search.created_at ? new Date(search.created_at).toLocaleString() : 'Date missing'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* New Context Modal Overlay */}
      {isNewContextModalOpen && (
        <div className="fixed inset-0 bg-gray-50 dark:bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-6 rounded-lg w-full max-w-lg">
            <h2 className="text-xl text-gray-900 dark:text-white font-semibold mb-4">Create New AI Context</h2>
            <p className="text-gray-500 dark:text-zinc-400 mb-4 text-sm">Define a new set of rules for the AI agents to use when searching and verifying businesses.</p>

            <form onSubmit={handleCreateContextSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-500 dark:text-zinc-400 text-sm mb-1">Context Name</label>
                <Input
                  placeholder="e.g., Doctors for SaaS"
                  value={newContextName}
                  onChange={(e) => setNewContextName(e.target.value)}
                  className="bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-500 dark:text-zinc-400 text-sm mb-1">AI Prompt / Criteria</label>
                <textarea
                  placeholder="1. Must be a registered medical practice.&#10;2. Should have more than 5 employees... etc."
                  value={newContextPrompt}
                  onChange={(e) => setNewContextPrompt(e.target.value)}
                  className="w-full h-32 p-3 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:text-white"
                  onClick={() => setIsNewContextModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-gray-900 dark:text-white"
                  disabled={isCreatingContext || !newContextName.trim() || !newContextPrompt.trim()}
                >
                  {isCreatingContext ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {isCreatingContext ? 'Saving...' : 'Save Context'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
