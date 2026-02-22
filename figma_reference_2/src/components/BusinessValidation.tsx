import { CheckCircle, XCircle, Globe, Shield, Instagram, Facebook, Linkedin, MessageCircle, Star } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

const validatedBusinesses = [
  {
    id: 1,
    name: 'Innovative Tech Solutions',
    category: 'Software Development',
    address: '100 Innovation Dr, Seattle, WA 98101',
    website: { present: true, url: 'https://innovativetech.com', ssl: true },
    socialMedia: {
      instagram: true,
      facebook: true,
      linkedin: true,
      tiktok: false,
    },
    reviews: { available: true, count: 127, rating: 4.8 },
  },
  {
    id: 2,
    name: 'NextGen Marketing',
    category: 'Digital Marketing',
    address: '250 Marketing Plaza, Austin, TX 78701',
    website: { present: true, url: 'https://nextgenmarketing.com', ssl: true },
    socialMedia: {
      instagram: true,
      facebook: true,
      linkedin: true,
      tiktok: true,
    },
    reviews: { available: true, count: 89, rating: 4.6 },
  },
  {
    id: 3,
    name: 'DataDrive Analytics',
    category: 'Data Science',
    address: '300 Analytics Blvd, San Jose, CA 95113',
    website: { present: true, url: 'https://datadriveanalytics.com', ssl: false },
    socialMedia: {
      instagram: false,
      facebook: true,
      linkedin: true,
      tiktok: false,
    },
    reviews: { available: true, count: 45, rating: 4.3 },
  },
  {
    id: 4,
    name: 'Mobile App Masters',
    category: 'Mobile Development',
    address: '450 App Street, Miami, FL 33131',
    website: { present: false, url: '', ssl: false },
    socialMedia: {
      instagram: true,
      facebook: false,
      linkedin: true,
      tiktok: false,
    },
    reviews: { available: false, count: 0, rating: 0 },
  },
];

export function BusinessValidation() {
  const StatusIcon = ({ passed }: { passed: boolean }) => (
    passed ? (
      <CheckCircle className="w-5 h-5 text-emerald-500" />
    ) : (
      <XCircle className="w-5 h-5 text-red-500" />
    )
  );

  return (
    <div className="p-8 bg-black min-h-screen">
      <div className="mb-8">
        <h1 className="text-white text-3xl mb-2">Business Validation</h1>
        <p className="text-zinc-400">Comprehensive validation checks for each business</p>
      </div>

      <div className="space-y-6">
        {validatedBusinesses.map((business) => (
          <Card key={business.id} className="bg-zinc-900 border-zinc-800">
            <CardHeader className="border-b border-zinc-800">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-white text-xl mb-2">{business.name}</CardTitle>
                  <p className="text-zinc-400">{business.category}</p>
                  <p className="text-zinc-500 text-sm mt-1">{business.address}</p>
                </div>
                <div className="w-32 h-24 bg-zinc-800 rounded-lg flex items-center justify-center">
                  <span className="text-zinc-600 text-sm">Map Preview</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Website Check */}
                <div className="bg-zinc-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Globe className="w-5 h-5 text-zinc-400" />
                    <span className="text-white">Website Presence</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400 text-sm">Website Found</span>
                      <StatusIcon passed={business.website.present} />
                    </div>
                    {business.website.present && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400 text-sm">SSL Certificate</span>
                          <StatusIcon passed={business.website.ssl} />
                        </div>
                        <a href={business.website.url} className="text-blue-400 text-sm hover:underline block">
                          {business.website.url}
                        </a>
                      </>
                    )}
                  </div>
                </div>

                {/* Social Media */}
                <div className="bg-zinc-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageCircle className="w-5 h-5 text-zinc-400" />
                    <span className="text-white">Social Media Presence</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Instagram className="w-4 h-4 text-zinc-400" />
                        <span className="text-zinc-400 text-sm">Instagram</span>
                      </div>
                      <StatusIcon passed={business.socialMedia.instagram} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Facebook className="w-4 h-4 text-zinc-400" />
                        <span className="text-zinc-400 text-sm">Facebook</span>
                      </div>
                      <StatusIcon passed={business.socialMedia.facebook} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Linkedin className="w-4 h-4 text-zinc-400" />
                        <span className="text-zinc-400 text-sm">LinkedIn</span>
                      </div>
                      <StatusIcon passed={business.socialMedia.linkedin} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-zinc-400" />
                        <span className="text-zinc-400 text-sm">TikTok</span>
                      </div>
                      <StatusIcon passed={business.socialMedia.tiktok} />
                    </div>
                  </div>
                </div>

                {/* Reviews */}
                <div className="bg-zinc-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="w-5 h-5 text-zinc-400" />
                    <span className="text-white">Reviews & Ratings</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400 text-sm">Reviews Available</span>
                      <StatusIcon passed={business.reviews.available} />
                    </div>
                    {business.reviews.available && (
                      <>
                        <div className="flex items-center gap-1 mt-2">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < Math.floor(business.reviews.rating)
                                  ? 'text-amber-500 fill-amber-500'
                                  : 'text-zinc-600'
                              }`}
                            />
                          ))}
                          <span className="text-white ml-2">{business.reviews.rating}</span>
                        </div>
                        <p className="text-zinc-400 text-sm">{business.reviews.count} reviews</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Overall Status */}
                <div className="bg-zinc-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-5 h-5 text-zinc-400" />
                    <span className="text-white">Validation Status</span>
                  </div>
                  <div className="space-y-2">
                    {business.website.present && business.website.ssl && business.reviews.available ? (
                      <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Fully Validated
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                        Partial Validation
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                Add to Client List
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
