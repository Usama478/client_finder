export interface Business {
  id: string;
  name: string;
  category: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  verificationStatus: 'verified' | 'partially-verified' | 'not-verified';
  riskScore: 'low' | 'medium' | 'high';
  rating: number;
  reviewCount: number;
  website?: string;
  sslStatus?: 'valid' | 'invalid' | 'none';
  activityScore: number;
  uptime?: number;
  socialMedia: {
    platform: string;
    followers: number;
    lastActive: string;
    verified: boolean;
  }[];
  phone?: string;
  email?: string;
  mismatchWarning?: boolean;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

export const mockBusinesses: Business[] = [
  {
    id: '1',
    name: 'Apex Technologies Inc.',
    category: 'Technology',
    address: '1234 Market St, San Francisco, CA 94103',
    location: { lat: 37.7749, lng: -122.4194 },
    verificationStatus: 'verified',
    riskScore: 'low',
    rating: 4.8,
    reviewCount: 342,
    website: 'https://apextech.example.com',
    sslStatus: 'valid',
    activityScore: 95,
    uptime: 99.9,
    socialMedia: [
      { platform: 'LinkedIn', followers: 12500, lastActive: '2h ago', verified: true },
      { platform: 'Facebook', followers: 8200, lastActive: '1d ago', verified: true },
      { platform: 'Instagram', followers: 5600, lastActive: '5h ago', verified: false },
      { platform: 'TikTok', followers: 2100, lastActive: '3d ago', verified: false },
    ],
    phone: '+1 (415) 555-0123',
    email: 'contact@apextech.example.com',
    mismatchWarning: false,
    sentiment: { positive: 78, neutral: 18, negative: 4 }
  },
  {
    id: '2',
    name: 'Urban Coffee Roasters',
    category: 'Food & Beverage',
    address: '567 Valencia St, San Francisco, CA 94110',
    location: { lat: 37.7599, lng: -122.4214 },
    verificationStatus: 'partially-verified',
    riskScore: 'medium',
    rating: 4.3,
    reviewCount: 128,
    website: 'https://urbancoffee.example.com',
    sslStatus: 'valid',
    activityScore: 72,
    uptime: 98.5,
    socialMedia: [
      { platform: 'Instagram', followers: 15200, lastActive: '1h ago', verified: true },
      { platform: 'Facebook', followers: 6800, lastActive: '2d ago', verified: false },
      { platform: 'TikTok', followers: 3400, lastActive: '1d ago', verified: true },
    ],
    phone: '+1 (415) 555-0456',
    email: 'hello@urbancoffee.example.com',
    mismatchWarning: true,
    sentiment: { positive: 65, neutral: 25, negative: 10 }
  },
  {
    id: '3',
    name: 'Pacific Design Studio',
    category: 'Design & Creative',
    address: '890 Mission St, San Francisco, CA 94103',
    location: { lat: 37.7831, lng: -122.4039 },
    verificationStatus: 'verified',
    riskScore: 'low',
    rating: 4.9,
    reviewCount: 89,
    website: 'https://pacificdesign.example.com',
    sslStatus: 'valid',
    activityScore: 88,
    uptime: 99.8,
    socialMedia: [
      { platform: 'Instagram', followers: 28300, lastActive: '30m ago', verified: true },
      { platform: 'LinkedIn', followers: 4200, lastActive: '6h ago', verified: true },
      { platform: 'Facebook', followers: 3100, lastActive: '1d ago', verified: false },
    ],
    phone: '+1 (415) 555-0789',
    email: 'studio@pacificdesign.example.com',
    mismatchWarning: false,
    sentiment: { positive: 85, neutral: 12, negative: 3 }
  },
  {
    id: '4',
    name: 'GlobalTrade Solutions',
    category: 'Logistics',
    address: '2345 3rd St, San Francisco, CA 94107',
    location: { lat: 37.7745, lng: -122.3892 },
    verificationStatus: 'not-verified',
    riskScore: 'high',
    rating: 3.2,
    reviewCount: 45,
    website: 'http://globaltrade.example.com',
    sslStatus: 'invalid',
    activityScore: 42,
    uptime: 94.2,
    socialMedia: [
      { platform: 'LinkedIn', followers: 1200, lastActive: '2w ago', verified: false },
      { platform: 'Facebook', followers: 890, lastActive: '1w ago', verified: false },
    ],
    phone: '+1 (415) 555-0321',
    mismatchWarning: true,
    sentiment: { positive: 45, neutral: 35, negative: 20 }
  },
  {
    id: '5',
    name: 'Wellness Medical Group',
    category: 'Healthcare',
    address: '456 Castro St, San Francisco, CA 94114',
    location: { lat: 37.7609, lng: -122.4350 },
    verificationStatus: 'verified',
    riskScore: 'low',
    rating: 4.7,
    reviewCount: 234,
    website: 'https://wellnessmedical.example.com',
    sslStatus: 'valid',
    activityScore: 91,
    uptime: 99.9,
    socialMedia: [
      { platform: 'LinkedIn', followers: 8900, lastActive: '3h ago', verified: true },
      { platform: 'Facebook', followers: 12400, lastActive: '2h ago', verified: true },
      { platform: 'Instagram', followers: 6700, lastActive: '4h ago', verified: true },
    ],
    phone: '+1 (415) 555-0654',
    email: 'info@wellnessmedical.example.com',
    mismatchWarning: false,
    sentiment: { positive: 82, neutral: 15, negative: 3 }
  },
  {
    id: '6',
    name: 'NextGen Marketing',
    category: 'Marketing',
    address: '789 Howard St, San Francisco, CA 94103',
    location: { lat: 37.7858, lng: -122.3964 },
    verificationStatus: 'partially-verified',
    riskScore: 'medium',
    rating: 4.1,
    reviewCount: 67,
    website: 'https://nextgenmarketing.example.com',
    sslStatus: 'valid',
    activityScore: 68,
    uptime: 97.8,
    socialMedia: [
      { platform: 'Instagram', followers: 9800, lastActive: '2h ago', verified: false },
      { platform: 'LinkedIn', followers: 5600, lastActive: '1d ago', verified: true },
      { platform: 'TikTok', followers: 4200, lastActive: '8h ago', verified: false },
      { platform: 'Facebook', followers: 3900, lastActive: '3d ago', verified: false },
    ],
    phone: '+1 (415) 555-0987',
    email: 'team@nextgenmarketing.example.com',
    mismatchWarning: false,
    sentiment: { positive: 70, neutral: 22, negative: 8 }
  }
];

export interface RecentSearch {
  id: string;
  query: string;
  timestamp: string;
  resultsCount: number;
}

export const recentSearches: RecentSearch[] = [
  { id: '1', query: 'Technology companies in SF', timestamp: '2 hours ago', resultsCount: 45 },
  { id: '2', query: 'Healthcare providers', timestamp: '5 hours ago', resultsCount: 23 },
  { id: '3', query: 'Verified marketing agencies', timestamp: '1 day ago', resultsCount: 18 },
  { id: '4', query: 'Food & beverage with high ratings', timestamp: '1 day ago', resultsCount: 34 },
  { id: '5', query: 'Design studios', timestamp: '2 days ago', resultsCount: 12 },
];

export interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  description: string;
  timestamp: string;
}

export const alerts: Alert[] = [
  {
    id: '1',
    type: 'warning',
    title: 'Mismatched Address Detected',
    description: 'Urban Coffee Roasters has inconsistent address data across platforms',
    timestamp: '1 hour ago'
  },
  {
    id: '2',
    type: 'error',
    title: 'Invalid SSL Certificate',
    description: 'GlobalTrade Solutions website has an invalid SSL certificate',
    timestamp: '3 hours ago'
  },
  {
    id: '3',
    type: 'warning',
    title: 'Inactive Social Media',
    description: 'GlobalTrade Solutions has not posted on LinkedIn in 2 weeks',
    timestamp: '5 hours ago'
  },
  {
    id: '4',
    type: 'info',
    title: 'New Verification Complete',
    description: 'Pacific Design Studio has been successfully verified',
    timestamp: '1 day ago'
  },
  {
    id: '5',
    type: 'warning',
    title: 'Low Activity Score',
    description: 'GlobalTrade Solutions has an activity score below 50%',
    timestamp: '1 day ago'
  }
];
