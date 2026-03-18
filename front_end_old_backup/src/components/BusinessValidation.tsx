import { useState, type MouseEvent } from 'react';
import { MapPin, CheckCircle, XCircle, Loader2, ArrowLeft, ShieldAlert } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import type { SearchResult } from '../types/search-result';
import { getResultId, getVerificationStatusText } from '../types/search-result';
import { EmptyState } from './page/EmptyState';
import { PageHeader } from './page/PageHeader';
import { StatusNotice } from './page/StatusNotice';
import { WorkflowProgress } from './page/WorkflowProgress';
import { LeadCard } from './LeadCard';

interface BusinessValidationProps {
  results: SearchResult[];
  processingIds: Set<string>;
  searchId?: string | null;
  onAddToClients: (ids: string[]) => void;
  onBack: () => void;
  onSelectBusiness: (id: string) => void;
}

export function BusinessValidation({ results, processingIds, searchId, onAddToClients, onBack, onSelectBusiness }: BusinessValidationProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const validatingBusinesses = results.map(b => {
    const cardId = getResultId(b);
    const isProcessing = processingIds.has(cardId);
    return { ...b, cardId, isProcessing };
  });

  const handleSelectAll = () => {
    if (selectedIds.size === validatingBusinesses.length) {
      setSelectedIds(new Set());
    } else {
      const allIds = validatingBusinesses.map(c => c.cardId);
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

  const handleAddSubmit = () => {
    if (selectedIds.size > 0) {
      onAddToClients(Array.from(selectedIds));
    }
  };

  const pendingCount = processingIds.size;

  return (
    <div className="p-8 bg-gray-50 dark:bg-black min-h-screen">
      <PageHeader
        title="Business Validation"
        description="Comprehensive AI validation checks for each business"
        overline={(
          <Button onClick={onBack} variant="ghost" className="text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:text-white pl-0 hover:bg-transparent">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Search
          </Button>
        )}
      />
      <WorkflowProgress
        currentStage="validation"
        summary="Review verification status and save the right businesses to Clients."
        nextAction={
          pendingCount > 0
            ? 'Wait for the prototype verification backend to return more completed statuses, or keep reviewing what is already visible.'
            : selectedIds.size > 0
              ? `Save ${selectedIds.size} selected businesses to Clients.`
              : validatingBusinesses.length > 0
                ? 'Select the businesses you want to save into Clients.'
                : 'Return to Search to choose businesses for validation.'
        }
        detail={searchId ? `Search session #${searchId}` : undefined}
      />
      <StatusNotice
        tone={pendingCount > 0 ? 'warning' : selectedIds.size > 0 ? 'success' : 'info'}
        title={
          pendingCount > 0
            ? `Validation is still running for ${pendingCount} businesses`
            : selectedIds.size > 0
              ? `${selectedIds.size} businesses are ready to save`
              : validatingBusinesses.length > 0
                ? 'Review the validation results'
                : 'No validation items are ready yet'
        }
        description={
          pendingCount > 0
            ? 'This stage still depends on the prototype verification backend. Completed results will update automatically when available, and some items may remain pending longer.'
            : selectedIds.size > 0
              ? 'Save the selected businesses to Clients when you are comfortable with their current status.'
              : validatingBusinesses.length > 0
                ? 'Select the businesses you want to save to Clients. Pending items can be revisited later.'
                : 'Choose businesses from earlier stages to continue the workflow.'
        }
        className="mb-6"
      />

      {/* Top Action Bar */}
      {validatingBusinesses.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 bg-white dark:bg-zinc-900/80 p-4 rounded-lg border border-gray-200 dark:border-zinc-800">
          <div className="flex items-center gap-4 mb-4 sm:mb-0">
            <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
              Selected: {selectedIds.size} / {validatingBusinesses.length}
            </span>
            <button
              onClick={handleSelectAll}
              className="text-sm text-blue-400 font-medium hover:text-blue-300 hover:underline"
            >
              {selectedIds.size === validatingBusinesses.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
            <Button
              size="sm"
              onClick={handleAddSubmit}
              disabled={selectedIds.size === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-gray-900 dark:text-white whitespace-nowrap"
            >
              Save to Clients ({selectedIds.size})
            </Button>
          </div>
        </div>
      )}

      {/* Results Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        {validatingBusinesses.map((business) => {
          const category = business.types?.[0]?.replace(/_/g, ' ') || 'Local Business';
          const isSelected = selectedIds.has(business.cardId);

          return (
            <LeadCard
              key={business.cardId}
              selected={isSelected}
              onToggleSelect={(e) => toggleSelection(e, business.cardId)}
              title={business.business_name || 'Unknown Business'}
              titleSuffix={getVerificationStatusText(business) === "Verified" ? (
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-zinc-500 flex-shrink-0" />
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
                  <Badge className={
                    getVerificationStatusText(business) === "Verified"
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 inline-flex items-center"
                      : getVerificationStatusText(business) === "Partially Verified"
                        ? "bg-amber-500/10 text-amber-500 border-amber-500/20 inline-flex items-center"
                        : "bg-gray-100 dark:bg-zinc-800 text-zinc-500 border-gray-300 dark:border-zinc-700 inline-flex items-center"
                  }>
                    {getVerificationStatusText(business) === "Verified" ? (
                      <CheckCircle className="w-3 h-3 mr-1 inline" />
                    ) : (
                      <XCircle className="w-3 h-3 mr-1 inline" />
                    )}
                    {getVerificationStatusText(business)}
                  </Badge>
                  {business.relevance_score != null && (
                    <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                      Score: {business.relevance_score}
                    </Badge>
                  )}
                  {business.isProcessing && (
                    <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 border text-xs">
                      <Loader2 className="w-3 h-3 animate-spin mr-1 inline" />
                      Running deep checks...
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
            />
          );
        })}
        {validatingBusinesses.length === 0 && (
          <EmptyState
            title="No businesses are being validated"
            description="Selected businesses will appear here while validation is running, then you can save the right ones to Clients."
            className="col-span-full"
          />
        )}
      </div>
    </div>
  );
}
