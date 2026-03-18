import { useEffect, useState } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { ErrorState } from '../../components/page/ErrorState';
import { LoadingState } from '../../components/page/LoadingState';
import { RelevancyFilter } from '../../components/RelevancyFilter';
import { fetchResults, startRelevancyAgent } from '../../services/api';
import type { SearchResult } from '../../types/search-result';
import { getResultId } from '../../types/search-result';
import type { BusinessDetailsNavigationState } from '../../types/workflow';

export function RelevancyPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { selectedIds?: string[], searchId?: string } | null;
  
  const [results, setResults] = useState<SearchResult[]>([]);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const activeRelevancyIds = state?.selectedIds || [];

  useEffect(() => {
    if (!state?.searchId && activeRelevancyIds.length === 0) {
      // If no state was passed, redirect back to search
      navigate('/search');
      return;
    }

    if (state?.searchId) {
      setIsLoading(true);
      setPageError(null);

      // Fetch the results for this search ID to populate the Relevancy items
      fetchResults(state.searchId)
        .then((res: SearchResult) => {
          const newRes: SearchResult[] = Array.isArray(res) ? res : [];
          setResults(newRes);

          // Start relevancy agent for the newly passed in items
          if (activeRelevancyIds.length > 0) {
            setProcessingIds(new Set(activeRelevancyIds));
            startRelevancyAgent(activeRelevancyIds).catch(console.error);
          }
        })
        .catch((error: any) => {
          console.error('Failed to load relevancy results:', error);
          setPageError(error.response?.data?.detail || 'Unable to load relevancy results for this search.');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [state?.searchId]);

  // Simplified polling just for this page's processing items
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (processingIds.size > 0 && state?.searchId) {
      interval = setInterval(async () => {
        try {
          const res = await fetchResults(state.searchId!);
          const newRes: SearchResult[] = Array.isArray(res) ? res : [];
          setResults(newRes);
          
          setProcessingIds((prev: Set<string>) => {
            const stillProcessing = new Set<string>();
            prev.forEach((idStr: string) => {
              const r = newRes.find((res: SearchResult) => getResultId(res) === idStr);
              if (r) {
                const isDone = r.relevance_status && r.relevance_status.toLowerCase() !== 'pending';
                if (!isDone) stillProcessing.add(idStr);
              }
            });
            return stillProcessing;
          });
        } catch (e) {
          console.error(e);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [processingIds.size, state?.searchId]);

  const handleAdvanceToValidation = (idsToValidate: string[]) => {
    navigate('/validation', { state: { selectedIds: idsToValidate, searchId: state?.searchId } });
  };

  const handleBusinessSelect = (businessId: string) => {
    const business = results.find((result) => getResultId(result) === businessId) ?? null;
    const detailsState: BusinessDetailsNavigationState = {
      business,
      sourceStage: 'relevancy',
      sourceLabel: 'Relevancy',
      searchId: state?.searchId ?? null,
    };

    navigate(`/business/${businessId}`, { state: detailsState });
  };

  const handleBack = () => {
    navigate(state?.searchId ? `/search?id=${state.searchId}` : '/search');
  };

  const displayResults = results.filter((r: SearchResult) => activeRelevancyIds.includes(getResultId(r)));

  if (isLoading) {
    return <LoadingState message="Loading relevancy results..." className="max-w-none" />;
  }

  if (pageError) {
    return (
      <div className="p-8">
        <ErrorState
          title="Unable to load relevancy results"
          message={pageError}
          action={(
            <Button variant="outline" onClick={handleBack}>
              Back to Search
            </Button>
          )}
        />
      </div>
    );
  }

  return (
    <RelevancyFilter
      results={displayResults}
      processingIds={processingIds}
      searchId={state?.searchId ?? null}
      isVerifying={false} // Currently we only run relevancy from this page
      onValidate={handleAdvanceToValidation}
      onBack={handleBack}
      onSelectBusiness={handleBusinessSelect}
    />
  );
}
