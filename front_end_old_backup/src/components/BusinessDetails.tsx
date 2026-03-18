import { ArrowLeft, Globe, Instagram, Facebook, Linkedin, MessageCircle, Phone, Mail, MapPin, CheckCircle, XCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import type { SearchResult } from '../types/search-result';
import { getVerificationStatusText } from '../types/search-result';

const getRiskLevelText = (relevance_score?: number | null) => {
  const score = relevance_score ?? 0;
  if (score === 0 || score < 40) return "High Risk";
  if (score > 70) return "Low Risk";
  return "Medium Risk";
};
interface BusinessDetailsProps {
  business: SearchResult | null;
  onBack: () => void;
  backLabel?: string;
}

export function BusinessDetails({ business, onBack, backLabel = 'Go Back' }: BusinessDetailsProps) {
  if (!business) {
    return (
      <div className="p-8 bg-gray-50 dark:bg-black min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 dark:text-zinc-400 mb-4">No business selected</p>
          <Button variant="outline" onClick={onBack} className="text-gray-500 dark:text-zinc-400">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {backLabel}
          </Button>
        </div>
      </div>
    );
  }

  const category = business.types?.[0]?.replace(/_/g, ' ') || 'Local Business';
  const isVerified = business.verification_status === 'completed';
  const hasWebsite = !!business.website;

  let rawData: any = {};
  if (business.raw_data) {
    try {
      rawData = typeof business.raw_data === 'string' ? JSON.parse(business.raw_data) : business.raw_data;
    } catch (e) {
      console.error("Failed to parse raw_data", e);
    }
  }

  const socialLinksRaw: string[] = Array.isArray(rawData?.social_links) ? rawData.social_links :
    Array.isArray(business.social_links) ? business.social_links :
      Array.isArray(business.contact_info?.socials) ? business.contact_info.socials : [];

  const socialLinks = {
    instagram: socialLinksRaw.find(link => link.toLowerCase().includes('instagram.com')),
    facebook: socialLinksRaw.find(link => link.toLowerCase().includes('facebook.com')),
    twitter: socialLinksRaw.find(link => link.toLowerCase().includes('twitter.com') || link.toLowerCase().includes('x.com')),
    linkedin: socialLinksRaw.find(link => link.toLowerCase().includes('linkedin.com'))
  };

  return (
    <div className="p-8 bg-gray-50 dark:bg-black min-h-screen">
      {/* Header with Back Button */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {backLabel}
        </Button>
        <h1 className="text-gray-900 dark:text-white text-3xl mb-2">Business Details</h1>
        <p className="text-gray-500 dark:text-zinc-400">Complete AI verification information and status</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Left Side */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info Card */}
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
            <CardHeader className="border-b border-gray-200 dark:border-zinc-800">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-gray-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-zinc-500 font-bold text-2xl">{business.business_name?.[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1">
                  <CardTitle className="text-gray-900 dark:text-white text-2xl mb-2">{business.business_name}</CardTitle>
                  <p className="text-gray-500 dark:text-zinc-400 font-medium mb-1">
                    {getVerificationStatusText(business)} | {getRiskLevelText(business.relevance_score)}
                  </p>
                  <p className="text-gray-500 dark:text-zinc-400 capitalize">{category}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={
                      getVerificationStatusText(business) === "Verified"
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 h-6"
                        : getVerificationStatusText(business) === "Partially Verified"
                          ? "bg-amber-500/10 text-amber-500 border-amber-500/20 h-6"
                          : "bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border-gray-300 dark:border-zinc-700 h-6"
                    }>
                      {getVerificationStatusText(business) === "Verified" ? (
                        <CheckCircle className="w-3 h-3 mr-1" />
                      ) : (
                        <XCircle className="w-3 h-3 mr-1" />
                      )}
                      {getVerificationStatusText(business)}
                    </Badge>
                    {business.relevance_score != null ? (
                      <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                        Score: {business.relevance_score}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border-gray-300 dark:border-zinc-700">
                        Pending Score
                      </Badge>
                    )}
                    {business.verification_score != null && (
                      <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20">
                        Verification Score: {business.verification_score}
                      </Badge>
                    )}
                    {!isVerified && business.relevance_score == null && (
                      <Badge className="bg-blue-600 text-gray-900 dark:text-white border-blue-500 text-xs">
                        New
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-start gap-2 mb-4">
                <MapPin className="w-5 h-5 text-gray-500 dark:text-zinc-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700 dark:text-zinc-300">{business.address || 'Address not listed'}</span>
              </div>

              {business.relevance_reason && (
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-zinc-800">
                  <p className="text-sm text-gray-500 dark:text-zinc-400 font-semibold mb-2">AI Relevancy Reasoning</p>
                  <p className="text-sm text-gray-700 dark:text-zinc-300 leading-relaxed bg-gray-100 dark:bg-zinc-800/50 p-4 rounded-lg">
                    {business.relevance_reason}
                  </p>
                </div>
              )}
              {(business.verification_reasoning || business.verification_reason || business.evidence_summary || rawData?.evidence_summary) && (
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-zinc-800">
                  <p className="text-sm text-gray-500 dark:text-zinc-400 font-semibold mb-2">AI Verification Reasoning</p>
                  <p className="text-sm text-gray-700 dark:text-zinc-300 leading-relaxed bg-gray-100 dark:bg-zinc-800/50 p-4 rounded-lg">
                    {business.verification_reasoning || business.verification_reason || business.evidence_summary || rawData?.evidence_summary}
                  </p>
                </div>
              )}

              {/* Display AI Context used for this result */}
              {business.context_name && (
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-zinc-800">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm text-gray-500 dark:text-zinc-400 font-semibold">AI Context Applied: {business.context_name}</p>
                  </div>
                  {business.context_prompt && (
                    <p className="text-sm text-gray-700 dark:text-zinc-300 leading-relaxed bg-gray-50 dark:bg-black p-4 rounded-lg border border-gray-200 dark:border-zinc-800 font-mono text-xs whitespace-pre-wrap">
                      {business.context_prompt}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Website Check */}
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
            <CardHeader className="border-b border-gray-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
                <CardTitle className="text-gray-900 dark:text-white">Website Validation Details</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-zinc-400">Website Found</span>
                  {hasWebsite ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-zinc-500" />}
                </div>
                {hasWebsite && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-zinc-400">Domain Age</span>
                      <span className="text-gray-700 dark:text-zinc-300">
                        {rawData?.domain_age || rawData?.domain_info?.age_days ? `${rawData?.domain_age || rawData?.domain_info?.age_days} days` : 'Unknown'}
                      </span>
                    </div>
                    <div className="pt-2">
                      <a
                        href={business.website || ''}
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
          <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
            <CardHeader className="border-b border-gray-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
                <CardTitle className="text-gray-900 dark:text-white">Social Media Signatures</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-zinc-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Instagram className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
                    {socialLinks.instagram ? (
                      <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                        Instagram
                      </a>
                    ) : (
                      <span className="text-gray-700 dark:text-zinc-300">Instagram</span>
                    )}
                  </div>
                  {socialLinks.instagram ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-zinc-500" />}
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-zinc-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Facebook className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
                    {socialLinks.facebook ? (
                      <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                        Facebook
                      </a>
                    ) : (
                      <span className="text-gray-700 dark:text-zinc-300">Facebook</span>
                    )}
                  </div>
                  {socialLinks.facebook ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-zinc-500" />}
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-zinc-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
                    {socialLinks.twitter ? (
                      <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                        Twitter
                      </a>
                    ) : (
                      <span className="text-gray-700 dark:text-zinc-300">Twitter</span>
                    )}
                  </div>
                  {socialLinks.twitter ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-zinc-500" />}
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-zinc-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Linkedin className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
                    {socialLinks.linkedin ? (
                      <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                        LinkedIn
                      </a>
                    ) : (
                      <span className="text-gray-700 dark:text-zinc-300">LinkedIn</span>
                    )}
                  </div>
                  {socialLinks.linkedin ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-zinc-500" />}
                </div>
              </div>
            </CardContent>
          </Card>


        </div >

        {/* Sidebar - Right Side */}
        < div className="space-y-6" >
          {/* Contact Information */}
          < Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800" >
            <CardHeader className="border-b border-gray-200 dark:border-zinc-800">
              <CardTitle className="text-gray-900 dark:text-white">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-gray-500 dark:text-zinc-400 mt-0.5" />
                <div className="overflow-hidden min-w-0">
                  <p className="text-gray-500 dark:text-zinc-400 text-sm mb-1">Phone</p>
                  <p className="text-gray-900 dark:text-white truncate">{business.phone_number || 'Not provided'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-gray-500 dark:text-zinc-400 mt-0.5" />
                <div className="overflow-hidden min-w-0">
                  <p className="text-gray-500 dark:text-zinc-400 text-sm mb-1">Email (Scraped)</p>
                  {(() => {
                    const scrapedEmails = business.email_addresses || rawData?.emails || rawData?.contact_info?.emails || rawData?.emails_found || [];
                    if (scrapedEmails.length > 0) {
                      return scrapedEmails.map((email: string, i: number) => (
                        <p key={i} className="text-gray-900 dark:text-white truncate">{email}</p>
                      ));
                    }
                    return <p className="text-zinc-500 truncate">No emails detected</p>;
                  })()}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Globe className="w-5 h-5 text-gray-500 dark:text-zinc-400 mt-0.5" />
                <div className="overflow-hidden min-w-0">
                  <p className="text-gray-500 dark:text-zinc-400 text-sm mb-1">Website</p>
                  {hasWebsite ? (
                    <a href={business.website || ''} className="text-blue-400 hover:underline truncate block">
                      {business.website}
                    </a>
                  ) : (
                    <p className="text-zinc-500 truncate">Not available</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card >


          {/* Quick Stats */}
          < Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800" >
            <CardHeader className="border-b border-gray-200 dark:border-zinc-800">
              <CardTitle className="text-gray-900 dark:text-white">Pipeline Stats</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-zinc-400">Added Date</span>
                <span className="text-gray-900 dark:text-white">
                  {business.created_at ? new Date(business.created_at).toLocaleDateString() : 'Just now'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-zinc-400">Relevance Score</span>
                <span className="text-gray-900 dark:text-white">{business.relevance_score ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-zinc-400">Verification Score</span>
                <span className="text-gray-900 dark:text-white">{business.verification_score ?? 0}</span>
              </div>
            </CardContent>
          </Card >
        </div >
      </div >
    </div >
  );
}
