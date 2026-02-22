import { ArrowLeft, Globe, Shield, Instagram, Facebook, Linkedin, MessageCircle, Star, Phone, Mail, MapPin, CheckCircle, XCircle, Tag, Trash2, Edit } from 'lucide-react';
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
        <p className="text-zinc-400">No business selected</p>
      </div>
    );
  }

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
        <p className="text-zinc-400">Complete information and validation status</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Left Side */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info Card */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="border-b border-zinc-800">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0">
                  <img src={business.logo} alt={business.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-white text-2xl mb-2">{business.name}</CardTitle>
                  <p className="text-zinc-400">{business.category}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {business.verified ? (
                      <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 border-zinc-700">
                        <XCircle className="w-3 h-3 mr-1" />
                        Not Verified
                      </Badge>
                    )}
                    {business.tags.map((tag: string) => (
                      <Badge key={tag} variant="secondary" className="bg-zinc-800 text-zinc-300 border-zinc-700">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-start gap-2 mb-4">
                <MapPin className="w-5 h-5 text-zinc-400 mt-0.5 flex-shrink-0" />
                <span className="text-zinc-300">{business.address}</span>
              </div>
              <div className="bg-zinc-800 rounded-lg h-48 flex items-center justify-center">
                <span className="text-zinc-600">Google Maps Preview</span>
              </div>
            </CardContent>
          </Card>

          {/* Website Check */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-zinc-400" />
                <CardTitle className="text-white">Website Check</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Website Found</span>
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">SSL Status</span>
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-emerald-500" />
                    <span className="text-emerald-500">Secure</span>
                  </div>
                </div>
                <a
                  href="https://example.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline block"
                >
                  https://example.com
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Social Media Presence */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-zinc-400" />
                <CardTitle className="text-white">Social Media Presence</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Instagram className="w-5 h-5 text-zinc-400" />
                    <span className="text-zinc-300">Instagram</span>
                  </div>
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                </div>
                <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Facebook className="w-5 h-5 text-zinc-400" />
                    <span className="text-zinc-300">Facebook</span>
                  </div>
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                </div>
                <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-zinc-400" />
                    <span className="text-zinc-300">TikTok</span>
                  </div>
                  <XCircle className="w-5 h-5 text-zinc-500" />
                </div>
                <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Linkedin className="w-5 h-5 text-zinc-400" />
                    <span className="text-zinc-300">LinkedIn</span>
                  </div>
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reviews & Ratings */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-zinc-400" />
                <CardTitle className="text-white">Reviews & Ratings</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-6 h-6 ${
                        i < Math.floor(business.rating)
                          ? 'text-amber-500 fill-amber-500'
                          : 'text-zinc-600'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-white text-2xl">{business.rating}</span>
              </div>
              <p className="text-zinc-400">Based on 127 reviews</p>
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
                <div>
                  <p className="text-zinc-400 text-sm mb-1">Phone</p>
                  <p className="text-white">(555) 123-4567</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-zinc-400 mt-0.5" />
                <div>
                  <p className="text-zinc-400 text-sm mb-1">Email</p>
                  <p className="text-white">contact@business.com</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Globe className="w-5 h-5 text-zinc-400 mt-0.5" />
                <div>
                  <p className="text-zinc-400 text-sm mb-1">Website</p>
                  <a href="https://example.com" className="text-blue-400 hover:underline">
                    https://example.com
                  </a>
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
              <CardTitle className="text-white">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              <div className="flex justify-between">
                <span className="text-zinc-400">Added Date</span>
                <span className="text-white">{business.addedDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Last Updated</span>
                <span className="text-white">2 days ago</span>
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
