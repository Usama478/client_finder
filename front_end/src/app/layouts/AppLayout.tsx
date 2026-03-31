import { Outlet, Link, useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard, Search, Users, UserCircle, Activity, Mail,
  FileText, CreditCard, Settings, Shield, Bell, Menu, X, ChevronLeft
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Badge } from "../components/ui/badge";
import { useState } from "react";
import { useAuth } from "../../lib/auth-context";

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const userInitials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";
  const userName = user?.name || "User";

  const isActive = (path: string) =>
    path === "/app" ? location.pathname === "/app" : location.pathname.startsWith(path);

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/app", badge: null },
    { icon: Search, label: "Search Businesses", path: "/app/search", badge: "3" },
    { icon: Users, label: "Clients", path: "/app/clients", badge: "47", badgeGreen: true },
    { icon: UserCircle, label: "Contacts", path: "/app/contacts", badge: null },
    { icon: Activity, label: "Activity", path: "/app/activity", badge: null },
    { icon: Mail, label: "Email Workspace", path: "/app/email", badge: null },
    { icon: FileText, label: "AI Contexts", path: "/app/contexts", badge: null },
  ];

  const accountItems = [
    { icon: CreditCard, label: "Billing", path: "/app/billing" },
    { icon: Settings, label: "Settings", path: "/app/settings" },
  ];

  const pageTitles: Record<string, { title: string; sub: string }> = {
    "/app": { title: "Dashboard", sub: "Overview & pipeline" },
    "/app/search": { title: "Search Businesses", sub: "Discover → Score → Verify → Decide" },
    "/app/clients": { title: "Clients", sub: "Saved & verified lead database" },
    "/app/contacts": { title: "Contacts", sub: "Contact directory" },
    "/app/activity": { title: "Activity", sub: "Operational timeline" },
    "/app/email": { title: "Email Workspace", sub: "Outreach generation & analytics" },
    "/app/contexts": { title: "AI Contexts", sub: "Relevance configuration" },
    "/app/billing": { title: "Billing", sub: "Plan & usage" },
    "/app/settings": { title: "Settings", sub: "Profile & preferences" },
    "/app/admin": { title: "Admin Panel", sub: "Platform management" },
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
            ? "bg-blue-500/10 text-blue-400 font-medium border border-blue-500/20"
            : "text-[#8a95a8] hover:bg-[#151a22] hover:text-[#e8edf5]"}
          ${!sidebarOpen && !mobile ? "justify-center px-2" : ""}`}>
          <Icon className="h-4 w-4 flex-shrink-0" />
          {(sidebarOpen || mobile) && <span className="flex-1">{item.label}</span>}
          {(sidebarOpen || mobile) && item.badge && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.badgeGreen ? "bg-emerald-500/20 text-emerald-400" : "bg-blue-500/20 text-blue-400"}`}>
              {item.badge}
            </span>
          )}
        </div>
      </Link>
    );
  };

  return (
    <div className="flex h-screen" style={{ background: "#0a0c10" }}>
      {/* Desktop Sidebar */}
      <aside className={`${sidebarOpen ? "w-56" : "w-14"} hidden md:flex flex-col transition-all duration-300 border-r`}
        style={{ background: "#0f1218", borderColor: "rgba(255,255,255,0.07)" }}>
        {/* Logo */}
        <div className="h-14 flex items-center justify-between px-3 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          {sidebarOpen && (
            <Link to="/app" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", fontFamily: "Syne, sans-serif" }}>CF</div>
              <span className="font-bold text-sm text-white" style={{ fontFamily: "Syne, sans-serif" }}>
                Client<span className="text-blue-400">Finder</span>
              </span>
            </Link>
          )}
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}
            className="h-7 w-7 text-[#5a6478] hover:text-[#e8edf5] hover:bg-[#151a22]">
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {sidebarOpen && <div className="px-3 py-2 text-[10px] font-semibold text-[#5a6478] uppercase tracking-widest">Workspace</div>}
          {navItems.map(item => <NavItem key={item.path} item={item} />)}
          <div className="mt-4 pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            {sidebarOpen && <div className="px-3 py-2 text-[10px] font-semibold text-[#5a6478] uppercase tracking-widest">Account</div>}
            {accountItems.map(item => <NavItem key={item.path} item={{ ...item, badge: null, badgeGreen: false }} />)}
          </div>
        </nav>

        {/* User card */}
        <div className="p-2 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <div className={`flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer hover:bg-[#151a22] transition-colors ${!sidebarOpen ? "justify-center" : ""}`}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #7c3aed, #3b82f6)" }}>{userInitials}</div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-[#e8edf5] truncate">{userName}</div>
                <div className="text-[10px] text-[#5a6478]">Pro Plan</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <aside className="fixed left-0 top-0 bottom-0 w-64 flex flex-col border-r" style={{ background: "#0f1218", borderColor: "rgba(255,255,255,0.07)" }}>
            <div className="h-14 flex items-center justify-between px-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
              <Link to="/app" className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                  style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}>CF</div>
                <span className="font-bold text-sm text-white" style={{ fontFamily: "Syne, sans-serif" }}>ClientFinder</span>
              </Link>
              <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)} className="h-7 w-7 text-[#5a6478]">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {navItems.map(item => <NavItem key={item.path} item={item} mobile />)}
              <div className="mt-4 pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                {accountItems.map(item => <NavItem key={item.path} item={{ ...item, badge: null, badgeGreen: false }} mobile />)}
              </div>
            </nav>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 flex items-center justify-between px-4 lg:px-6 border-b flex-shrink-0"
          style={{ background: "#0f1218", borderColor: "rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 text-[#8a95a8]" onClick={() => setMobileMenuOpen(true)}>
              <Menu className="h-4 w-4" />
            </Button>
            <div>
              <div className="font-bold text-sm text-[#e8edf5]" style={{ fontFamily: "Syne, sans-serif" }}>{pageInfo.title}</div>
              <div className="text-[11px] text-[#5a6478]">{pageInfo.sub}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative h-8 w-8 text-[#8a95a8] hover:text-[#e8edf5] hover:bg-[#151a22]">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
            </Button>
            <Button onClick={() => navigate("/app/search")}
              className="text-xs h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white">
              + New Search
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 h-8 px-2 hover:bg-[#151a22]">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs font-bold" style={{ background: "linear-gradient(135deg,#7c3aed,#3b82f6)", color: "white" }}>{userInitials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48" style={{ background: "#151a22", border: "1px solid rgba(255,255,255,0.1)" }}>
                <DropdownMenuLabel className="text-[#e8edf5]">{userName}</DropdownMenuLabel>
                <DropdownMenuSeparator style={{ background: "rgba(255,255,255,0.07)" }} />
                <DropdownMenuItem onClick={() => navigate("/app/settings")} className="text-[#8a95a8] hover:text-[#e8edf5] cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/app/billing")} className="text-[#8a95a8] hover:text-[#e8edf5] cursor-pointer">
                  <CreditCard className="mr-2 h-4 w-4" /> Billing
                </DropdownMenuItem>
                <DropdownMenuSeparator style={{ background: "rgba(255,255,255,0.07)" }} />
                <DropdownMenuItem
                  onClick={() => logout()}
                  className="text-red-400 cursor-pointer">
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-auto page-enter" style={{ background: "#0a0c10" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
