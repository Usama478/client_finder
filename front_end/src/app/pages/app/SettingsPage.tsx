import { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Switch } from "../../components/ui/switch";
import { toast } from "sonner";
import { useAuth } from "../../../lib/auth-context";
import { api } from "../../../lib/api";

export default function SettingsPage() {
  const { user, refreshUser, theme, toggleTheme } = useAuth();
  const [profileData, setProfileData] = useState<any>(null);
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [emailNotifications, setEmailNotifications] = useState(true);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
    }
  }, [user]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="email">Email Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Current Password</Label>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Confirm New Password</Label>
                  <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </div>
              </div>
              <Button onClick={async () => {
                try {
                  if (newPassword && newPassword !== confirmPassword) {
                    toast.error("Passwords do not match");
                    return;
                  }
                  const payload: any = { name, email };
                  if (currentPassword) payload.current_password = currentPassword;
                  if (newPassword) payload.new_password = newPassword;
                  await api.updateProfile(payload);
                  await refreshUser();
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  toast.success("Profile updated");
                } catch (err: any) {
                  toast.error(err.message || "Failed to update profile");
                }
              }}>Save Changes</Button>
            </CardContent>
          </Card>

          <div style={{ 
            background: "var(--card)", 
            border: "1px solid var(--border)", 
            borderRadius: 10, 
            padding: 20,
            marginBottom: 16
          }}>
            <div style={{ 
              fontSize: 13, 
              fontWeight: 600, 
              color: "var(--foreground)",
              marginBottom: 4
            }}>
              Appearance
            </div>
            <div style={{ 
              fontSize: 12, 
              color: "var(--muted-foreground)",
              marginBottom: 16
            }}>
              Choose between dark and light mode
            </div>
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                🌙 Dark
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  toggleTheme();
                }}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  border: "none",
                  cursor: "pointer",
                  position: "relative",
                  background: theme === "light" ? "var(--primary)" : "var(--accent)",
                  transition: "background 0.2s"
                }}>
                <div style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "white",
                  position: "absolute",
                  top: 3,
                  left: theme === "light" ? 23 : 3,
                  transition: "left 0.2s"
                }} />
              </button>
              <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                ☀️ Light
              </span>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Email Notifications</div>
                  <div className="text-sm text-muted-foreground">Receive email updates about your activity</div>
                </div>
                <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Search Completion</div>
                  <div className="text-sm text-muted-foreground">Notify when searches complete</div>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Verification Results</div>
                  <div className="text-sm text-muted-foreground">Notify when verification finishes</div>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle>Email Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Sender Name</Label>
                <Input defaultValue="John Doe" />
              </div>
              <div className="space-y-2">
                <Label>Email Signature</Label>
                <Textarea defaultValue="Best regards,&#10;John Doe&#10;My Company Inc." />
              </div>
              <Button onClick={() => toast.success("Email settings updated")}>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
