import { useState } from 'react';
import { Search, Filter, CheckCircle, XCircle, Calendar, Tag } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

const mockClients = [
  {
    id: 1,
    name: 'TechStart Solutions',
    category: 'Software Development',
    address: '123 Tech Street, San Francisco, CA',
    verified: true,
    addedDate: '2025-01-15',
    rating: 4.8,
    tags: ['Potential Lead', 'High Rating'],
    logo: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=100&h=100&fit=crop',
  },
  {
    id: 2,
    name: 'Digital Marketing Pro',
    category: 'Marketing Agency',
    address: '456 Market Ave, New York, NY',
    verified: true,
    addedDate: '2025-01-18',
    rating: 4.5,
    tags: ['Active Client'],
    logo: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=100&h=100&fit=crop',
  },
  {
    id: 3,
    name: 'Creative Studio Plus',
    category: 'Design Agency',
    address: '789 Design Blvd, Los Angeles, CA',
    verified: false,
    addedDate: '2025-01-20',
    rating: 4.2,
    tags: ['Needs Review'],
    logo: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=100&h=100&fit=crop',
  },
  {
    id: 4,
    name: 'Finance Consulting Group',
    category: 'Financial Services',
    address: '321 Wall Street, Chicago, IL',
    verified: true,
    addedDate: '2025-01-22',
    rating: 4.9,
    tags: ['High Rating', 'Verified'],
    logo: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=100&h=100&fit=crop',
  },
  {
    id: 5,
    name: 'HealthTech Innovations',
    category: 'Healthcare Technology',
    address: '555 Medical Dr, Boston, MA',
    verified: true,
    addedDate: '2025-01-25',
    rating: 4.7,
    tags: ['Potential Lead'],
    logo: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=100&h=100&fit=crop',
  },
  {
    id: 6,
    name: 'EcoFriendly Products',
    category: 'Retail',
    address: '888 Green Way, Portland, OR',
    verified: true,
    addedDate: '2025-01-26',
    rating: 4.6,
    tags: ['Active Client', 'High Rating'],
    logo: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=100&h=100&fit=crop',
  },
];

interface ClientsProps {
  onSelectBusiness: (business: any) => void;
}

export function Clients({ onSelectBusiness }: ClientsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const filteredClients = mockClients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || client.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-8 bg-black min-h-screen">
      <div className="mb-8">
        <h1 className="text-white text-3xl mb-2">Clients</h1>
        <p className="text-zinc-400">Manage your saved and verified clients</p>
      </div>

      {/* Top Controls */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <Input
            placeholder="Search saved clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-zinc-900 border-zinc-800 text-white"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full md:w-[200px] bg-zinc-900 border-zinc-800 text-white">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="Software Development">Software Development</SelectItem>
            <SelectItem value="Marketing Agency">Marketing Agency</SelectItem>
            <SelectItem value="Design Agency">Design Agency</SelectItem>
            <SelectItem value="Financial Services">Financial Services</SelectItem>
            <SelectItem value="Healthcare Technology">Healthcare Technology</SelectItem>
            <SelectItem value="Retail">Retail</SelectItem>
          </SelectContent>
        </Select>
        <Button className="bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700">
          <Filter className="w-4 h-4 mr-2" />
          More Filters
        </Button>
      </div>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredClients.map((client) => (
          <Card
            key={client.id}
            className="bg-zinc-900 border-zinc-800 hover:bg-zinc-800/50 transition-all cursor-pointer"
            onClick={() => onSelectBusiness(client)}
          >
            <CardContent className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0">
                  <img src={client.logo} alt={client.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white mb-1 truncate">{client.name}</h3>
                  <p className="text-zinc-400 text-sm">{client.category}</p>
                </div>
                {client.verified ? (
                  <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-zinc-500 flex-shrink-0" />
                )}
              </div>

              <div className="space-y-2 mb-4">
                <p className="text-zinc-400 text-sm">{client.address}</p>
                <div className="flex items-center gap-2">
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <span
                        key={i}
                        className={`text-sm ${
                          i < Math.floor(client.rating) ? 'text-amber-500' : 'text-zinc-700'
                        }`}
                      >
                        ★
                      </span>
                    ))}
                    <span className="text-zinc-400 text-sm ml-2">{client.rating}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4 text-zinc-500" />
                <span className="text-zinc-400 text-sm">Added {client.addedDate}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {client.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="bg-zinc-800 text-zinc-300 border-0">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
