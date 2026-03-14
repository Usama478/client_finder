import { 
  Search, 
  Target, 
  ShieldCheck, 
  Users, 
  Mail, 
  Plus,
  ArrowRight,
  Clock,
  MapPin,
  ChevronRight
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchDashboardStats } from '../services/api';
import type { SearchResult } from '../types/search-result';
import { EmptyState } from './page/EmptyState';
import { LoadingState } from './page/LoadingState';
import { PageHeader } from './page/PageHeader';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { cn } from './ui/utils';

interface DashboardProps {
  history: any[];
  onSelectHistory: (searchId: string) => Promise<void>;
}

// Pipeline stage configuration
const pipelineStages = [
  { 
    id: 'search', 
    label: 'Search', 
    icon: Search, 
    description: 'Find businesses',
    route: '/search'
  },
  { 
    id: 'relevancy', 
    label: 'Relevancy', 
    icon: Target, 
    description: 'Score leads',
    route: '/relevancy'
  },
  { 
    id: 'verification', 
    label: 'Verification', 
    icon: ShieldCheck, 
    description: 'Verify trust',
    route: '/validation'
  },
  { 
    id: 'clients', 
    label: 'Clients', 
    icon: Users, 
    description: 'Shortlist',
    route: '/clients'
  },
  { 
    id: 'outreach', 
    label: 'Outreach', 
    icon: Mail, 
    description: 'Contact',
    route: '/email'
  },
];

export function DashboardOverview({ history, onSelectHistory }: DashboardProps) {
  const [statsData, setStatsData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadStats = async () => {
      try {
        setIsLoading(true);
        const data = await fetchDashboardStats();
        setStatsData(data);
      } catch (error) {
        console.error("Failed to load dashboard stats:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadStats();
  }, []);

  const totalBusinessesFound = statsData?.total_results || statsData?.businesses_found || 0;
  const relevantLeads = statsData?.relevant_leads || statsData?.scored_businesses || 0;
  const verifiedLeads = statsData?.verified_clients || 0;
  const savedClients = statsData?.total_clients || 0;
  const globalTotalSearches = statsData?.total_searches || 0;

  // Compute pipeline stats
  const pipelineStats = [
    { stage: 'search', count: globalTotalSearches, label: 'Searches' },
    { stage: 'relevancy', count: relevantLeads, label: 'Scored' },
    { stage: 'verification', count: verifiedLeads, label: 'Verified' },
    { stage: 'clients', count: savedClients, label: 'Saved' },
  ];

  // Determine next recommended action based on data
  const getNextAction = () => {
    if (globalTotalSearches === 0) {
      return { message: 'Start by searching for businesses', route: '/search', cta: 'New Search' };
    }
    if (relevantLeads === 0 && totalBusinessesFound > 0) {
      return { message: 'Score your results for relevancy', route: '/relevancy', cta: 'Score Leads' };
    }
    if (verifiedLeads === 0 && relevantLeads > 0) {
      return { message: 'Verify your top leads', route: '/validation', cta: 'Start Verification' };
    }
    if (savedClients === 0 && verifiedLeads > 0) {
      return { message: 'Save your best clients', route: '/clients', cta: 'View Clients' };
    }
    return { message: 'Continue building your pipeline', route: '/search', cta: 'New Search' };
  };

  const nextAction = getNextAction();

  if (isLoading) {
    return <LoadingState message="Loading your workspace..." />;
  }

  const hasAnyData = globalTotalSearches > 0 || savedClients > 0;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header with primary action */}
      <PageHeader
        title="Dashboard"
        description="Your client discovery control center"
        actions={
          <Button onClick={() => navigate('/search')} className="gap-2">
            <Plus className="w-4 h-4" />
            New Search
          </Button>
        }
      />

      {/* Next Action Banner - Contextual guidance */}
      <Card className="border-primary-500/20 bg-primary-500/5 dark:bg-primary-500/10">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 dark:bg-primary-500/20">
                <ArrowRight className="w-5 h-5 text-primary-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Recommended next step</p>
                <p className="text-sm text-gray-500 dark:text-zinc-400">{nextAction.message}</p>
              </div>
            </div>
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => navigate(nextAction.route)}
              className="shrink-0"
            >
              {nextAction.cta}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Overview Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Pipeline Overview</h2>
        </div>
        
        {/* Pipeline Flow Visual */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {pipelineStages.map((stage, index) => {
                const Icon = stage.icon;
                const stat = pipelineStats.find(s => s.stage === stage.id);
                const isActive = stat && stat.count > 0;
                
                return (
                  <div key={stage.id} className="flex items-center gap-3 lg:flex-1">
                    {/* Stage Card */}
                    <button
                      onClick={() => navigate(stage.route)}
                      className={cn(
                        "flex-1 flex items-center gap-4 p-4 rounded-xl border transition-all",
                        "hover:border-primary-500/50 hover:bg-gray-50 dark:hover:bg-zinc-800/50",
                        isActive 
                          ? "border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900" 
                          : "border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50"
                      )}
                    >
                      <div className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
                        isActive 
                          ? "bg-primary-500/10 text-primary-500" 
                          : "bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500"
                      )}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{stage.label}</p>
                        {stat ? (
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.count}</p>
                        ) : (
                          <p className="text-xs text-gray-500 dark:text-zinc-400">{stage.description}</p>
                        )}
                      </div>
                    </button>
                    
                    {/* Connector Arrow (not on last item) */}
                    {index < pipelineStages.length - 1 && (
                      <div className="hidden lg:flex items-center justify-center w-6 shrink-0">
                        <ChevronRight className="w-5 h-5 text-gray-300 dark:text-zinc-600" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Quick Stats Grid */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Stats</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatBlock 
            label="Total Searches" 
            value={globalTotalSearches} 
            icon={<Search className="w-5 h-5" />}
            onClick={() => navigate('/search')}
          />
          <StatBlock 
            label="Relevant Leads" 
            value={relevantLeads} 
            icon={<Target className="w-5 h-5" />}
            onClick={() => navigate('/relevancy')}
          />
          <StatBlock 
            label="Verified Leads" 
            value={verifiedLeads} 
            icon={<ShieldCheck className="w-5 h-5" />}
            onClick={() => navigate('/validation')}
          />
          <StatBlock 
            label="Saved Clients" 
            value={savedClients} 
            icon={<Users className="w-5 h-5" />}
            onClick={() => navigate('/clients')}
            highlighted={savedClients > 0}
          />
        </div>
      </section>

      {/* Recent Activity Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Searches</h2>
          {history.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => navigate('/search')}>
              View all
            </Button>
          )}
        </div>
        
        <Card>
          <CardContent className="p-0">
            {history.length === 0 ? (
              <EmptyState
                title="No searches yet"
                description="Start your first search to discover potential clients"
                icon={<Search className="w-5 h-5" />}
                action={
                  <Button onClick={() => navigate('/search')} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Start First Search
                  </Button>
                }
                className="border-0 rounded-xl py-12"
              />
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                {history.slice(0, 5).map((search: any) => (
                  <button
                    key={search.search_id}
                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors first:rounded-t-xl last:rounded-b-xl"
                    onClick={() => onSelectHistory(search.search_id.toString())}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-zinc-800">
                      <Search className="w-4 h-4 text-gray-500 dark:text-zinc-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {search.query || search.search_query || 'Unknown Search'}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        {search.location && (
                          <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-zinc-400">
                            <MapPin className="w-3 h-3" />
                            {search.location}
                          </span>
                        )}
                        <span className="text-xs text-gray-500 dark:text-zinc-400">
                          {search.total_results || 0} results
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-zinc-500">
                        <Clock className="w-3 h-3" />
                        {search.created_at ? formatRelativeTime(search.created_at) : 'Unknown'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-300 dark:text-zinc-600" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Empty state for completely new users */}
      {!hasAnyData && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-500/10 mb-4">
              <Search className="w-6 h-6 text-primary-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Welcome to Client Finder
            </h3>
            <p className="text-sm text-gray-500 dark:text-zinc-400 max-w-md mx-auto mb-6">
              Discover, score, verify, and manage your ideal B2B clients. Start by searching for businesses in your target market.
            </p>
            <Button onClick={() => navigate('/search')} size="lg" className="gap-2">
              <Plus className="w-4 h-4" />
              Start Your First Search
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Helper component for stat blocks
function StatBlock({ 
  label, 
  value, 
  icon, 
  onClick,
  highlighted = false 
}: { 
  label: string; 
  value: number; 
  icon: React.ReactNode;
  onClick?: () => void;
  highlighted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-start p-4 rounded-xl border transition-all text-left",
        "hover:border-primary-500/50 hover:bg-gray-50 dark:hover:bg-zinc-800/50",
        highlighted 
          ? "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10" 
          : "border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
      )}
    >
      <div className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg mb-3",
        highlighted 
          ? "bg-emerald-500/10 text-emerald-500" 
          : "bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400"
      )}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{label}</p>
    </button>
  );
}

// Helper function to format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
