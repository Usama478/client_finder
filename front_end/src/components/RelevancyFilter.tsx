import { useState } from 'react';
import { MapPin, CheckCircle, XCircle, Loader2, ArrowLeft, CheckSquare, Square, ShieldAlert } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import type { SearchResult } from '../types/search-result';
import { getResultId } from '../types/search-result';

interface RelevancyFilterProps {
  onValidate: (ids: string[]) => void;
  results: SearchResult[];
  processingIds: Set<string>;
  isVerifying: boolean;
  onBack: () => void;
  onSelectBusiness: (id: string) => void;
}

export function RelevancyFilter({ onValidate, results, processingIds, isVerifying, onBack, onSelectBusiness }: RelevancyFilterProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const relevantBusinesses = results.map(b => {
    const isPassed = b.relevance_status === 'completed' && b.relevance_decision === 'relevant';
    const cardId = getResultId(b);
    const isLoadProcessing = processingIds.has(cardId);
    return {
      ...b,
      cardId,
      passed: isPassed,
      isProcessing: isLoadProcessing
    };
  });

  const passedBusinesses = relevantBusinesses.filter(b => b.passed);
  const passedCount = passedBusinesses.length;
  const totalCount = relevantBusinesses.length;

  const handleSelectAll = () => {
    if (selectedIds.size === relevantBusinesses.length) {
      setSelectedIds(new Set());
    } else {
      const allIds = relevantBusinesses.map(c => c.cardId);
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

  const handleValidateClick = () => {
    if (selectedIds.size > 0) {
      onValidate(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  return (
    <div className="p-8 bg-gray-50 dark:bg-black min-h-screen">
      <div className="mb-8">
        <Button onClick={onBack} variant="ghost" className="mb-4 text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:text-white pl-0 hover:bg-transparent">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Search
        </Button>
        <h1 className="text-gray-900 dark:text-white text-3xl mb-2">Relevancy Filter Results</h1>
        <p className="text-gray-500 dark:text-zinc-400 mb-4">
          Filtered based on your business criteria and preferences
        </p>
        <div className="inline-flex items-center gap-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg px-4 py-2">
          <CheckCircle className="w-5 h-5 text-emerald-500" />
          <span className="text-gray-900 dark:text-white">
            <span className="text-emerald-500">{passedCount} Relevant Businesses</span> Found (Out of {totalCount})
          </span>
        </div>
      </div>

      {/* Top Action Bar */}
      {relevantBusinesses.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 bg-white dark:bg-zinc-900/80 p-4 rounded-lg border border-gray-200 dark:border-zinc-800">
          <div className="flex items-center gap-4 mb-4 sm:mb-0">
            <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
              Selected: {selectedIds.size} / {relevantBusinesses.length}
            </span>
            <button
              onClick={handleSelectAll}
              className="text-sm text-blue-400 font-medium hover:text-blue-300 hover:underline"
            >
              {selectedIds.size === relevantBusinesses.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
            <Button
              size="sm"
              onClick={handleValidateClick}
              disabled={selectedIds.size === 0 || isVerifying}
              className="bg-blue-600 hover:bg-blue-700 text-gray-900 dark:text-white whitespace-nowrap"
            >
              {isVerifying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              🛡️ Run Verification on Selected
            </Button>
          </div>
        </div>
      )}

      {/* Results Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        {relevantBusinesses.map((business) => {
          const category = business.types?.[0]?.replace(/_/g, ' ') || 'Local Business';
          const isSelected = selectedIds.has(business.cardId);

          return (
            <Card
              key={business.cardId}
              className={`bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:bg-zinc-800/50 transition-all relative ${isSelected ? 'border-blue-500' : ''} ${!business.passed ? 'opacity-50 grayscale' : ''}`}
            >
              {/* Card Selection */}
              <div
                className="absolute left-6 top-6 cursor-pointer z-10"
                onClick={(e) => toggleSelection(e, business.cardId)}
              >
                {isSelected ? (
                  <CheckSquare className="w-5 h-5 text-blue-500" />
                ) : (
                  <Square className="w-5 h-5 text-zinc-500 hover:text-gray-500 dark:text-zinc-400" />
                )}
              </div>

              <CardContent className="p-6 pl-16">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-zinc-500 font-bold text-xl">{business.business_name?.[0]?.toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-gray-900 dark:text-white mb-1 flex items-center gap-2 min-w-0">
                        <span className="truncate" title={business.business_name || 'Unknown Business'}>
                          {business.business_name || 'Unknown Business'}
                        </span>
                        {business.passed ? (
                          <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        )}
                      </h3>
                      <p className="text-gray-500 dark:text-zinc-400 capitalize text-sm truncate">{category}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-500 dark:text-zinc-400" />
                    <span className="text-sm text-gray-500 dark:text-zinc-400 truncate">
                      {business.address || 'Address not found'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 mt-4">
                  <div className="flex flex-wrap gap-2">
                    {business.passed ? (
                      <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                        <CheckCircle className="w-3 h-3 mr-1 inline" />
                        Passed
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-gray-100 dark:bg-zinc-800 text-zinc-500 border-gray-300 dark:border-zinc-700">
                        <XCircle className="w-3 h-3 mr-1 inline" />
                        Irrelevant
                      </Badge>
                    )}
                    {business.relevance_score != null && (
                      <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                        Score: {business.relevance_score}
                      </Badge>
                    )}
                    {business.isProcessing && (
                      <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 border text-xs">
                        <Loader2 className="w-3 h-3 animate-spin mr-1 inline" />
                        Analyzing
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-800 flex justify-end">
                  <Button
                    variant="link"
                    className="text-blue-400 hover:text-blue-300 px-0 h-auto font-medium"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectBusiness(business.cardId);
                    }}
                  >
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
