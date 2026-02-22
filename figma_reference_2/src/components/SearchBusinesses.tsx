import { useState } from 'react';
import { Search, MapPin, ChevronDown, Filter } from 'lucide-react';
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

const mockSearchResults = [
  {
    id: 1,
    name: 'Innovative Tech Solutions',
    category: 'Software Development',
    address: '100 Innovation Dr, Seattle, WA 98101',
  },
  {
    id: 2,
    name: 'NextGen Marketing',
    category: 'Digital Marketing',
    address: '250 Marketing Plaza, Austin, TX 78701',
  },
  {
    id: 3,
    name: 'CloudFirst Consulting',
    category: 'Cloud Services',
    address: '75 Cloud Ave, Denver, CO 80202',
  },
  {
    id: 4,
    name: 'DataDrive Analytics',
    category: 'Data Science',
    address: '300 Analytics Blvd, San Jose, CA 95113',
  },
  {
    id: 5,
    name: 'Mobile App Masters',
    category: 'Mobile Development',
    address: '450 App Street, Miami, FL 33131',
  },
  {
    id: 6,
    name: 'WebCraft Studios',
    category: 'Web Design',
    address: '600 Design Lane, Portland, OR 97204',
  },
  {
    id: 7,
    name: 'CyberSecure Systems',
    category: 'Cybersecurity',
    address: '800 Security Dr, Washington, DC 20001',
  },
  {
    id: 8,
    name: 'AI Innovation Labs',
    category: 'Artificial Intelligence',
    address: '900 AI Way, Cambridge, MA 02139',
  },
];

const filterChips = [
  'High Rating (4.5+)',
  'Has Website',
  'Active on Social Media',
  'Verified Business',
  'Open Now',
];

interface SearchBusinessesProps {
  onFilterRelevant: () => void;
}

export function SearchBusinesses({ onFilterRelevant }: SearchBusinessesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState('google-maps');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev =>
      prev.includes(filter)
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };

  return (
    <div className="p-8 bg-black min-h-screen">
      <div className="mb-8">
        <h1 className="text-white text-3xl mb-2">Search Businesses</h1>
        <p className="text-zinc-400">Discover new businesses from multiple sources</p>
      </div>

      {/* Top Search Bar */}
      <Card className="bg-zinc-900 border-zinc-800 mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <Input
                placeholder="Search new businesses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 bg-zinc-800 border-zinc-700 text-white text-lg"
              />
            </div>
            <Select value={selectedSource} onValueChange={setSelectedSource}>
              <SelectTrigger className="w-full md:w-[200px] h-12 bg-zinc-800 border-zinc-700 text-white">
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="google-maps">Google Maps</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
                <SelectItem value="yelp">Yelp</SelectItem>
              </SelectContent>
            </Select>
            <Button className="h-12 bg-blue-600 hover:bg-blue-700 text-white">
              Search
            </Button>
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap gap-2">
            {filterChips.map((chip) => (
              <Badge
                key={chip}
                variant="secondary"
                className={`cursor-pointer transition-all ${
                  activeFilters.includes(chip)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border-zinc-700'
                }`}
                onClick={() => toggleFilter(chip)}
              >
                {chip}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Search Results List */}
      <div className="space-y-4 mb-6">
        {mockSearchResults.map((business) => (
          <Card key={business.id} className="bg-zinc-900 border-zinc-800 hover:bg-zinc-800/50 transition-all">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-white text-lg mb-2">{business.name}</h3>
                  <p className="text-zinc-400 mb-2">{business.category}</p>
                  <div className="flex items-center gap-2 text-zinc-400">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">{business.address}</span>
                  </div>
                </div>
                <Button variant="outline" className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
                  View Details
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom Controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button variant="outline" className="bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800">
          <ChevronDown className="w-4 h-4 mr-2" />
          Show More Results
        </Button>
        <Button
          onClick={onFilterRelevant}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Filter className="w-4 h-4 mr-2" />
          Filter Relevant Businesses
        </Button>
      </div>
    </div>
  );
}
