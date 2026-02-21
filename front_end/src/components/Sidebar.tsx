import React from 'react';
import { Clock, Search } from 'lucide-react';

interface SearchItem {
    id?: string;
    search_id?: string;
    query: string;
    created_at: string;
}

interface SidebarProps {
    history: SearchItem[];
    onSelectSearch: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ history, onSelectSearch }) => {
    return (
        <aside className="w-64 bg-white border-r border-slate-200 h-screen overflow-y-auto flex flex-col">
            <div className="p-6 border-b border-slate-100">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                    Recent Searches
                </h2>

                {history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-400 text-center space-y-3">
                        <Search className="w-8 h-8 stroke-1" />
                        <p className="text-sm">No recent searches</p>
                    </div>
                ) : (
                    <ul className="space-y-2">
                        {history.map((item, index) => (
                            <li key={item.search_id || item.id || index}>
                                <button
                                    onClick={() => onSelectSearch(item.search_id || item.id || '')}
                                    className="w-full flex items-start gap-3 p-3 text-left rounded-lg hover:bg-slate-50 transition-colors group"
                                >
                                    <Clock className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0 group-hover:text-primary-500" />
                                    <div>
                                        <p className="text-sm font-medium text-slate-700 group-hover:text-primary-700 line-clamp-1">
                                            {item.query}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            {(() => {
                                                const diff = Date.now() - new Date(item.created_at).getTime();
                                                if (diff < 60000) return 'Just now';
                                                if (diff < 3600000) return `${Math.floor(diff / 60000)} mins ago`;
                                                if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
                                                return new Date(item.created_at).toLocaleDateString();
                                            })()}
                                        </p>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </aside>
    );
};
