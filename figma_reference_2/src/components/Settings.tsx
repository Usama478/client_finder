import { Key, Palette, User, Users, Bell, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Label } from './ui/label';

export function Settings() {
  return (
    <div className="p-8 bg-black min-h-screen">
      <div className="mb-8">
        <h1 className="text-white text-3xl mb-2">Settings</h1>
        <p className="text-zinc-400">Manage your application preferences and configuration</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Keys */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-zinc-400" />
              <CardTitle className="text-white">API Keys</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div>
              <Label htmlFor="google-api" className="text-zinc-400 mb-2 block">Google Maps API Key</Label>
              <Input
                id="google-api"
                type="password"
                placeholder="Enter your Google Maps API key"
                className="bg-zinc-800 border-zinc-700 text-white"
                defaultValue="••••••••••••••••"
              />
            </div>
            <div>
              <Label htmlFor="instagram-api" className="text-zinc-400 mb-2 block">Instagram API Key</Label>
              <Input
                id="instagram-api"
                type="password"
                placeholder="Enter your Instagram API key"
                className="bg-zinc-800 border-zinc-700 text-white"
                defaultValue="••••••••••••••••"
              />
            </div>
            <div>
              <Label htmlFor="facebook-api" className="text-zinc-400 mb-2 block">Facebook API Key</Label>
              <Input
                id="facebook-api"
                type="password"
                placeholder="Enter your Facebook API key"
                className="bg-zinc-800 border-zinc-700 text-white"
                defaultValue="••••••••••••••••"
              />
            </div>
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              Save API Keys
            </Button>
          </CardContent>
        </Card>

        {/* Theme Options */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-zinc-400" />
              <CardTitle className="text-white">Theme Options</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white">Dark Mode</Label>
                <p className="text-zinc-400 text-sm">Use dark theme across the app</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white">High Contrast</Label>
                <p className="text-zinc-400 text-sm">Increase contrast for better visibility</p>
              </div>
              <Switch />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white">Compact Mode</Label>
                <p className="text-zinc-400 text-sm">Reduce spacing and padding</p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        {/* User Preferences */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-zinc-400" />
              <CardTitle className="text-white">User Preferences</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div>
              <Label htmlFor="results-per-page" className="text-zinc-400 mb-2 block">Results Per Page</Label>
              <Input
                id="results-per-page"
                type="number"
                className="bg-zinc-800 border-zinc-700 text-white"
                defaultValue="10"
              />
            </div>
            <div>
              <Label htmlFor="default-source" className="text-zinc-400 mb-2 block">Default Search Source</Label>
              <select
                id="default-source"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-white"
                defaultValue="google-maps"
              >
                <option value="google-maps">Google Maps</option>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="linkedin">LinkedIn</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white">Auto-validate businesses</Label>
                <p className="text-zinc-400 text-sm">Automatically run validation checks</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-zinc-400" />
              <CardTitle className="text-white">Notifications</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white">Email Notifications</Label>
                <p className="text-zinc-400 text-sm">Receive updates via email</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white">Validation Alerts</Label>
                <p className="text-zinc-400 text-sm">Notify on validation failures</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white">New Business Alerts</Label>
                <p className="text-zinc-400 text-sm">Alert when new businesses are found</p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        {/* Team Settings */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-zinc-400" />
              <CardTitle className="text-white">Team Settings</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div>
              <Label className="text-zinc-400 mb-2 block">Team Members</Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                  <div>
                    <p className="text-white">John Doe</p>
                    <p className="text-zinc-400 text-sm">john@example.com</p>
                  </div>
                  <span className="text-zinc-400 text-sm">Admin</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                  <div>
                    <p className="text-white">Jane Smith</p>
                    <p className="text-zinc-400 text-sm">jane@example.com</p>
                  </div>
                  <span className="text-zinc-400 text-sm">Member</span>
                </div>
              </div>
            </div>
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              Invite Team Member
            </Button>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-zinc-400" />
              <CardTitle className="text-white">Security</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white">Two-Factor Authentication</Label>
                <p className="text-zinc-400 text-sm">Add extra security to your account</p>
              </div>
              <Switch />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white">Session Timeout</Label>
                <p className="text-zinc-400 text-sm">Auto-logout after inactivity</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Button variant="outline" className="w-full border-zinc-700 text-white hover:bg-zinc-800">
              Change Password
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
