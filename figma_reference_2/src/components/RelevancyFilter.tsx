import { MapPin, CheckCircle, XCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';

const relevantBusinesses = [
  {
    id: 1,
    name: 'Innovative Tech Solutions',
    category: 'Software Development',
    address: '100 Innovation Dr, Seattle, WA 98101',
    passed: true,
  },
  {
    id: 2,
    name: 'NextGen Marketing',
    category: 'Digital Marketing',
    address: '250 Marketing Plaza, Austin, TX 78701',
    passed: true,
  },
  {
    id: 3,
    name: 'CloudFirst Consulting',
    category: 'Cloud Services',
    address: '75 Cloud Ave, Denver, CO 80202',
    passed: false,
  },
  {
    id: 4,
    name: 'DataDrive Analytics',
    category: 'Data Science',
    address: '300 Analytics Blvd, San Jose, CA 95113',
    passed: true,
  },
  {
    id: 5,
    name: 'Mobile App Masters',
    category: 'Mobile Development',
    address: '450 App Street, Miami, FL 33131',
    passed: true,
  },
  {
    id: 6,
    name: 'WebCraft Studios',
    category: 'Web Design',
    address: '600 Design Lane, Portland, OR 97204',
    passed: false,
  },
  {
    id: 7,
    name: 'CyberSecure Systems',
    category: 'Cybersecurity',
    address: '800 Security Dr, Washington, DC 20001',
    passed: true,
  },
  {
    id: 8,
    name: 'AI Innovation Labs',
    category: 'Artificial Intelligence',
    address: '900 AI Way, Cambridge, MA 02139',
    passed: true,
  },
  {
    id: 9,
    name: 'BlockChain Ventures',
    category: 'Blockchain',
    address: '1000 Crypto Blvd, San Francisco, CA 94102',
    passed: false,
  },
  {
    id: 10,
    name: 'IoT Connect',
    category: 'Internet of Things',
    address: '1100 IoT Street, Austin, TX 78702',
    passed: false,
  },
];

const passedCount = relevantBusinesses.filter(b => b.passed).length;
const totalCount = relevantBusinesses.length;

interface RelevancyFilterProps {
  onValidate: () => void;
}

export function RelevancyFilter({ onValidate }: RelevancyFilterProps) {
  return (
    <div className="p-8 bg-black min-h-screen">
      <div className="mb-8">
        <h1 className="text-white text-3xl mb-2">Relevancy Filter Results</h1>
        <p className="text-zinc-400 mb-4">
          Filtered based on your business criteria and preferences
        </p>
        <div className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2">
          <CheckCircle className="w-5 h-5 text-emerald-500" />
          <span className="text-white">
            <span className="text-emerald-500">{passedCount} Relevant Businesses</span> Found (Out of {totalCount})
          </span>
        </div>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {relevantBusinesses.map((business) => (
          <Card
            key={business.id}
            className={`border-2 transition-all ${
              business.passed
                ? 'bg-zinc-900 border-emerald-500/20'
                : 'bg-zinc-900/50 border-zinc-800'
            }`}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className={`text-lg mb-2 ${business.passed ? 'text-white' : 'text-zinc-500'}`}>
                    {business.name}
                  </h3>
                  <p className={business.passed ? 'text-zinc-400' : 'text-zinc-600'}>
                    {business.category}
                  </p>
                </div>
                {business.passed ? (
                  <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Passed
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-zinc-800 text-zinc-500 border-zinc-700">
                    <XCircle className="w-3 h-3 mr-1" />
                    Failed
                  </Badge>
                )}
              </div>
              <div className="flex items-start gap-2">
                <MapPin className={`w-4 h-4 mt-0.5 flex-shrink-0 ${business.passed ? 'text-zinc-400' : 'text-zinc-600'}`} />
                <span className={`text-sm ${business.passed ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  {business.address}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom Action */}
      <div className="flex justify-center">
        <Button
          onClick={onValidate}
          size="lg"
          className="bg-blue-600 hover:bg-blue-700 text-white px-8"
        >
          Validate These Businesses ({passedCount})
        </Button>
      </div>
    </div>
  );
}
