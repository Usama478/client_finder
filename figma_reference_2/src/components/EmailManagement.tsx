import { Mail, Send, Inbox, Archive, Star, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

const emails = [
  {
    id: 1,
    subject: 'Follow-up with TechStart Solutions',
    preview: 'Thank you for your interest in our services. We would like to schedule a call...',
    from: 'contact@techstart.com',
    date: '2 hours ago',
    status: 'unread',
    starred: true,
  },
  {
    id: 2,
    subject: 'Meeting confirmation - Digital Marketing Pro',
    preview: 'This is to confirm our meeting scheduled for tomorrow at 2 PM...',
    from: 'info@digitalmarketingpro.com',
    date: '5 hours ago',
    status: 'read',
    starred: false,
  },
  {
    id: 3,
    subject: 'Proposal request from Creative Studio Plus',
    preview: 'We are interested in learning more about your verification services...',
    from: 'hello@creativestudio.com',
    date: '1 day ago',
    status: 'unread',
    starred: true,
  },
  {
    id: 4,
    subject: 'Re: Business verification inquiry',
    preview: 'Following up on our previous conversation regarding the verification process...',
    from: 'support@finance-group.com',
    date: '2 days ago',
    status: 'read',
    starred: false,
  },
];

const templates = [
  { id: 1, name: 'Initial Outreach', category: 'Outreach' },
  { id: 2, name: 'Follow-up Email', category: 'Follow-up' },
  { id: 3, name: 'Meeting Request', category: 'Meeting' },
  { id: 4, name: 'Thank You Note', category: 'General' },
];

export function EmailManagement() {
  return (
    <div className="p-8 bg-black min-h-screen">
      <div className="mb-8">
        <h1 className="text-white text-3xl mb-2">Email Management</h1>
        <p className="text-zinc-400">Manage your client communications and email campaigns</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Email List */}
        <div className="lg:col-span-2 space-y-6">
          {/* Search and Actions */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input
                    placeholder="Search emails..."
                    className="pl-10 bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Send className="w-4 h-4 mr-2" />
                  Compose
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Email Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-500/10 p-2 rounded-lg">
                    <Inbox className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-zinc-400 text-sm">Inbox</p>
                    <p className="text-white text-xl">24</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-500/10 p-2 rounded-lg">
                    <Send className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-zinc-400 text-sm">Sent</p>
                    <p className="text-white text-xl">156</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-500/10 p-2 rounded-lg">
                    <Star className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-zinc-400 text-sm">Starred</p>
                    <p className="text-white text-xl">8</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Email List */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="border-b border-zinc-800">
              <CardTitle className="text-white">Recent Emails</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-zinc-800">
                {emails.map((email) => (
                  <div
                    key={email.id}
                    className={`p-4 hover:bg-zinc-800/50 cursor-pointer transition-colors ${
                      email.status === 'unread' ? 'bg-zinc-800/30' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {email.starred && (
                            <Star className="w-4 h-4 text-amber-500 fill-amber-500 flex-shrink-0" />
                          )}
                          <h3
                            className={`truncate ${
                              email.status === 'unread' ? 'text-white' : 'text-zinc-400'
                            }`}
                          >
                            {email.subject}
                          </h3>
                          {email.status === 'unread' && (
                            <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 ml-auto flex-shrink-0">
                              New
                            </Badge>
                          )}
                        </div>
                        <p className="text-zinc-500 text-sm truncate mb-1">{email.preview}</p>
                        <div className="flex items-center gap-3 text-xs text-zinc-500">
                          <span>{email.from}</span>
                          <span>•</span>
                          <span>{email.date}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="border-b border-zinc-800">
              <CardTitle className="text-white">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              <Button className="w-full bg-zinc-800 hover:bg-zinc-700 text-white justify-start">
                <Mail className="w-4 h-4 mr-2" />
                View All Emails
              </Button>
              <Button className="w-full bg-zinc-800 hover:bg-zinc-700 text-white justify-start">
                <Star className="w-4 h-4 mr-2" />
                Starred Emails
              </Button>
              <Button className="w-full bg-zinc-800 hover:bg-zinc-700 text-white justify-start">
                <Archive className="w-4 h-4 mr-2" />
                Archived
              </Button>
            </CardContent>
          </Card>

          {/* Email Templates */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="border-b border-zinc-800">
              <CardTitle className="text-white">Email Templates</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="p-3 bg-zinc-800 rounded-lg hover:bg-zinc-700 cursor-pointer transition-colors"
                  >
                    <p className="text-white text-sm mb-1">{template.name}</p>
                    <Badge variant="secondary" className="bg-zinc-700 text-zinc-300 border-0 text-xs">
                      {template.category}
                    </Badge>
                  </div>
                ))}
              </div>
              <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white">
                Create Template
              </Button>
            </CardContent>
          </Card>

          {/* Campaign Stats */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="border-b border-zinc-800">
              <CardTitle className="text-white">Campaign Stats</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-zinc-400">Open Rate</span>
                <span className="text-white">68%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Response Rate</span>
                <span className="text-white">42%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Sent This Week</span>
                <span className="text-white">156</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
