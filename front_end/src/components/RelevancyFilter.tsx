import { useState, type MouseEvent } from 'react';
import { MapPin, CheckCircle, XCircle, Loader2, ArrowLeft, ShieldAlert } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import type { SearchResult } from '../types/search-result';
import { getResultId } from '../types/search-result';
import { EmptyState } from './page/EmptyState';
import { PageHeader } from './page/PageHeader';
import { StatusNotice } from './page/StatusNotice';
import { WorkflowProgress } from './page/WorkflowProgress';
import { LeadCard } from './LeadCard';

interface RelevancyFilterProps {
  onValidate: (ids: string[]) => void;
  results: SearchResult[];
  processingIds: Set<string>;
  searchId?: string | null;
  isVerifying: boolean;
  onBack: () => void;
  onSelectBusiness: (id: string) => void;
}

export function RelevancyFilter({ onValidate, results, processingIds, searchId, isVerifying, onBack, onSelectBusiness }: RelevancyFilterProps) {
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
  const pendingCount = processingIds.size;

  const handleSelectAll = () => {
    if (selectedIds.size === relevantBusinesses.length) {
      setSelectedIds(new Set());
    } else {
      const allIds = relevantBusinesses.map(c => c.cardId);
      setSelectedIds(new Set(allIds));
    }
  };

  const toggleSelection = (e: MouseEvent, id: string) => {
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
      <PageHeader
        title="Relevancy Filter Results"
        description="Filtered based on your business criteria and preferences"
        overline={(
          <Button onClick={onBack} variant="ghost" className="text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:text-white pl-0 hover:bg-transparent">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Search
          </Button>
        )}
      >
        <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
          <CheckCircle className="w-5 h-5 text-emerald-500" />
          <span className="text-gray-900 dark:text-white">
            <span className="text-emerald-500">{passedCount} Relevant Businesses</span> Found (Out of {totalCount})
          </span>
        </div>
      </PageHeader>
      <WorkflowProgress
        currentStage="relevancy"
        summary="Review the relevancy decisions and decide which businesses should continue to validation."
        nextAction={
          pendingCount > 0
            ? 'Wait for the remaining relevancy jobs to finish or review completed cards as they update.'
            : selectedIds.size > 0
              ? `Continue ${selectedIds.size} selected businesses to validation.`
              : passedCount > 0
                ? 'Select the businesses you want to validate next.'
                : 'Go back to search if you need to adjust the query or context.'
        }
        detail={searchId ? `Search session #${searchId}` : undefined}
      />
      <StatusNotice
        tone={
          pendingCount > 0
            ? 'info'
            : selectedIds.size > 0 || passedCount > 0
              ? 'success'
              : 'warning'
        }
        title={
          pendingCount > 0
            ? `Relevancy analysis is still running for ${pendingCount} businesses`
            : selectedIds.size > 0
              ? `${selectedIds.size} businesses are ready for validation`
              : passedCount > 0
                ? `${passedCount} businesses passed the relevancy stage`
                : 'No businesses have passed relevancy yet'
        }
        description={
          pendingCount > 0
            ? 'Scores and decisions refresh automatically every few seconds. You can review finished cards while the remaining analysis completes.'
            : selectedIds.size > 0
              ? 'Continue to validation when you are ready. The verification workflow begins on the next stage.'
              : passedCount > 0
                ? 'Select the businesses you want to send into validation.'
                : 'You can go back to search to broaden the query or keep reviewing these results if that is intentional.'
        }
        className="mb-6"
      />

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
              Continue to Validation ({selectedIds.size})
            </Button>
          </div>
        </div>
      )}

      {/* Results Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        {relevantBusinesses.length === 0 && (
          <EmptyState
            title="No relevancy results yet"
            description="Selected businesses will appear here after the relevancy pass finishes, then you can move the right ones into validation."
            className="col-span-full"
          />
        )}
        {relevantBusinesses.map((business) => {
          const category = business.types?.[0]?.replace(/_/g, ' ') || 'Local Business';
          const isSelected = selectedIds.has(business.cardId);

          return (
            <LeadCard
              key={business.cardId}
              selected={isSelected}
              onToggleSelect={(e) => toggleSelection(e, business.cardId)}
              title={business.business_name || 'Unknown Business'}
              titleSuffix={business.passed ? (
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0" />
              )}
              subtitle={<p className="capitalize truncate">{category}</p>}
              location={(
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-500 dark:text-zinc-400" />
                  <span className="text-sm text-gray-500 dark:text-zinc-400 truncate">
                    {business.address || 'Address not found'}
                  </span>
                </div>
              )}
              leading={(
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 dark:bg-zinc-800">
                  <span className="text-xl font-bold text-zinc-500">{business.business_name?.[0]?.toUpperCase()}</span>
                </div>
              )}
              badges={(
                <>
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
                </>
              )}
              footer={(
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
              )}
              dimmed={!business.passed}
            />
          );
        })}
      </div>
    </div>
  );
}
