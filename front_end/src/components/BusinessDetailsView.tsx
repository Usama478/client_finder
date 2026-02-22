import { ArrowLeft, MapPin, Globe, Shield, Star, Phone, Mail, AlertTriangle, Building2, Server } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';

interface BusinessDetailsViewProps {
  businessId: string | null;
  results: any[];
  onBack: () => void;
}

export function BusinessDetailsView({ businessId, results, onBack }: BusinessDetailsViewProps) {
  const business = results.find(b => (b.id || b.result_id || b.place_id).toString() === businessId);

  if (!business) {
    return (
      <div className="p-8">
        <Button onClick={onBack} variant="ghost" className="text-gray-400 hover:text-gray-200 mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Search
        </Button>
        <div className="text-gray-400">Business not found</div>
      </div>
    );
  }

  const getVerificationStatus = () => {
    if (business.is_verified || (business.verification_score && business.verification_score > 70)) return 'verified';
    if (!business.is_verified && business.verification_score && business.verification_score > 40 && business.verification_score <= 70) return 'partially-verified';
    return 'not-verified';
  };

  const getVerificationBadge = () => {
    const status = getVerificationStatus();
    const variants: Record<string, string> = {
      'verified': 'bg-green-500/10 text-green-400 border-green-500/20',
      'partially-verified': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      'not-verified': 'bg-red-500/10 text-red-400 border-red-500/20'
    };
    const labels: Record<string, string> = {
      'verified': 'Verified',
      'partially-verified': 'Partial Verification',
      'not-verified': 'Not Verified'
    };

    return (
      <Badge className={`${variants[status]} border`}>
        <Shield className="w-3 h-3 mr-1" />
        {labels[status]}
      </Badge>
    );
  };

  const score = business.relevance_score != null ? business.relevance_score : 50;
  const risk = score > 70 ? 'low' : score > 40 ? 'medium' : 'high';

  const getRiskBadge = () => {
    const variants: Record<string, string> = {
      'low': 'bg-green-500/10 text-green-400 border-green-500/20',
      'medium': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      'high': 'bg-red-500/10 text-red-400 border-red-500/20'
    };
    return (
      <Badge className={`${variants[risk]} border`}>
        Risk: {risk.charAt(0).toUpperCase() + risk.slice(1)}
      </Badge>
    );
  };

  const category = business.types?.[0]?.replace(/_/g, ' ') || 'Local Business';
  const rawData = business.raw_data || {};

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Button onClick={onBack} variant="ghost" className="text-gray-400 hover:text-gray-200 mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Search
      </Button>

      {/* Header */}
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-8 mb-6 shadow-lg">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <Building2 className="w-8 h-8 text-blue-400" />
              {business.business_name || 'Unknown Business'}
            </h1>
            <div className="flex items-center gap-2 text-gray-400 mb-4 font-medium">
              <span className="capitalize">{category}</span>
              <span>•</span>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${i < Math.floor(business.rating || 0)
                      ? 'text-yellow-500 fill-yellow-500'
                      : 'text-gray-700'
                      }`}
                  />
                ))}
                <span className="ml-2">{business.rating || 'No'} rating</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getVerificationBadge()}
              {getRiskBadge()}
              {business.relevance_score != null && (
                <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 border">
                  Relevance Score: {business.relevance_score}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {risk === 'high' && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-start gap-3 mt-4">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-yellow-400 font-semibold mb-1">Data Mismatch / Low Relevance Warning</div>
              <div className="text-sm text-gray-400">
                This lead scored low on relevance or verification. Review the AI reasoning details carefully before proceeding.
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Business Information */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 shadow-lg">
          <h3 className="text-white font-semibold mb-5 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-gray-400" />
            Basic Information
          </h3>
          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-500 mb-1 font-medium">Address</div>
              <div className="text-gray-300">{business.address || 'Address not found'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1 font-medium">Place ID</div>
              <div className="text-gray-300 font-mono text-xs bg-black/50 p-2 rounded">{business.place_id || business.id}</div>
            </div>
          </div>
        </div>

        {/* Contact Details */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 shadow-lg">
          <h3 className="text-white font-semibold mb-5 flex items-center gap-2">
            <Mail className="w-5 h-5 text-gray-400" />
            Contact Details
          </h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg border border-gray-800/50">
              <Phone className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-sm text-gray-500 font-medium">Phone</div>
                <div className="text-gray-300">{business.phone_number || 'No phone provided'}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg border border-gray-800/50">
              <Mail className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-sm text-gray-500 font-medium">Email</div>
                {business.email_found ? (
                  <div className="text-green-400">{business.email_found}</div>
                ) : (
                  <div className="text-gray-500 italic">Not yet scanned</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg border border-gray-800/50">
              <Globe className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-sm text-gray-500 font-medium">Website</div>
                {business.website ? (
                  <a href={`https://${business.website.replace(/^https?:\/\//, '')}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline transition-colors block truncate w-48 sm:w-64">
                    {business.website.replace(/^https?:\/\//, '')}
                  </a>
                ) : (
                  <div className="text-gray-500 italic">No website</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* AI Relevancy Analysis */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 shadow-lg">
          <h3 className="text-white font-semibold mb-5 flex items-center gap-2">
            <Server className="w-5 h-5 text-gray-400" />
            AI Relevancy Analysis
          </h3>
          <div className="space-y-4">
            {business.relevance_score != null ? (
              <>
                <div>
                  <div className="text-sm text-gray-500 mb-2 font-medium">Relevance Score</div>
                  <div className="flex items-center gap-3">
                    <Progress value={business.relevance_score} className="flex-1" />
                    <span className="text-gray-300 font-bold">{business.relevance_score}/100</span>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-2 font-medium">AI Reasoning</div>
                  <div className="bg-black/30 p-4 rounded-lg text-sm text-gray-300 leading-relaxed max-h-48 overflow-y-auto border border-gray-800/50 whitespace-pre-wrap">
                    {business.relevance_reason}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-gray-500 italic p-4 bg-black/20 rounded-lg text-center">
                Relevancy AI has not processed this lead yet.
              </div>
            )}
          </div>
        </div>

        {/* AI Verification Results */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 shadow-lg">
          <h3 className="text-white font-semibold mb-5 flex items-center gap-2">
            <Shield className="w-5 h-5 text-gray-400" />
            AI Verification Results
          </h3>
          <div className="space-y-4">
            {business.verification_status ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-500 mb-1 font-medium">Domain Age</div>
                    <div className="text-gray-300">{rawData.domain_age ? `${rawData.domain_age} years` : 'Unknown'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 mb-1 font-medium">Site Status</div>
                    <div className="text-gray-300 capitalize">{rawData.website_status || 'Unknown'}</div>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-2 font-medium">Verification Status</div>
                  <Badge className={business.verification_status === 'completed' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}>
                    {business.verification_status.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-2 font-medium">AI Reasoning</div>
                  <div className="bg-black/30 p-4 rounded-lg text-sm text-gray-300 leading-relaxed max-h-32 overflow-y-auto border border-gray-800/50 whitespace-pre-wrap">
                    {business.verification_reason || 'No detailed reasoning provided.'}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-gray-500 italic p-4 bg-black/20 rounded-lg text-center">
                Verification AI has not processed this lead yet.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
