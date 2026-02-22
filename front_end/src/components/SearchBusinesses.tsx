import { useState } from 'react';
import { Search, MapPin, ChevronDown, Filter, Loader2, CheckSquare, Square, CheckCircle, XCircle } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';

const filterChips = [
  'High Rating (4.5+)',
  'Has Website',
  'Active on Social Media',
  'Verified Business',
  'Open Now',
];

interface SearchBusinessesProps {
  onFilterRelevant: () => void;
  query: string;
  setQuery: (q: string) => void;
  handleSearch: (e?: React.FormEvent) => void;
  results: any[];
  isSearching: boolean;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  hasMore: boolean;
  handleLoadMore: () => void;
  onBusinessSelect: (id: string) => void;
  history: any[];
  onSelectHistory: (searchId: string) => Promise<void>;
  onAddToClients: (business: any) => void;
}

export function SearchBusinesses({
  onFilterRelevant, query, setQuery, handleSearch, results,
  isSearching, selectedIds, setSelectedIds, hasMore, handleLoadMore, onBusinessSelect,
  history, onSelectHistory, onAddToClients
}: SearchBusinessesProps) {
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev =>
      prev.includes(filter)
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.size === results.length) {
      setSelectedIds(new Set());
    } else {
      const allIds = results.map((r: any) => (r.id || r.result_id || r.place_id).toString());
      setSelectedIds(new Set(allIds));
    }
  };

  const toggleSelection = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  return (
    <div className="p-8 bg-black min-h-screen">
      <div className="mb-8">
        <h1 className="text-white text-3xl mb-2">Search Businesses</h1>
        <p className="text-zinc-400">Discover new businesses from multiple sources</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Top Search Bar */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-6">
              <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400" />
                  <Input
                    placeholder="Search new businesses (e.g., Doctors in New York)..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-10 h-12 w-full bg-zinc-800 border-zinc-700 text-white text-lg"
                    disabled={isSearching}
                  />
                </div>
                <Button type="submit" disabled={isSearching || !query.trim()} className="h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white">
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {isSearching ? 'Scanning...' : 'Search'}
                </Button>
              </form>

              {/* Filter Chips */}
              <div className="flex flex-wrap gap-2">
                {filterChips.map((chip) => (
                  <Badge
                    key={chip}
                    variant="secondary"
                    className={`cursor-pointer transition-all ${activeFilters.includes(chip)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border-zinc-700'
                      }`}
                    onClick={() => toggleFilter(chip)}
                  >
                    {chip}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Search Results List */}
          {results.length > 0 && (
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-semibold text-gray-400">
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
              const cardId = (business.id || business.result_id || business.place_id).toString();
              const isSelected = selectedIds.has(cardId);
              const category = business.types?.[0]?.replace(/_/g, ' ') || 'Local Business';

              return (
                <Card
                  key={cardId}
                  className={`bg-zinc-900 border-zinc-800 hover:bg-zinc-800/50 transition-all relative ${isSelected ? 'border-blue-500' : ''}`}
                >
                  {/* Card Selection */}
                  <div
                    className="absolute left-6 top-6 cursor-pointer z-10"
                    onClick={(e) => toggleSelection(e, cardId)}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-blue-500" />
                    ) : (
                      <Square className="w-5 h-5 text-zinc-500 hover:text-zinc-400" />
                    )}
                  </div>

                  <CardContent className="p-6 pl-16">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white text-lg mb-2 truncate" title={business.business_name || 'Unknown Business'}>
                          {business.business_name || 'Unknown Business'}
                        </h3>
                        <p className="text-zinc-400 mb-2 capitalize truncate">{category}</p>
                        <div className="flex items-center gap-2 text-zinc-400">
                          <MapPin className="w-4 h-4" />
                          <span className="text-sm">{business.address || 'Address not found'}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {business.is_verified ? (
                            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                              <CheckCircle className="w-3 h-3 mr-1 inline" />
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 border-zinc-700">
                              <XCircle className="w-3 h-3 mr-1 inline" />
                              Unverified
                            </Badge>
                          )}
                          {business.relevance_score != null ? (
                            <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                              Score: {business.relevance_score}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 border-zinc-700">
                              Pending Score
                            </Badge>
                          )}
                          {!business.is_verified && business.relevance_score == null && (
                            <Badge className="bg-blue-600 text-white border-blue-500 text-xs">
                              New
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0 w-full sm:w-32">
                        <Button variant="outline" className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700 w-full" onClick={(e) => { e.stopPropagation(); onBusinessSelect(cardId); }}>
                          View Details
                        </Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white w-full" onClick={(e) => { e.stopPropagation(); onAddToClients(business); }}>
                          Quick Add
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Bottom Controls */}
          {results.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6 mb-8 lg:col-span-3">
              {hasMore && (
                <Button onClick={handleLoadMore} disabled={isSearching} variant="outline" className="bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800">
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
                  {isSearching ? 'Loading...' : 'Show More Results'}
                </Button>
              )}
              <Button
                onClick={onFilterRelevant}
                disabled={selectedIds.size === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filter Relevant Businesses ({selectedIds.size})
              </Button>
            </div>
          )}
        </div>

        {/* Sidebar for History */}
        <div className="lg:col-span-1">
          <Card className="bg-zinc-900 border-zinc-800 overflow-y-auto max-h-[800px] sticky top-8">
            <CardContent className="p-6">
              <h3 className="text-white mb-4 flex items-center gap-2">
                <Search className="w-4 h-4 text-zinc-400" />
                Recent Searches
              </h3>
              {!Array.isArray(history) || history.length === 0 ? (
                <div className="text-zinc-500 text-sm">No recent searches found.</div>
              ) : (
                <div className="space-y-3">
                  {history.map((search: any) => {
                    const searchId = search?.search_id || search?.id;
                    if (!searchId) return null;

                    return (
                      <div
                        key={searchId}
                        className="p-3 bg-zinc-800/50 rounded-lg cursor-pointer hover:bg-zinc-800 transition-colors"
                        onClick={() => {
                          if (search.query) setQuery(search.query);
                          if (onSelectHistory) onSelectHistory(searchId.toString());
                        }}
                      >
                        <div className="text-zinc-300 text-sm font-medium mb-1 truncate">{search.query || search.search_query || 'Unknown Search'}</div>
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
    </div>
  );
}
