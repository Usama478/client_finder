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
  const [profileId, setProfileId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [profileForm, setProfileForm] = useState({
    company_name: "", company_location: "", year_established: "",
    website: "", contact_person_name: "", contact_email: "",
    product_categories: "", specializations: "", moq: "",
    sampling_turnaround_days: "", bulk_lead_time_days: "",
    certifications: "", export_markets: "", value_proposition: "",
    production_strengths: "", services: "",
  });

  const [emailNotifications, setEmailNotifications] = useState(true);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
    }
  }, [user]);

  useEffect(() => {
    api.getMyProfile()
      .then(p => {
        if (p) {
          setProfileId(p.id);
          setProfileForm({
            company_name: p.company_name || "",
            company_location: p.company_location || "",
            year_established: p.year_established || "",
            website: p.website || "",
            contact_person_name: p.contact_person_name || "",
            contact_email: p.contact_email || "",
            product_categories: (p.product_categories || []).join(", "),
            specializations: (p.specializations || []).join(", "),
            moq: p.moq || "",
            sampling_turnaround_days: p.sampling_turnaround_days || "",
            bulk_lead_time_days: p.bulk_lead_time_days || "",
            certifications: (p.certifications || []).join(", "),
            export_markets: (p.export_markets || []).join(", "),
            value_proposition: p.value_proposition || "",
            production_strengths: (p.production_strengths || []).join(", "),
            services: (p.services || []).join(", "),
          });
        }
      })
      .catch(console.error);
  }, []);

  const handleSaveExporterProfile = async () => {
    setSaving(true);
    try {
      const data = {
        ...profileForm,
        year_established: profileForm.year_established ? Number(profileForm.year_established) : null,
        moq: profileForm.moq ? Number(profileForm.moq) : null,
        sampling_turnaround_days: profileForm.sampling_turnaround_days ? Number(profileForm.sampling_turnaround_days) : null,
        bulk_lead_time_days: profileForm.bulk_lead_time_days ? Number(profileForm.bulk_lead_time_days) : null,
        product_categories: profileForm.product_categories.split(",").map(s => s.trim()).filter(Boolean),
        specializations: profileForm.specializations.split(",").map(s => s.trim()).filter(Boolean),
        certifications: profileForm.certifications.split(",").map(s => s.trim()).filter(Boolean),
        export_markets: profileForm.export_markets.split(",").map(s => s.trim()).filter(Boolean),
        production_strengths: profileForm.production_strengths.split(",").map(s => s.trim()).filter(Boolean),
        services: profileForm.services.split(",").map(s => s.trim()).filter(Boolean),
        profile_name: "Default",
        is_default: true,
      };
      if (profileId) {
        await api.updateProfile2(profileId, data);
      } else {
        const created = await api.createProfile(data);
        setProfileId(created.id);
      }
      toast.success("Exporter profile saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your account and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
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

        <TabsContent value="workspace">
          <Card>
            <CardHeader>
              <CardTitle>Exporter Profile</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                This profile is used to personalise outreach emails.
                Fill in your company capabilities accurately.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company Name *</Label>
                  <Input value={profileForm.company_name}
                    onChange={e => setProfileForm(p => ({...p, company_name: e.target.value}))}
                    placeholder="e.g. Crescent Apparel Manufacturing" />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input value={profileForm.company_location}
                    onChange={e => setProfileForm(p => ({...p, company_location: e.target.value}))}
                    placeholder="e.g. Lahore, Pakistan" />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Contact Person Name</Label>
                  <Input value={profileForm.contact_person_name}
                    onChange={e => setProfileForm(p => ({...p, contact_person_name: e.target.value}))} />
                </div>
                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input value={profileForm.contact_email}
                    onChange={e => setProfileForm(p => ({...p, contact_email: e.target.value}))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Product Categories (comma separated)</Label>
                <Input value={profileForm.product_categories}
                  onChange={e => setProfileForm(p => ({...p, product_categories: e.target.value}))}
                  placeholder="Denim, Knitwear, Woven Garments" />
              </div>
              <div className="space-y-2">
                <Label>Specializations (comma separated)</Label>
                <Input value={profileForm.specializations}
                  onChange={e => setProfileForm(p => ({...p, specializations: e.target.value}))}
                  placeholder="Washed denim, Enzyme wash, Screen printing" />
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>MOQ (pieces)</Label>
                  <Input type="number" value={profileForm.moq}
                    onChange={e => setProfileForm(p => ({...p, moq: e.target.value}))}
                    placeholder="250" />
                </div>
                <div className="space-y-2">
                  <Label>Sampling (days)</Label>
                  <Input type="number" value={profileForm.sampling_turnaround_days}
                    onChange={e => setProfileForm(p => ({...p, sampling_turnaround_days: e.target.value}))}
                    placeholder="7" />
                </div>
                <div className="space-y-2">
                  <Label>Bulk Lead Time (days)</Label>
                  <Input type="number" value={profileForm.bulk_lead_time_days}
                    onChange={e => setProfileForm(p => ({...p, bulk_lead_time_days: e.target.value}))}
                    placeholder="35" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Certifications (comma separated)</Label>
                <Input value={profileForm.certifications}
                  onChange={e => setProfileForm(p => ({...p, certifications: e.target.value}))}
                  placeholder="BSCI, SEDEX, OEKO-TEX, GOTS" />
              </div>
              <div className="space-y-2">
                <Label>Export Markets (comma separated)</Label>
                <Input value={profileForm.export_markets}
                  onChange={e => setProfileForm(p => ({...p, export_markets: e.target.value}))}
                  placeholder="UK, Germany, Australia, Netherlands" />
              </div>
              <div className="space-y-2">
                <Label>Value Proposition</Label>
                <Textarea value={profileForm.value_proposition}
                  onChange={e => setProfileForm(p => ({...p, value_proposition: e.target.value}))}
                  placeholder="What makes your company the right partner? Focus on MOQ flexibility, certifications, speed..." />
              </div>
              <Button onClick={handleSaveExporterProfile} disabled={saving}>
                {saving ? "Saving..." : "Save Exporter Profile"}
              </Button>
            </CardContent>
          </Card>
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
                  <div className="text-sm text-gray-600">Receive email updates about your activity</div>
                </div>
                <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Search Completion</div>
                  <div className="text-sm text-gray-600">Notify when searches complete</div>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Verification Results</div>
                  <div className="text-sm text-gray-600">Notify when verification finishes</div>
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
