import { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Card, CardContent } from "../../components/ui/card";
import { toast } from "sonner";
import { api } from "../../../lib/api";

const cardStyle = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10 };

export default function ProfilePage() {
  const [profileId, setProfileId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [profileForm, setProfileForm] = useState({
    company_name: "", company_location: "", year_established: "",
    website: "", contact_person_name: "", contact_email: "",
    product_categories: "", specializations: "", moq: "",
    sampling_turnaround_days: "", bulk_lead_time_days: "",
    certifications: "", export_markets: "", value_proposition: "",
    production_strengths: "", services: "",
  });

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
    <div className="p-6 space-y-6 page-enter">
      <div>
        <h1 style={{ fontFamily: "Syne, sans-serif" }}>My Profile</h1>
        <p className="text-muted-foreground" style={{ fontSize: 13, marginTop: 4 }}>Manage your profile here</p>
      </div>

      <div>
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Exporter Profile
        </div>
        <Card style={cardStyle}>
          <CardContent className="space-y-4 pt-6">
            <p className="text-sm text-muted-foreground">
              This profile is used to personalise outreach emails.
              Fill in your company capabilities accurately.
            </p>
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
      </div>
    </div>
  );
}
