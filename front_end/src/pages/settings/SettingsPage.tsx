import { useState } from "react";
import { Link } from "react-router-dom";
import { BellRing, Building2, Mail, Moon, Palette, Sun, UserCircle2 } from "lucide-react";

import { useTheme } from "../../app/theme";
import { PageHeader } from "../../components/page/PageHeader";
import { StatusNotice } from "../../components/page/StatusNotice";
import { StatCard } from "../../components/StatCard";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";

interface SettingsState {
  profile: {
    fullName: string;
    email: string;
    role: string;
    timezone: string;
  };
  workspace: {
    name: string;
    website: string;
    industry: string;
    region: string;
  };
  notifications: {
    agentRuns: boolean;
    clientChanges: boolean;
    productUpdates: boolean;
    weeklyDigest: boolean;
  };
}

const SETTINGS_STORAGE_KEY = "client-finder-settings";

const defaultSettingsState: SettingsState = {
  profile: {
    fullName: "Usama Khan",
    email: "usama@clientfinder.app",
    role: "Growth Operations",
    timezone: "Asia/Karachi",
  },
  workspace: {
    name: "Client Finder",
    website: "https://clientfinder.app",
    industry: "Lead generation",
    region: "United States",
  },
  notifications: {
    agentRuns: true,
    clientChanges: true,
    productUpdates: false,
    weeklyDigest: true,
  },
};

const loadSettingsState = (): SettingsState => {
  if (typeof window === "undefined") {
    return defaultSettingsState;
  }

  try {
    const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!stored) {
      return defaultSettingsState;
    }

    const parsed = JSON.parse(stored) as Partial<SettingsState>;
    return {
      profile: {
        ...defaultSettingsState.profile,
        ...parsed.profile,
      },
      workspace: {
        ...defaultSettingsState.workspace,
        ...parsed.workspace,
      },
      notifications: {
        ...defaultSettingsState.notifications,
        ...parsed.notifications,
      },
    };
  } catch {
    return defaultSettingsState;
  }
};

const saveSettingsState = (state: SettingsState) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(state));
};

export function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState>(loadSettingsState);
  const [savedSection, setSavedSection] = useState<string | null>(null);
  const { themeMode, setThemeMode } = useTheme();

  const handleSaveSection = (section: keyof SettingsState) => {
    saveSettingsState(settings);
    setSavedSection(section);
  };

  const notificationChannelsEnabled = Object.values(settings.notifications).filter(Boolean).length;

  return (
    <div className="mx-auto max-w-7xl p-8">
      <PageHeader
        title="Settings"
        description="Manage the preferences that make Client Finder feel like a real workspace while backend account services are still catching up."
        actions={(
          <Button variant="outline" asChild>
            <Link to="/login">Preview auth flow</Link>
          </Button>
        )}
      />

      <StatusNotice
        className="mb-8"
        title="Preferences are safe to use today"
        description="Profile, workspace, and notification changes save locally in this browser for now. Theme changes are live across the app."
      />

      <div className="mb-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Profile owner"
          value={settings.profile.fullName}
          subtitle={settings.profile.role}
          icon={<UserCircle2 className="h-6 w-6 text-gray-500 dark:text-zinc-400" />}
        />
        <StatCard
          title="Workspace"
          value={settings.workspace.name}
          subtitle={settings.workspace.region}
          icon={<Building2 className="h-6 w-6 text-gray-500 dark:text-zinc-400" />}
        />
        <StatCard
          title="Theme"
          value={themeMode === "dark" ? "Dark mode" : "Light mode"}
          subtitle="Applied immediately"
          icon={<Palette className="h-6 w-6 text-gray-500 dark:text-zinc-400" />}
        />
        <StatCard
          title="Notification channels"
          value={notificationChannelsEnabled.toString()}
          subtitle="Enabled delivery preferences"
          icon={<BellRing className="h-6 w-6 text-gray-500 dark:text-zinc-400" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                    Full name
                  </label>
                  <Input
                    value={settings.profile.fullName}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        profile: { ...current.profile, fullName: event.target.value },
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                    Role
                  </label>
                  <Input
                    value={settings.profile.role}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        profile: { ...current.profile, role: event.target.value },
                      }))
                    }
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                    Email
                  </label>
                  <Input
                    type="email"
                    value={settings.profile.email}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        profile: { ...current.profile, email: event.target.value },
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                    Timezone
                  </label>
                  <Select
                    value={settings.profile.timezone}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        profile: { ...current.profile, timezone: event.target.value },
                      }))
                    }
                  >
                    <option value="Asia/Karachi">Asia/Karachi</option>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="America/Los_Angeles">America/Los_Angeles</option>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-gray-500 dark:text-zinc-400">
                  Keep your operator profile up to date for future workspace invites and audit trails.
                </p>
                <Button onClick={() => handleSaveSection("profile")}>Save profile</Button>
              </div>
              {savedSection === "profile" ? (
                <StatusNotice
                  tone="success"
                  title="Profile saved locally"
                  description="These changes are stored in-browser until the account API is ready."
                />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Workspace</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                    Workspace name
                  </label>
                  <Input
                    value={settings.workspace.name}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        workspace: { ...current.workspace, name: event.target.value },
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                    Website
                  </label>
                  <Input
                    value={settings.workspace.website}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        workspace: { ...current.workspace, website: event.target.value },
                      }))
                    }
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                    Industry focus
                  </label>
                  <Input
                    value={settings.workspace.industry}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        workspace: { ...current.workspace, industry: event.target.value },
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                    Primary market
                  </label>
                  <Select
                    value={settings.workspace.region}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        workspace: { ...current.workspace, region: event.target.value },
                      }))
                    }
                  >
                    <option value="United States">United States</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="Middle East">Middle East</option>
                    <option value="Global">Global</option>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-gray-500 dark:text-zinc-400">
                  Workspace metadata will later feed team invites, billing, and default search presets.
                </p>
                <Button onClick={() => handleSaveSection("workspace")}>Save workspace</Button>
              </div>
              {savedSection === "workspace" ? (
                <StatusNotice
                  tone="success"
                  title="Workspace settings saved"
                  description="Stored locally for this migration phase."
                />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  key: "agentRuns",
                  label: "Agent completion alerts",
                  description: "Know when relevancy or verification runs finish.",
                },
                {
                  key: "clientChanges",
                  label: "Saved client changes",
                  description: "Stay aware when records move deeper into the pipeline.",
                },
                {
                  key: "productUpdates",
                  label: "Product updates",
                  description: "Hear about new SaaS surfaces during the migration.",
                },
                {
                  key: "weeklyDigest",
                  label: "Weekly digest",
                  description: "Receive a summary of pipeline activity and usage.",
                },
              ].map((option) => (
                <label
                  key={option.key}
                  className="flex items-start justify-between gap-4 rounded-2xl border border-gray-200 px-4 py-3 dark:border-zinc-800"
                >
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{option.label}</div>
                    <div className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
                      {option.description}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications[option.key as keyof SettingsState["notifications"]]}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        notifications: {
                          ...current.notifications,
                          [option.key]: event.target.checked,
                        },
                      }))
                    }
                    className="mt-1 h-4 w-4 rounded border-gray-300"
                  />
                </label>
              ))}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
                  <Mail className="h-4 w-4" />
                  Email delivery will be connected in a later phase.
                </div>
                <Button onClick={() => handleSaveSection("notifications")}>
                  Save notifications
                </Button>
              </div>
              {savedSection === "notifications" ? (
                <StatusNotice
                  tone="success"
                  title="Notification preferences saved"
                  description="Channels are stored locally and ready for backend notification wiring later."
                />
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Theme</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setThemeMode("light")}
                  className={`rounded-2xl border p-4 text-left transition ${
                    themeMode === "light"
                      ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30"
                      : "border-gray-200 dark:border-zinc-800"
                  }`}
                >
                  <div className="mb-3 flex items-center gap-2 text-gray-900 dark:text-white">
                    <Sun className="h-4 w-4" />
                    Light
                  </div>
                  <div className="text-sm text-gray-500 dark:text-zinc-400">
                    Brighter canvas for daytime prospecting.
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode("dark")}
                  className={`rounded-2xl border p-4 text-left transition ${
                    themeMode === "dark"
                      ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30"
                      : "border-gray-200 dark:border-zinc-800"
                  }`}
                >
                  <div className="mb-3 flex items-center gap-2 text-gray-900 dark:text-white">
                    <Moon className="h-4 w-4" />
                    Dark
                  </div>
                  <div className="text-sm text-gray-500 dark:text-zinc-400">
                    Lower-glare mode for focused workflow review.
                  </div>
                </button>
              </div>
              <StatusNotice
                title="Theme updates are live"
                description="Unlike the other settings sections, this preference applies immediately across the routed app shell."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Access & security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-4 text-sm text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
                Password changes, SSO, invite management, and audit logs are intentionally deferred until the account backend is ready.
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button variant="outline" asChild>
                  <Link to="/login">View login</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/forgot-password">View recovery</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
