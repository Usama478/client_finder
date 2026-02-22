import { useState } from 'react';
import { Search, MapPin, Filter, Star, Shield } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { mockBusinesses, Business } from '../data/mockData';

interface SearchPageProps {
  onBusinessSelect: (businessId: string) => void;
}

export function SearchPage({ onBusinessSelect }: SearchPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedVerification, setSelectedVerification] = useState('all');
  const [filteredBusinesses, setFilteredBusinesses] = useState<Business[]>(mockBusinesses);

  const categories = ['all', 'Technology', 'Food & Beverage', 'Design & Creative', 'Healthcare', 'Marketing', 'Logistics'];
  const verificationStatuses = ['all', 'verified', 'partially-verified', 'not-verified'];

  const handleSearch = () => {
    let filtered = mockBusinesses;

    if (searchQuery) {
      filtered = filtered.filter(b => 
        b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(b => b.category === selectedCategory);
    }

    if (selectedVerification !== 'all') {
      filtered = filtered.filter(b => b.verificationStatus === selectedVerification);
    }

    setFilteredBusinesses(filtered);
  };

  const getVerificationBadge = (status: Business['verificationStatus']) => {
    const variants = {
      'verified': 'bg-green-500/10 text-green-400 border-green-500/20',
      'partially-verified': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      'not-verified': 'bg-red-500/10 text-red-400 border-red-500/20'
    };
    
    const labels = {
      'verified': 'Verified',
      'partially-verified': 'Partially Verified',
      'not-verified': 'Not Verified'
    };

    return (
      <Badge className={`${variants[status]} border`}>
        {labels[status]}
      </Badge>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-white mb-2">Search Businesses & Clients</h1>
        <p className="text-gray-400">Find and verify business information across multiple data sources</p>
      </div>

      {/* Search Bar */}
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 mb-6 shadow-lg">
        <div className="flex gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search new businesses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full bg-black border border-gray-700 rounded-lg pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gray-600 transition-colors"
            />
          </div>
          <Button onClick={handleSearch} className="bg-gray-700 hover:bg-gray-600 text-white px-6">
            Search
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-400">Filters:</span>
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-black border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-gray-600"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat}
              </option>
            ))}
          </select>

          <select
            value={selectedVerification}
            onChange={(e) => setSelectedVerification(e.target.value)}
            className="bg-black border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-gray-600"
          >
            {verificationStatuses.map(status => (
              <option key={status} value={status}>
                {status === 'all' ? 'All Statuses' : status.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </option>
            ))}
          </select>

          {(selectedCategory !== 'all' || selectedVerification !== 'all' || searchQuery) && (
            <Button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedVerification('all');
                setFilteredBusinesses(mockBusinesses);
              }}
              variant="ghost"
              className="text-gray-400 hover:text-gray-200 text-sm"
            >
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="mb-4 text-gray-400">
        Found {filteredBusinesses.length} {filteredBusinesses.length === 1 ? 'result' : 'results'}
      </div>

      <div className="space-y-4">
        {filteredBusinesses.map((business) => (
          <div
            key={business.id}
            onClick={() => onBusinessSelect(business.id)}
            className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-all cursor-pointer group shadow-lg"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-900 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-gray-400" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-white group-hover:text-gray-300 transition-colors mb-1">
                          {business.name}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <span>{business.category}</span>
                          {business.mismatchWarning && (
                            <>
                              <span>•</span>
                              <div className="flex items-center gap-1 text-yellow-400">
                                <Shield className="w-3 h-3" />
                                <span>Data Mismatch</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      {getVerificationBadge(business.verificationStatus)}
                    </div>
                    
                    <div className="flex items-center gap-1 mb-2">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < Math.floor(business.rating)
                                ? 'text-yellow-500 fill-yellow-500'
                                : 'text-gray-700'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-gray-400 ml-2">
                        {business.rating} ({business.reviewCount} reviews)
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <MapPin className="w-4 h-4" />
                      <span>{business.address}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
