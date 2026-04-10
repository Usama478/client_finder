import { Outlet, Link } from "react-router";
import { Button } from "../components/ui/button";

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-background force-dark text-foreground flex flex-col">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center text-white font-bold">
                  CF
                </div>
                <span className="font-semibold text-lg">Client Finder</span>
              </Link>
              <div className="hidden md:flex items-center gap-6">
                <Link to="/features" className="text-sm text-muted-foreground hover:text-foreground">
                  Features
                </Link>
                <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground">
                  Pricing
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/auth/login">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link to="/auth/signup">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>
      <main className="pt-16">
        <Outlet />
      </main>
      <footer className="border-t bg-muted mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-semibold mb-4 text-foreground">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/features" className="hover:text-foreground">Features</Link></li>
                <li><Link to="/pricing" className="hover:text-foreground">Pricing</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-foreground">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">About</a></li>
                <li><a href="#" className="hover:text-foreground">Contact</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-foreground">Resources</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Documentation</a></li>
                <li><a href="#" className="hover:text-foreground">Support</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-foreground">Legal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Privacy</a></li>
                <li><a href="#" className="hover:text-foreground">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-sm text-muted-foreground text-center">
            © 2026 Client Finder. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
