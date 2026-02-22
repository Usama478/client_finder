import { ArrowLeft, Globe, Shield, Instagram, Facebook, Linkedin, MessageCircle, Phone, Mail, MapPin, CheckCircle, XCircle, Tag, Trash2, Edit } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

interface BusinessDetailsProps {
  business: any;
  onBack: () => void;
}

export function BusinessDetails({ business, onBack }: BusinessDetailsProps) {
  if (!business) {
    return (
      <div className="p-8 bg-black min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">No business selected</p>
          <Button variant="outline" onClick={onBack} className="text-zinc-400">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const category = business.types?.[0]?.replace(/_/g, ' ') || 'Local Business';
  const isVerified = business.is_verified;
  const hasWebsite = !!business.website;

  let rawData: any = {};
  if (business.raw_data) {
    try {
      rawData = typeof business.raw_data === 'string' ? JSON.parse(business.raw_data) : business.raw_data;
    } catch (e) {
      console.error("Failed to parse raw_data", e);
    }
  }

  const socialLinksRaw: string[] = Array.isArray(rawData?.social_links) ? rawData.social_links : [];
  const socialLinks = {
    instagram: socialLinksRaw.some(link => link.includes('instagram.com')),
    facebook: socialLinksRaw.some(link => link.includes('facebook.com')),
    twitter: socialLinksRaw.some(link => link.includes('twitter.com') || link.includes('x.com')),
    linkedin: socialLinksRaw.some(link => link.includes('linkedin.com'))
  };

  return (
    <div className="p-8 bg-black min-h-screen">
      {/* Header with Back Button */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-zinc-400 hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Clients
        </Button>
        <h1 className="text-white text-3xl mb-2">Business Details</h1>
        <p className="text-zinc-400">Complete AI verification information and status</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Left Side */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info Card */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="border-b border-zinc-800">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-zinc-500 font-bold text-2xl">{business.business_name?.[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1">
                  <CardTitle className="text-white text-2xl mb-2">{business.business_name}</CardTitle>
                  <p className="text-zinc-400 capitalize">{category}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {isVerified ? (
                      <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 border-zinc-700">
                        <XCircle className="w-3 h-3 mr-1" />
                        Unverified
                      </Badge>
                    )}
                    {business.relevance_score != null ? (
                      <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                        Score: {business.relevance_score}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 border-zinc-700">
                        Pending Score
                      </Badge>
                    )}
                    {business.verification_score != null && (
                      <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20">
                        Verification Score: {business.verification_score}
                      </Badge>
                    )}
                    {!isVerified && business.relevance_score == null && (
                      <Badge className="bg-blue-600 text-white border-blue-500 text-xs">
                        New
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-start gap-2 mb-4">
                <MapPin className="w-5 h-5 text-zinc-400 mt-0.5 flex-shrink-0" />
                <span className="text-zinc-300">{business.address || 'Address not listed'}</span>
              </div>

              {business.relevance_reason && (
                <div className="mt-6 pt-6 border-t border-zinc-800">
                  <p className="text-sm text-zinc-400 font-semibold mb-2">AI Relevancy Reasoning</p>
                  <p className="text-sm text-zinc-300 leading-relaxed bg-zinc-800/50 p-4 rounded-lg">
                    {business.relevance_reason}
                  </p>
                </div>
              )}
              {(business.verification_reasoning || business.verification_reason || business.evidence_summary || rawData?.evidence_summary) && (
                <div className="mt-6 pt-6 border-t border-zinc-800">
                  <p className="text-sm text-zinc-400 font-semibold mb-2">AI Verification Reasoning</p>
                  <p className="text-sm text-zinc-300 leading-relaxed bg-zinc-800/50 p-4 rounded-lg">
                    {business.verification_reasoning || business.verification_reason || business.evidence_summary || rawData?.evidence_summary}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Website Check */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-zinc-400" />
                <CardTitle className="text-white">Website Validation Details</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Website Found</span>
                  {hasWebsite ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-zinc-500" />}
                </div>
                {hasWebsite && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">SSL Status</span>
                      <div className="flex items-center gap-2">
                        <Shield className={(rawData?.website_status?.ssl_valid ?? business.website?.startsWith('https')) ? "w-5 h-5 text-emerald-500" : "w-5 h-5 text-amber-500"} />
                        <span className={(rawData?.website_status?.ssl_valid ?? business.website?.startsWith('https')) ? "text-emerald-500" : "text-amber-500"}>
                          {(rawData?.website_status?.ssl_valid ?? business.website?.startsWith('https')) ? 'Secure' : 'Insecure'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Domain Age</span>
                      <span className="text-zinc-300">
                        {rawData?.domain_age || rawData?.domain_info?.age_days ? `${rawData?.domain_age || rawData?.domain_info?.age_days} days` : 'Unknown'}
                      </span>
                    </div>
                    <div className="pt-2">
                      <a
                        href={business.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline block truncate"
                      >
                        {business.website}
                      </a>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Social Media Presence */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-zinc-400" />
                <CardTitle className="text-white">Social Media Signatures</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Instagram className="w-5 h-5 text-zinc-400" />
                    <span className="text-zinc-300">Instagram</span>
                  </div>
                  {socialLinks.instagram ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-zinc-500" />}
                </div>
                <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Facebook className="w-5 h-5 text-zinc-400" />
                    <span className="text-zinc-300">Facebook</span>
                  </div>
                  {socialLinks.facebook ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-zinc-500" />}
                </div>
                <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-zinc-400" />
                    <span className="text-zinc-300">Twitter</span>
                  </div>
                  {socialLinks.twitter ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-zinc-500" />}
                </div>
                <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Linkedin className="w-5 h-5 text-zinc-400" />
                    <span className="text-zinc-300">LinkedIn</span>
                  </div>
                  {socialLinks.linkedin ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-zinc-500" />}
                </div>
              </div>
            </CardContent>
          </Card>


        </div>

        {/* Sidebar - Right Side */}
        <div className="space-y-6">
          {/* Contact Information */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="border-b border-zinc-800">
              <CardTitle className="text-white">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-zinc-400 mt-0.5" />
                <div className="overflow-hidden min-w-0">
                  <p className="text-zinc-400 text-sm mb-1">Phone</p>
                  <p className="text-white truncate">{business.phone_number || 'Not provided'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-zinc-400 mt-0.5" />
                <div className="overflow-hidden min-w-0">
                  <p className="text-zinc-400 text-sm mb-1">Email (Scraped)</p>
                  {(() => {
                    const scrapedEmails = business.email_addresses || rawData?.emails || rawData?.contact_info?.emails || rawData?.emails_found || [];
                    if (scrapedEmails.length > 0) {
                      return scrapedEmails.map((email: string, i: number) => (
                        <p key={i} className="text-white truncate">{email}</p>
                      ));
                    }
                    return <p className="text-zinc-500 truncate">No emails detected</p>;
                  })()}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Globe className="w-5 h-5 text-zinc-400 mt-0.5" />
                <div className="overflow-hidden min-w-0">
                  <p className="text-zinc-400 text-sm mb-1">Website</p>
                  {hasWebsite ? (
                    <a href={business.website} className="text-blue-400 hover:underline truncate block">
                      {business.website}
                    </a>
                  ) : (
                    <p className="text-zinc-500 truncate">Not available</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Management Actions */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="border-b border-zinc-800">
              <CardTitle className="text-white">Management</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white justify-start">
                <Edit className="w-4 h-4 mr-2" />
                Edit Client Info
              </Button>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white justify-start">
                <Tag className="w-4 h-4 mr-2" />
                Mark as Lead
              </Button>
              <Button variant="outline" className="w-full border-red-500/20 text-red-500 hover:bg-red-500/10 justify-start">
                <Trash2 className="w-4 h-4 mr-2" />
                Remove from Clients
              </Button>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="border-b border-zinc-800">
              <CardTitle className="text-white">Pipeline Stats</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              <div className="flex justify-between">
                <span className="text-zinc-400">Added Date</span>
                <span className="text-white">Just now</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Verification</span>
                <span className={isVerified ? "text-emerald-400" : "text-amber-400"}>
                  {isVerified ? 'Completed' : 'Pending'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Interactions</span>
                <span className="text-white">0</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
