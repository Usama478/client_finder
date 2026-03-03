import React, { useState } from 'react';
import { Search, MapPin, Filter, Star, Building2, Loader2, CheckSquare, Square } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import type { SearchResult } from '../types/search-result';
import { getResultId, getVerificationBucket } from '../types/search-result';

interface SearchPageProps {
  query: string;
  setQuery: (q: string) => void;
  handleSearch: (e?: React.FormEvent) => void;
  results: SearchResult[];
  isSearching: boolean;
  error: string | null;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  processingIds: Set<string>;
  processingAction: 'relevancy' | 'verification';
  handleStartRelevancy: () => void;
  handleStartVerification: () => void;
  onBusinessSelect: (id: string) => void;
  handleLoadMore: () => void;
  hasMore: boolean;
}

export function SearchPage({
  query, setQuery, handleSearch, results, isSearching, error,
  selectedIds, setSelectedIds, processingIds, processingAction,
  handleStartRelevancy, handleStartVerification, onBusinessSelect,
  handleLoadMore, hasMore
}: SearchPageProps) {
  const [selectedVerification, setSelectedVerification] = useState('all');

  const verificationStatuses = ['all', 'verified', 'partially-verified', 'not-verified'];

  const getVerificationStatus = (business: SearchResult) => getVerificationBucket(business);

  let filteredBusinesses = results;
  if (selectedVerification !== 'all') {
    filteredBusinesses = filteredBusinesses.filter(b => getVerificationStatus(b) === selectedVerification);
  }

  const getVerificationBadge = (business: any) => {
    const status = getVerificationStatus(business);
    const variants: Record<string, string> = {
      'verified': 'bg-green-500/10 text-green-400 border-green-500/20',
      'partially-verified': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      'not-verified': 'bg-red-500/10 text-red-400 border-red-500/20'
    };

    const labels: Record<string, string> = {
      'verified': 'Verified',
      'partially-verified': 'Partial Verification',
      'not-verified': 'Not Verified'
    };

    return (
      <Badge className={`${variants[status]} border`}>
        {labels[status]}
      </Badge>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-gray-900 dark:text-white text-2xl font-bold mb-2">Search Businesses & Clients</h1>
        <p className="text-gray-600 dark:text-gray-400">Find and verify business information across multiple data sources</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-xl flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-red-900/50 flex items-center justify-center text-red-400 flex-shrink-0 mt-0.5">
            !
          </div>
          <div>
            <h4 className="text-sm font-semibold text-red-400">Scan Failed</h4>
            <p className="text-sm text-red-300 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-6 shadow-lg">
        <form onSubmit={handleSearch} className="flex gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search businesses (e.g. 'plumbers in Seattle')..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-gray-50 dark:bg-black border border-gray-700 rounded-lg pl-12 pr-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-gray-600 transition-colors"
              disabled={isSearching}
            />
          </div>
          <Button type="submit" disabled={isSearching || !query.trim()} className="bg-gray-700 hover:bg-gray-600 text-gray-900 dark:text-white px-6">
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {isSearching ? 'Scanning...' : 'Search'}
          </Button>
        </form>

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Filters:</span>
          </div>

          <select
            value={selectedVerification}
            onChange={(e) => setSelectedVerification(e.target.value)}
            className="bg-gray-50 dark:bg-black border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:border-gray-600"
          >
            {verificationStatuses.map(status => (
              <option key={status} value={status}>
                {status === 'all' ? 'All Statuses' : status.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </option>
            ))}
          </select>

          {selectedVerification !== 'all' && (
            <Button
              onClick={() => setSelectedVerification('all')}
              variant="ghost"
              className="text-gray-600 dark:text-gray-400 hover:text-gray-200 text-sm h-8"
            >
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {results.length > 0 && (
        <div className="flex items-center justify-between mb-4 bg-[#1a1a1a] p-4 rounded-xl border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
              Selected: {selectedIds.size} / {results.length}
            </span>
            <button
              onClick={() => {
                if (selectedIds.size === results.length) {
                  setSelectedIds(new Set());
                } else {
                  const allIds = results.map((r) => getResultId(r));
                  setSelectedIds(new Set(allIds));
                }
              }}
              className="text-sm text-blue-400 font-medium hover:text-blue-300 hover:underline"
            >
              {selectedIds.size === results.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleStartRelevancy}
              disabled={selectedIds.size === 0}
              className="bg-blue-600 hover:bg-blue-700 text-gray-900 dark:text-white disabled:opacity-50 flex items-center gap-2"
            >
              🚀 Run Relevancy AI
            </Button>
            <Button
              onClick={handleStartVerification}
              disabled={selectedIds.size === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-gray-900 dark:text-white disabled:opacity-50 flex items-center gap-2"
            >
              🛡️ Run Verification AI
            </Button>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="mb-4 text-gray-600 dark:text-gray-400">
        Showing {filteredBusinesses.length} {filteredBusinesses.length === 1 ? 'result' : 'results'}
      </div>

      <div className="space-y-4">
        {filteredBusinesses.map((business) => {
          const cardId = getResultId(business);
          const isSelected = selectedIds.has(cardId);
          const isProcessing = processingIds.has(cardId);

          return (
            <div
              key={cardId}
              onClick={() => onBusinessSelect(cardId)}
              className={`bg-[#1a1a1a] border ${isSelected ? 'border-blue-500' : 'border-gray-200 dark:border-gray-800'} rounded-xl p-6 hover:border-gray-600 transition-all cursor-pointer group shadow-lg relative`}
            >
              {/* Card Selection */}
              <div
                className="absolute left-6 top-6 cursor-pointer z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  const newSet = new Set(selectedIds);
                  if (isSelected) newSet.delete(cardId);
                  else newSet.add(cardId);
                  setSelectedIds(newSet);
                }}
              >
                {isSelected ? (
                  <CheckSquare className="w-5 h-5 text-blue-500" />
                ) : (
                  <Square className="w-5 h-5 text-gray-500 group-hover:text-gray-600 dark:text-gray-400" />
                )}
              </div>

              <div className="flex items-start justify-between pl-8">
                <div className="flex-1">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-900 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-gray-900 dark:text-white group-hover:text-gray-700 dark:text-gray-300 transition-colors mb-1 truncate text-lg font-semibold">
                            {business.business_name || 'Unknown Business'}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <span className="capitalize">{business.types?.[0]?.replace(/_/g, ' ') || 'Local Business'}</span>
                            {business.relevance_score != null && (
                              <>
                                <span>•</span>
                                <div className={`flex items-center gap-1 font-semibold ${business.relevance_score > 70 ? 'text-green-400' : business.relevance_score > 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                  <span>Relevance: {business.relevance_score}</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {getVerificationBadge(business)}
                          {isProcessing && (
                            <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 border text-xs">
                              <Loader2 className="w-3 h-3 animate-spin mr-1 inline" />
                              {processingAction === 'relevancy' ? 'AI Analyzing' : 'AI Verifying'}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 mb-2">
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${i < Math.floor(business.rating || 0)
                                ? 'text-yellow-500 fill-yellow-500'
                                : 'text-gray-700'
                                }`}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                          {business.rating || 'No'} rating
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <MapPin className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{business.address || 'Address not found'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-6">
          <Button
            onClick={handleLoadMore}
            disabled={isSearching}
            variant="outline"
            className="border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:bg-gray-800 hover:text-gray-900 dark:text-white"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {isSearching ? 'Loading...' : 'Load More Results'}
          </Button>
        </div>
      )}
    </div>
  );
}
