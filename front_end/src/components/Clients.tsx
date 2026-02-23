import { useState } from 'react';
import { Search, CheckCircle, ShieldAlert, CheckSquare, Square, Trash2, Loader2 } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';

interface ClientsProps {
  results: any[];
  processingIds: Set<string>;
  processingAction: string | null;
  onSelectBusiness: (business: any) => void;
  onRunRelevancy: (ids: string[]) => void;
  onRunVerification: (ids: string[]) => void;
  onRemoveFromClients: (ids: string[]) => void;
}

export function Clients({ results, processingIds, processingAction, onSelectBusiness, onRunRelevancy, onRunVerification, onRemoveFromClients }: ClientsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const verifiedClients = results.filter(r => {
    return r.is_verified || r.is_saved_client;
  });

  const filteredClients = verifiedClients.filter(client => {
    const name = client.business_name || '';
    const category = client.types?.[0] || '';
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const handleSelectAll = () => {
    if (selectedIds.size === filteredClients.length) {
      setSelectedIds(new Set());
    } else {
      const allIds = filteredClients.map(c => (c.id || c.result_id || c.place_id).toString());
      setSelectedIds(new Set(allIds));
    }
  };

  const toggleSelection = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkRelevancy = () => {
    if (selectedIds.size > 0) {
      onRunRelevancy(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  const handleBulkValidation = () => {
    if (selectedIds.size > 0) {
      onRunVerification(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  const handleBulkRemove = () => {
    if (selectedIds.size > 0) {
      onRemoveFromClients(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  return (
    <div className="p-8 bg-gray-50 dark:bg-black min-h-screen">
      <div className="mb-8">
        <h1 className="text-gray-900 dark:text-white text-3xl mb-2">Clients</h1>
        <p className="text-gray-500 dark:text-zinc-400">Manage your saved and verified clients</p>
      </div>

      {/* Top Controls */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500 dark:text-zinc-400" />
          <Input
            placeholder="Search saved clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {/* Top Action Bar */}
      {filteredClients.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 bg-white dark:bg-zinc-900/80 p-4 rounded-lg border border-gray-200 dark:border-zinc-800">
          <div className="flex items-center gap-4 mb-4 sm:mb-0">
            <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
              Selected: {selectedIds.size} / {filteredClients.length}
            </span>
            <button
              onClick={handleSelectAll}
              className="text-sm text-blue-400 font-medium hover:text-blue-300 hover:underline"
            >
              {selectedIds.size === filteredClients.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
            <Button
              size="sm"
              onClick={handleBulkRelevancy}
              disabled={selectedIds.size === 0}
              className="bg-gray-100 dark:bg-zinc-800 hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 border border-gray-300 dark:border-zinc-700 whitespace-nowrap"
            >
              🚀 Run Relevancy AI
            </Button>
            <Button
              size="sm"
              onClick={handleBulkValidation}
              disabled={selectedIds.size === 0}
              className="bg-blue-600 hover:bg-blue-700 text-gray-900 dark:text-white whitespace-nowrap"
            >
              🛡️ Run Validation AI
            </Button>
            <Button
              size="sm"
              onClick={handleBulkRemove}
              disabled={selectedIds.size === 0}
              className="bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-900/30 whitespace-nowrap"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Remove
            </Button>
          </div>
        </div>
      )}

      {/* Clients Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredClients.map((client) => {
          const category = client.types?.[0]?.replace(/_/g, ' ') || 'Local Business';
          const cardId = (client.id || client.result_id || client.place_id).toString();

          return (
            <Card
              key={cardId}
              className={`bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:bg-zinc-800/50 transition-all relative flex flex-col h-full overflow-hidden ${selectedIds.has(cardId) ? 'border-blue-500' : ''}`}
            >
              {/* Card Selection */}
              <div
                className="absolute left-6 top-6 cursor-pointer z-10"
                onClick={(e) => toggleSelection(e, cardId)}
              >
                {selectedIds.has(cardId) ? (
                  <CheckSquare className="w-5 h-5 text-blue-500" />
                ) : (
                  <Square className="w-5 h-5 text-zinc-500 hover:text-gray-500 dark:text-zinc-400" />
                )}
              </div>

              <CardContent className="p-6 pl-16 flex flex-col flex-grow">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-zinc-500 font-bold text-xl">{client.business_name?.[0]?.toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-gray-900 dark:text-white mb-1 flex items-center gap-2 min-w-0">
                        <span className="truncate" title={client.business_name}>
                          {client.business_name}
                        </span>
                        {client.is_verified ? (
                          <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <ShieldAlert className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                        )}
                      </h3>
                      <p className="text-gray-500 dark:text-zinc-400 capitalize text-sm truncate">{category}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <p className="text-gray-500 dark:text-zinc-400 text-sm truncate">{client.address || 'No address'}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <span
                          key={i}
                          className={`text-sm ${i < Math.floor(client.rating || 0) ? 'text-amber-500' : 'text-zinc-700'
                            }`}
                        >
                          ★
                        </span>
                      ))}
                      <span className="text-gray-500 dark:text-zinc-400 text-sm ml-2">{client.rating || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 mt-4">
                  <div className="flex flex-wrap gap-2">
                    {client.is_verified ? (
                      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                        Verified Lead
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border-gray-300 dark:border-zinc-700">
                        Unverified
                      </Badge>
                    )}
                    {client.relevance_score != null ? (
                      <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                        Score: {client.relevance_score}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border-gray-300 dark:border-zinc-700">
                        Pending Score
                      </Badge>
                    )}
                    {processingIds.has(cardId) && (
                      <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 border">
                        <Loader2 className="w-3 h-3 animate-spin mr-1 inline" />
                        {processingAction === 'relevancy' ? 'Analyzing...' : 'Running deep checks...'}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-gray-200 dark:border-zinc-800 flex justify-end">
                  <Button
                    variant="link"
                    className="text-blue-400 hover:text-blue-300 px-0 h-auto font-medium"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectBusiness(cardId);
                    }}
                  >
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredClients.length === 0 && (
          <div className="col-span-full text-center py-12 text-zinc-500">
            No saved or verified clients match your search criteria.
          </div>
        )}
      </div>
    </div>
  );
}
