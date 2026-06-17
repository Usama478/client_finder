import { Outlet, Link, useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard, Search, LayoutList, Users, UserCircle, Activity, Mail,
  FileText, CreditCard, Settings, Menu, X, ChevronLeft,
  Zap, Key, Gauge, ArrowLeft, LogOut
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Badge } from "../components/ui/badge";
import { useState, useEffect } from "react";
import { useAuth } from "../../lib/auth-context";
import { api } from "../../lib/api";

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  const [credits, setCredits] = useState<{
    credits_remaining: number;
    allocated_total: number;
    low_credits: boolean;
    empty: boolean;
  } | null>(null)

  useEffect(() => {
    api.credits().then(setCredits).catch(() => {})
  }, [])

  useEffect(() => {
    const done = localStorage.getItem("cf_onboarding_done")
    if (done === "true") return
    api.getMyProfile().then((profile) => {
      if (!profile) {
        navigate("/onboarding")
      }
    }).catch(() => {})
  }, [])

  const userInitials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";
  const userName = user?.name || "User";

  const isActive = (path: string) =>
    path === "/app" ? location.pathname === "/app" : location.pathname.startsWith(path);

  const navItems = [
    { icon: Search, label: "Search", path: "/app/simple-search", badge: null },
    { icon: LayoutDashboard, label: "Dashboard", path: "/app", badge: null },
    { icon: Search, label: "Advanced Search", path: "/app/search", badge: null },
    { icon: LayoutList, label: "Leads Hub", path: "/app/leads", badge: null },
    { icon: Zap, label: "Campaign Engine", path: "/app/campaigns", badge: null },
    { icon: Users, label: "Clients", path: "/app/clients", badge: null, badgeGreen: false },
    { icon: UserCircle, label: "Contacts", path: "/app/contacts", badge: null },
    { icon: Activity, label: "Activity", path: "/app/activity", badge: null },
    { icon: Mail, label: "Email Workspace", path: "/app/email", badge: null },
    { icon: FileText, label: "AI Contexts", path: "/app/contexts", badge: null },
  ];

  const accountItems = [
    { icon: CreditCard, label: "Billing", path: "/app/billing" },
    { icon: Settings, label: "Settings", path: "/app/settings" },
  ];

  const adminNavItems = [
    { icon: LayoutDashboard, label: "Admin Dashboard", path: "/app/admin", badge: null },
    { icon: Users, label: "User Management", path: "/app/admin/users", badge: null },
    { icon: Key, label: "API Keys", path: "/app/admin/api-keys", badge: null },
    { icon: Gauge, label: "Thresholds", path: "/app/admin/thresholds", badge: null },
  ];

  const isAdminRoute = location.pathname.startsWith("/app/admin");
  const showAdminNav = isAdminRoute && user?.is_admin;

  const pageTitles: Record<string, { title: string; sub: string }> = {
    "/app": { title: "Dashboard", sub: "Overview & pipeline" },
    "/app/simple-search": { title: "Search", sub: "Find international buyers instantly" },
    "/app/search": { title: "Advanced Search", sub: "Discover → Score → Verify → Decide" },
    "/app/leads": { title: "Leads Hub", sub: "All discovered leads across every search session" },
    "/app/clients": { title: "Clients", sub: "Saved & verified lead database" },
    "/app/contacts": { title: "Contacts", sub: "Contact directory" },
    "/app/activity": { title: "Activity", sub: "Operational timeline" },
    "/app/email": { title: "Email Workspace", sub: "Outreach generation & analytics" },
    "/app/contexts": { title: "AI Contexts", sub: "Relevance configuration" },
    "/app/campaigns": { title: "Campaign Engine", sub: "Automated discovery → relevance → verification" },
    "/app/billing": { title: "Billing", sub: "Plan & usage" },
    "/app/settings": { title: "Settings", sub: "Profile & preferences" },
    "/app/admin": { title: "Admin Panel", sub: "Platform management" },
    "/app/admin/users": { title: "User Management", sub: "Manage platform users" },
    "/app/admin/api-keys": { title: "API Keys", sub: "System API key configuration" },
    "/app/admin/thresholds": { title: "Thresholds", sub: "Configure system thresholds" },
  };

  const currentPath = Object.keys(pageTitles).find(k =>
    k === "/app" ? location.pathname === "/app" : location.pathname.startsWith(k)
  ) || "/app";
  const pageInfo = pageTitles[currentPath] || { title: "Client Finder", sub: "" };

  const NavItem = ({ item, mobile = false }: { item: typeof navItems[0]; mobile?: boolean }) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    return (
      <Link key={item.path} to={item.path} onClick={() => mobile && setMobileMenuOpen(false)}>
        <div className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 relative
          ${active
            ? "bg-primary/10 text-primary font-medium border border-primary/20"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"}
          ${!sidebarOpen && !mobile ? "justify-center px-2" : ""}`}>
          <Icon className="h-4 w-4 flex-shrink-0" />
          {(sidebarOpen || mobile) && <span className="flex-1 font-bold text-foreground">{item.label}</span>}
          {(sidebarOpen || mobile) && item.badge && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.badgeGreen ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-primary/20 text-primary"}`}>
              {item.badge}
            </span>
          )}
        </div>
      </Link>
    );
  };

  return (
    <div className="flex h-screen" >
      {/* Desktop Sidebar */}
      <aside className={`${sidebarOpen ? "w-56" : "w-14"} hidden md:flex flex-col transition-all duration-300 border-r bg-card`}>
        {/* Logo */}
        <div className="h-14 flex items-center justify-between px-3 border-b border-border">
          {sidebarOpen && (
            <Link to="/app" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", fontFamily: "Syne, sans-serif" }}>CF</div>
              <span className="font-bold text-lg text-foreground" style={{ fontFamily: "Syne, sans-serif", letterSpacing: "-0.02em" }}>
                Client<span className="text-blue-500">Finder</span>
              </span>
            </Link>
          )}
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted">
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {showAdminNav ? (
            <>
              {sidebarOpen && (
                <Link to="/app" className="flex items-center gap-2 px-3 py-2 mb-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all">
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to App</span>
                </Link>
              )}
              {!sidebarOpen && (
                <Link to="/app" className="flex justify-center px-2 py-2 mb-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              )}
              {sidebarOpen && <div className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Admin</div>}
              {adminNavItems.map(item => <NavItem key={item.path} item={item} />)}
            </>
          ) : (
            <>
              {sidebarOpen && <div className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Workspace</div>}
              {navItems.map(item => <NavItem key={item.path} item={item} />)}
              <div className="mt-4 pt-3 border-t border-border">
                {sidebarOpen && <div className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Account</div>}
                {accountItems.map(item => <NavItem key={item.path} item={{ ...item, badge: null, badgeGreen: false }} />)}
              </div>
            </>
          )}
        </nav>

        {/* Credit widget */}
        {credits && (
          <div className="px-2 pb-1">
            {sidebarOpen ? (
              <div className={`rounded-lg p-2.5 border ${
                credits.empty
                  ? "border-red-500/30 bg-red-500/10"
                  : credits.low_credits
                  ? "border-amber-500/30 bg-amber-500/10"
                  : "border-blue-500/20 bg-blue-500/10"
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Zap className={`h-3 w-3 ${
                      credits.empty ? "text-red-400"
                      : credits.low_credits ? "text-amber-400"
                      : "text-blue-400"
                    }`} />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Credits</span>
                  </div>
                  <span className={`text-xs font-bold ${
                    credits.empty ? "text-red-400"
                    : credits.low_credits ? "text-amber-400"
                    : "text-foreground"
                  }`}>{credits.credits_remaining}</span>
                </div>
                <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-1 rounded-full transition-all ${
                      credits.empty ? "bg-red-500"
                      : credits.low_credits ? "bg-amber-500"
                      : "bg-blue-500"
                    }`}
                    style={{
                      width: `${credits.allocated_total > 0
                        ? Math.min(100, Math.round((credits.credits_remaining / credits.allocated_total) * 100))
                        : 0}%`
                    }}
                  />
                </div>
                {(credits.low_credits || credits.empty) && (
                  <p className={`text-[9px] mt-1.5 leading-tight ${
                    credits.empty ? "text-red-400" : "text-amber-400"
                  }`}>
                    {credits.empty
                      ? "Credits exhausted. Contact your team."
                      : "Contact team for more credits."}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex justify-center py-1">
                <div className={`w-2 h-2 rounded-full ${
                  credits.empty ? "bg-red-500"
                  : credits.low_credits ? "bg-amber-500"
                  : "bg-blue-500"
                }`} />
              </div>
            )}
          </div>
        )}

        {/* User card */}
        <div className="p-2 border-t border-border">
          <Link to="/app/profile">
          <div className={`flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer hover:bg-muted transition-colors ${!sidebarOpen ? "justify-center" : ""}`}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #7c3aed, #3b82f6)" }}>{userInitials}</div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-foreground truncate">{userName}</div>
                <div className="text-[10px] text-muted-foreground">{user?.plan || ""}</div>
              </div>
            )}
          </div>
          </Link>
          <button
            onClick={() => logout()}
            className={`mt-1 flex items-center gap-2 px-2 py-1.5 w-full rounded-lg text-destructive hover:bg-destructive/10 transition-colors text-xs ${!sidebarOpen ? "justify-center" : ""}`}
          >
            <LogOut className="h-3.5 w-3.5 flex-shrink-0" />
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <aside className="fixed left-0 top-0 bottom-0 w-64 flex flex-col border-r bg-card">
            <div className="h-14 flex items-center justify-between px-4 border-b border-border">
              <Link to="/app" className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                  style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}>CF</div>
                <span className="font-bold text-sm text-white" style={{ fontFamily: "Syne, sans-serif" }}>ClientFinder</span>
              </Link>
              <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)} className="h-7 w-7 text-muted-foreground">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {showAdminNav ? (
                <>
                  <Link to="/app" className="flex items-center gap-2 px-3 py-2 mb-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all" onClick={() => setMobileMenuOpen(false)}>
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to App</span>
                  </Link>
                  {adminNavItems.map(item => <NavItem key={item.path} item={item} mobile />)}
                </>
              ) : (
                <>
                  {navItems.map(item => <NavItem key={item.path} item={item} mobile />)}
                  <div className="mt-4 pt-3 border-t border-border">
                    {accountItems.map(item => <NavItem key={item.path} item={{ ...item, badge: null, badgeGreen: false }} mobile />)}
                  </div>
                  <div className="mt-4 pt-3 border-t border-border">
                    <button
                      onClick={() => { logout(); setMobileMenuOpen(false); }}
                      className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <LogOut className="h-4 w-4 flex-shrink-0" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              )}
            </nav>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 flex items-center justify-between px-4 lg:px-6 border-b flex-shrink-0 bg-card">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 text-muted-foreground" onClick={() => setMobileMenuOpen(true)}>
              <Menu className="h-4 w-4" />
            </Button>
            <div>
              <div className="font-bold text-base text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>{pageInfo.title}</div>
              <div className="text-[11px] text-muted-foreground">{pageInfo.sub}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => navigate("/app/simple-search", { state: { fresh: true } })}
              className="text-xs h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white">
              + New Search
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 h-8 px-2 hover:bg-muted">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs font-bold" style={{ background: "linear-gradient(135deg,#7c3aed,#3b82f6)", color: "white" }}>{userInitials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                <DropdownMenuLabel className="text-foreground">{userName}</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem onClick={() => navigate("/app/profile")} className="text-muted-foreground hover:text-foreground cursor-pointer">
                  <UserCircle className="mr-2 h-4 w-4" /> My Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/app/settings")} className="text-muted-foreground hover:text-foreground cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/app/billing")} className="text-muted-foreground hover:text-foreground cursor-pointer">
                  <CreditCard className="mr-2 h-4 w-4" /> Billing
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem
                  onClick={() => logout()}
                  className="text-destructive cursor-pointer">
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-auto page-enter" >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
