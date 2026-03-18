import { useState, type MouseEvent } from 'react';
import { Search, Trash2, Loader2, Download } from 'lucide-react';
import { exportClients } from '../services/api';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import type { SearchResult } from '../types/search-result';
import { getResultId, getVerificationStatusText } from '../types/search-result';
import { EmptyState } from './page/EmptyState';
import { ErrorState } from './page/ErrorState';
import { PageHeader } from './page/PageHeader';
import { StatusNotice } from './page/StatusNotice';
import { WorkflowProgress } from './page/WorkflowProgress';
import { LeadCard } from './LeadCard';


interface ClientsProps {
  actionError?: string | null;
  isRefreshing?: boolean;
  results: SearchResult[];
  processingIds: Set<string>;
  processingAction: string | null;
  onRefresh: () => void;
  onSelectBusiness: (businessId: string) => void;
  onRunRelevancy: (ids: string[]) => void;
  onRunVerification: (ids: string[]) => void;
  onRemoveFromClients: (ids: string[]) => void;
}

export function Clients({ actionError, isRefreshing = false, results, processingIds, processingAction, onRefresh, onSelectBusiness, onRunRelevancy, onRunVerification, onRemoveFromClients }: ClientsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  const verifiedClients = results.filter(r => (
    r.is_saved_client || (r.verification_status === 'completed' && (r.verification_score ?? 0) > 70)
  ));

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
      const allIds = filteredClients.map(c => getResultId(c));
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

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const idsToExport = Array.from(selectedIds);
      const blob = await exportClients(idsToExport);

      // Create a blob URL and trigger download
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;

      const dateStr = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `Client_List_${dateStr}.xlsx`);

      document.body.appendChild(link);
      link.click();

      // Cleanup
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export clients [DEBUG EXCEPTION]:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      alert('Failed to export clients. Please try again. Check console for details.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-8 bg-gray-50 dark:bg-black min-h-screen">
      <PageHeader
        title="Clients"
        description="Manage your saved and verified clients"
        actions={(
          <Button variant="outline" onClick={onRefresh} disabled={isRefreshing}>
            {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        )}
      />
      <WorkflowProgress
        currentStage="clients"
        summary="Saved businesses live here for follow-up, export, and detailed review."
        nextAction={
          processingIds.size > 0
            ? 'Wait for the requested rerun to update, or refresh this page to sync the latest client statuses.'
            : selectedIds.size > 0
              ? 'Run another relevancy or validation pass, or export the selected clients.'
              : filteredClients.length > 0
                ? 'Open a client to review details or select clients for a new pass.'
                : 'Save businesses from earlier stages to build your client list.'
        }
      />
      <StatusNotice
        tone={
          processingIds.size > 0
            ? processingAction === 'verification'
              ? 'warning'
              : 'info'
            : 'info'
        }
        title={
          processingIds.size > 0
            ? processingAction === 'verification'
              ? `Validation rerun requested for ${processingIds.size} clients`
              : `Relevancy rerun requested for ${processingIds.size} clients`
            : 'Clients is your stable review and export stage'
        }
        description={
          processingIds.size > 0
            ? processingAction === 'verification'
              ? 'Validation still depends on the prototype verification backend. This page will refresh real status updates when they are available, but some items may remain pending longer.'
              : 'Relevancy updates come from the live backend path. This page refreshes the latest saved-client statuses automatically while the job runs.'
            : 'Use this stage to review saved businesses, export them, or open a record for more detail.'
        }
        className="mb-6"
      />

      {actionError && (
        <ErrorState
          title="Unable to update Clients"
          message={actionError}
          className="mb-6"
        />
      )}

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
              Re-run Relevancy
            </Button>
            <Button
              size="sm"
              onClick={handleBulkValidation}
              disabled={selectedIds.size === 0}
              className="bg-blue-600 hover:bg-blue-700 text-gray-900 dark:text-white whitespace-nowrap"
            >
              Re-run Validation
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

            <div className="h-6 w-px bg-gray-300 dark:bg-zinc-700 mx-2 hidden sm:block"></div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting}
              className="text-gray-700 dark:text-gray-300 border-gray-300 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800 whitespace-nowrap"
            >
              {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              {selectedIds.size > 0 ? `Export Selected (${selectedIds.size})` : 'Export All'}
            </Button>

          </div>
        </div>
      )}

      {/* Clients Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredClients.map((client) => {
          const category = client.types?.[0]?.replace(/_/g, ' ') || 'Local Business';
          const cardId = getResultId(client);

          return (
            <LeadCard
              key={cardId}
              selected={selectedIds.has(cardId)}
              onToggleSelect={(e) => toggleSelection(e, cardId)}
              title={client.business_name || 'Unknown Business'}
              titleSuffix={(
                <Badge variant="secondary" className={`whitespace-nowrap flex-shrink-0 ${getVerificationStatusText(client) === "Verified"
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                  : getVerificationStatusText(client) === "Partially Verified"
                    ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                    : "bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border-gray-300 dark:border-zinc-700"
                  }`}>
                  {getVerificationStatusText(client)}
                </Badge>
              )}
              subtitle={<p className="capitalize truncate">{category}</p>}
              location={<p className="text-sm truncate">{client.address || 'No address'}</p>}
              leading={(
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 dark:bg-zinc-800">
                  <span className="text-xl font-bold text-zinc-500">{client.business_name?.[0]?.toUpperCase()}</span>
                </div>
              )}
              badges={(
                <>
                  <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                    Score: {client.relevance_score ?? 0}
                  </Badge>
                  <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 border-purple-500/20">
                    Verification Score: {client.verification_score ?? 0}
                  </Badge>
                </>
              )}
              status={processingIds.has(cardId) ? (
                <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 border">
                  <Loader2 className="w-3 h-3 animate-spin mr-1 inline" />
                  {processingAction === 'relevancy' ? 'Analyzing...' : 'Running deep checks...'}
                </Badge>
              ) : undefined}
              footer={(
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
              )}
              className="h-full"
            />
          );
        })}

        {filteredClients.length === 0 && (
          <EmptyState
            title="No matching clients"
            description="No saved or verified clients match your current search criteria."
            className="col-span-full"
          />
        )}
      </div>
    </div>
  );
}
