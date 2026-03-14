import { useState, type FC } from 'react';
import { Building2, MapPin, Phone, Globe, ShieldCheck, Mail } from 'lucide-react';
import type { SearchResult } from '../types/search-result';
import { getResultId, getVerificationBucket } from '../types/search-result';

type ResultItem = SearchResult;

interface ResultsTableProps {
    results: ResultItem[];
    isLoading: boolean;
    onLoadMore?: () => void;
    hasMore?: boolean;
    selectedIds?: Set<string>;
    processingIds?: Set<string>;
    processingAction?: 'relevancy' | 'verification';
    visibleIds?: string[] | null;
    onSelect?: (id: string) => void;
}

export const ResultsTable: FC<ResultsTableProps> = ({ results, isLoading, onLoadMore, hasMore, selectedIds = new Set(), processingIds = new Set(), processingAction = 'relevancy', visibleIds = null, onSelect }) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const currentlyProcessingId = Array.from(processingIds)[0];
    if (isLoading && results.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-slate-200 shadow-sm h-full">
                <div className="w-8 h-8 rounded-full border-4 border-primary-500 border-t-transparent animate-spin mb-4"></div>
                <p className="text-slate-500 font-medium">Scanning network for targets...</p>
            </div>
        );
    }

    if (results.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-16 bg-white rounded-xl border border-slate-200 shadow-sm h-full border-dashed">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                    <Building2 className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-1">No Results Yet</h3>
                <p className="text-slate-500 text-center max-w-sm">
                    Enter a search query above to initiate a deep scan and uncover verified business leads.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 pb-6 mt-4 px-2">
                {results.map((result) => {
                    const cardId = getResultId(result);
                    const isSelected = selectedIds.has(cardId);
                    const isVisible = visibleIds === null || visibleIds.includes(cardId);

                    return (
                        <div key={cardId} className={`bg-white rounded-xl border ${isSelected ? 'border-primary-500 ring-1 ring-primary-500' : 'border-slate-200'} shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-all relative group ${!isVisible ? 'hidden' : 'flex'} ${expandedId === cardId ? 'col-span-1 lg:col-span-2 xl:col-span-3' : ''}`}>
                            {/* Header */}
                            <div className={`p-5 border-b border-slate-100 flex items-start justify-between ${isSelected ? 'bg-primary-50/30' : 'bg-slate-50/50'}`}>
                                <div className="flex items-center gap-3">
                                    <div className="mt-1">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => onSelect && onSelect(cardId)}
                                            className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                                        />
                                    </div>
                                    <div className="w-10 h-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-100 group-hover:text-primary-700 transition-colors">
                                        <Building2 className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900 group-hover:text-primary-700 transition-colors line-clamp-1" title={result.business_name || 'Unknown Business'}>
                                            {result.business_name || 'Unknown Business'}
                                        </h3>
                                        <p className="text-xs text-slate-400 font-mono mt-0.5" title="Place ID">
                                            {result.place_id ? result.place_id.substring(0, 16) + '...' : 'N/A'}
                                        </p>
                                    </div>
                                </div>
                                {/* Status Badges */}
                                <div className="flex-shrink-0 ml-2 flex flex-col gap-1 items-end">
                                    {getVerificationBucket(result) === 'verified' ? (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200" title="Verified">
                                            <ShieldCheck className="w-3.5 h-3.5" />
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                            Pending
                                        </span>
                                    )}

                                    {processingIds.has(cardId) ? (
                                        cardId === currentlyProcessingId ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                                <span className="w-3 h-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin"></span>
                                                {processingAction === 'verification' ? 'Verifying...' : 'Analyzing...'}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                                Pending
                                            </span>
                                        )
                                    ) : result.relevance_score != null ? (
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border ${result.relevance_score > 70 ? 'bg-green-50 text-green-700 border-green-200' : result.relevance_score > 40 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                            Score: {result.relevance_score}
                                        </span>
                                    ) : null}
                                </div>
                            </div>

                            {/* Body */}
                            <div className="p-5 space-y-4 flex-1">
                                <div className="flex items-start gap-3 text-slate-600">
                                    <MapPin className="w-4 h-4 mt-0.5 text-slate-400 flex-shrink-0" />
                                    <span className="text-sm line-clamp-2">
                                        {result.address || 'Address not found'}
                                    </span>
                                </div>

                                <div className="flex items-center gap-3 text-slate-600">
                                    <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                    <span className="text-sm">
                                        {result.phone_number || 'No phone'}
                                    </span>
                                </div>

                                <div className="flex items-center gap-3">
                                    <Globe className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                    {result.website ? (
                                        <a
                                            href={`https://${result.website.replace(/^https?:\/\//, '')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-primary-600 hover:text-primary-800 hover:underline line-clamp-1"
                                        >
                                            {result.website.replace(/^https?:\/\//, '')}
                                        </a>
                                    ) : (
                                        <span className="text-sm text-slate-400">No website</span>
                                    )}
                                </div>

                                {/* Relevance reason block was removed; replaced with expanded area */}
                            </div>

                            {/* Action Footer */}
                            <div className="p-4 border-t border-slate-100 bg-slate-50 mt-auto flex flex-col gap-3">
                                <button
                                    onClick={() => onSelect && onSelect(cardId)}
                                    className={`w-full py-2.5 bg-white border rounded-lg text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 flex items-center justify-center gap-2 shadow-sm ${isSelected ? 'border-primary-500 text-primary-700 bg-primary-50 hover:bg-primary-100' : 'border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-primary-700 hover:border-primary-300 focus:ring-primary-500'}`}
                                >
                                    {isSelected ? 'Deselect Lead' : 'Select for Relevancy AI'}
                                </button>

                                {result.relevance_reason && (
                                    <button
                                        onClick={() => setExpandedId(cardId === expandedId ? null : cardId)}
                                        className="w-full py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors shadow-sm flex items-center justify-center gap-2"
                                    >
                                        ▼ View AI Details
                                    </button>
                                )}
                            </div>

                            {expandedId === cardId && result.relevance_reason && (
                                <div className="p-6 bg-slate-900 text-gray-900 dark:text-white rounded-b-xl flex flex-col gap-6 mt-auto">
                                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                                        <div>
                                            <h4 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                <Building2 className="w-5 h-5 text-primary-400" />
                                                {result.business_name || 'Unknown Business'}
                                            </h4>
                                            <p className="text-sm text-slate-400 capitalize">{result.types?.[0]?.replace(/_/g, ' ') || 'Local Business'}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {result.rating && <span className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-sm font-semibold">★ {result.rating}</span>}
                                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${result.relevance_score != null && result.relevance_score > 70 ? 'bg-green-500/20 text-green-400' : (result.relevance_score != null && result.relevance_score > 40) ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                                                AI Score: {result.relevance_score}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-4">
                                            <h5 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><MapPin className="w-4 h-4" /> Basic Information</h5>
                                            <div className="flex items-start gap-3 text-slate-300">
                                                <span className="text-sm">{result.address || 'Address not found'}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-slate-300">
                                                <Phone className="w-4 h-4 text-slate-500 flex-shrink-0" />
                                                <span className="text-sm">{result.phone_number || 'No phone provided'}</span>
                                            </div>
                                        </div>
                                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-4">
                                            <h5 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><Globe className="w-4 h-4" /> Website Presence & AI Analysis</h5>
                                            <div className="flex items-center gap-3 text-slate-300 mb-2">
                                                {result.website ? (
                                                    <a href={`https://${result.website.replace(/^https?:\/\//, '')}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-400 hover:underline line-clamp-1">{result.website.replace(/^https?:\/\//, '')}</a>
                                                ) : <span className="text-sm text-slate-500">No website</span>}
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 text-sm mb-2">
                                                <div><span className="text-slate-500">Site Status:</span> <span className="text-slate-300">{result.raw_data?.website_status || 'Not yet scanned'}</span></div>
                                                <div><span className="text-slate-500">Marketplace:</span> <span className="text-slate-300">{result.raw_data?.is_marketplace !== undefined ? String(result.raw_data.is_marketplace) : 'Not yet scanned'}</span></div>
                                            </div>
                                            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                                                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{result.relevance_reason || 'Pending Relevancy AI Scan...'}</p>
                                            </div>
                                        </div>
                                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 border-dashed flex flex-col">
                                            <h5 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Verification Details</h5>
                                            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                                <div><span className="text-slate-500">Domain Age:</span> <span className="text-slate-300">{result.raw_data?.domain_age ? `${result.raw_data.domain_age} years` : 'Not yet scanned'}</span></div>
                                                <div><span className="text-slate-500">Ver. Score:</span> <span className="text-slate-300">{result.verification_score != null ? result.verification_score : '-'}</span></div>
                                            </div>
                                            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700 flex-1 overflow-y-auto max-h-32 mb-4">
                                                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{result.verification_reason || 'Pending Verification AI Scan...'}</p>
                                            </div>
                                            <div className="flex items-center gap-2 mt-auto">
                                                <span className={`px-2 py-1 rounded text-xs font-semibold border ${result.verification_status === 'completed' ? 'bg-green-500/20 text-green-400 border-green-500/30' : result.verification_status === 'failed' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-slate-700 text-slate-400 border-slate-600'}`}>{result.verification_status ? result.verification_status.toUpperCase() : 'PENDING'}</span>
                                            </div>
                                        </div>
                                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 border-dashed flex flex-col">
                                            <h5 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><Mail className="w-4 h-4" /> Direct Contacts</h5>
                                            <div className="flex flex-col gap-3 mt-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-slate-500 text-sm">Emails:</span>
                                                    {result.email_found ? (
                                                        <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs font-medium border border-emerald-500/30">Found: {result.email_found}</span>
                                                    ) : (
                                                        <span className="text-xs text-slate-500 font-medium">Not yet scanned</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {hasMore && (
                <div className="flex justify-center mt-4 pb-12">
                    <button
                        onClick={onLoadMore}
                        disabled={isLoading}
                        className="px-6 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <span className="w-4 h-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin"></span>
                                Loading...
                            </>
                        ) : 'Load More Results'}
                    </button>
                </div>
            )}
        </div>
    );
};
