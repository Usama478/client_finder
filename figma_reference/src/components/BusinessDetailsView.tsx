import { ArrowLeft, MapPin, Globe, Shield, Star, Phone, Mail, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { mockBusinesses, Business } from '../data/mockData';
import { Progress } from './ui/progress';

interface BusinessDetailsViewProps {
  businessId: string | null;
  onBack: () => void;
}

export function BusinessDetailsView({ businessId, onBack }: BusinessDetailsViewProps) {
  const business = mockBusinesses.find(b => b.id === businessId);

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
        <Shield className="w-3 h-3 mr-1" />
        {labels[status]}
      </Badge>
    );
  };

  const getRiskBadge = (risk: Business['riskScore']) => {
    const variants = {
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

  const getSocialIcon = (platform: string) => {
    // Using text as placeholder for social icons
    return <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center text-xs text-gray-400">{platform.slice(0, 2)}</div>;
  };

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
            <h1 className="text-white mb-2">{business.name}</h1>
            <div className="flex items-center gap-2 text-gray-400 mb-4">
              <span>{business.category}</span>
              <span>•</span>
              <div className="flex items-center gap-1">
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
                <span className="ml-2">{business.rating} ({business.reviewCount} reviews)</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getVerificationBadge(business.verificationStatus)}
              {getRiskBadge(business.riskScore)}
            </div>
          </div>
          <Button className="bg-gray-700 hover:bg-gray-600 text-white">
            Add to Client List
          </Button>
        </div>

        {business.mismatchWarning && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-yellow-400 mb-1">Data Mismatch Warning</div>
              <div className="text-sm text-gray-400">
                Inconsistent address or business information detected across multiple data sources. Manual verification recommended.
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Basic Business Information */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 shadow-lg">
          <h3 className="text-white mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-gray-400" />
            Basic Information
          </h3>
          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-500 mb-1">Address</div>
              <div className="text-gray-300">{business.address}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Location Coordinates</div>
              <div className="text-gray-300 text-sm">
                {business.location.lat}, {business.location.lng}
              </div>
            </div>
            <div className="bg-black/50 rounded-lg p-4 flex items-center justify-center h-40">
              <MapPin className="w-8 h-8 text-gray-600" />
              <span className="ml-2 text-gray-600">Map Preview</span>
            </div>
          </div>
        </div>

        {/* Website Presence */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 shadow-lg">
          <h3 className="text-white mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-gray-400" />
            Website Presence
          </h3>
          <div className="space-y-4">
            {business.website && (
              <div>
                <div className="text-sm text-gray-500 mb-1">Website</div>
                <a href={business.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">
                  {business.website}
                </a>
              </div>
            )}
            {business.sslStatus && (
              <div>
                <div className="text-sm text-gray-500 mb-2">SSL Certificate</div>
                <Badge className={business.sslStatus === 'valid' ? 'bg-green-500/10 text-green-400 border-green-500/20 border' : 'bg-red-500/10 text-red-400 border-red-500/20 border'}>
                  {business.sslStatus === 'valid' ? (
                    <><CheckCircle className="w-3 h-3 mr-1" /> Valid SSL</>
                  ) : (
                    <><AlertTriangle className="w-3 h-3 mr-1" /> Invalid SSL</>
                  )}
                </Badge>
              </div>
            )}
            <div>
              <div className="text-sm text-gray-500 mb-2">Activity Score</div>
              <div className="flex items-center gap-3">
                <Progress value={business.activityScore} className="flex-1" />
                <span className="text-gray-300">{business.activityScore}%</span>
              </div>
            </div>
            {business.uptime && (
              <div>
                <div className="text-sm text-gray-500 mb-2">Uptime</div>
                <Badge className="bg-green-500/10 text-green-400 border-green-500/20 border">
                  {business.uptime}% Uptime
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Social Media Presence */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 shadow-lg">
          <h3 className="text-white mb-4">Social Media Presence</h3>
          <div className="space-y-4">
            {business.socialMedia.map((social, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                <div className="flex items-center gap-3">
                  {getSocialIcon(social.platform)}
                  <div>
                    <div className="text-gray-300 flex items-center gap-2">
                      {social.platform}
                      {social.verified && <CheckCircle className="w-4 h-4 text-blue-400" />}
                    </div>
                    <div className="text-sm text-gray-500">{social.followers.toLocaleString()} followers</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {social.lastActive}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact Details */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 shadow-lg">
          <h3 className="text-white mb-4">Contact Details</h3>
          <div className="space-y-4">
            {business.phone && (
              <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg">
                <Phone className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">Phone</div>
                  <div className="text-gray-300">{business.phone}</div>
                </div>
              </div>
            )}
            {business.email && (
              <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg">
                <Mail className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">Email</div>
                  <div className="text-gray-300">{business.email}</div>
                </div>
              </div>
            )}
            {business.website && (
              <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg">
                <Globe className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">Website</div>
                  <a href={business.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">
                    {business.website.replace('https://', '').replace('http://', '')}
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reviews & Sentiment */}
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 mt-6 shadow-lg">
        <h3 className="text-white mb-4">Reviews & Ratings</h3>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <div className="text-sm text-gray-500 mb-2">Positive</div>
            <div className="flex items-center gap-3">
              <Progress value={business.sentiment.positive} className="flex-1 [&>div]:bg-green-500" />
              <span className="text-gray-300">{business.sentiment.positive}%</span>
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-2">Neutral</div>
            <div className="flex items-center gap-3">
              <Progress value={business.sentiment.neutral} className="flex-1 [&>div]:bg-gray-500" />
              <span className="text-gray-300">{business.sentiment.neutral}%</span>
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-2">Negative</div>
            <div className="flex items-center gap-3">
              <Progress value={business.sentiment.negative} className="flex-1 [&>div]:bg-red-500" />
              <span className="text-gray-300">{business.sentiment.negative}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
