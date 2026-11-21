
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  UserCheck,
  Briefcase,
  Home as HomeIcon,
  FolderKanban,
  FileText,
  CreditCard,
  Sparkles,
  Megaphone,
  BarChart3,
  Settings,
  Plug,
  ScrollText,
  PanelLeft,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Main',
    items: [
      { label: 'Overview', icon: LayoutDashboard, path: '/admin' },
      { label: 'Users & Verification', icon: UserCheck, path: '/admin/users' },
      { label: 'Designers', icon: Briefcase, path: '/admin/designers' },
      { label: 'Homeowners', icon: HomeIcon, path: '/admin/homeowners' },
    ],
  },
  {
    title: 'Monitoring',
    items: [
      { label: 'Projects', icon: FolderKanban, path: '/admin/projects' },
      { label: 'Quotations', icon: FileText, path: '/admin/quotations' },
      { label: 'Payments', icon: CreditCard, path: '/admin/payments' },
      {
        label: 'Subscriptions & Billing',
        icon: CreditCard,
        path: '/admin/subscriptions',
      },
      { label: 'AI Quotation', icon: Sparkles, path: '/admin/ai-monitoring' },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { label: 'Content & Marketing', icon: Megaphone, path: '/admin/content' },
    ],
  },
  {
    title: 'Insights',
    items: [
      { label: 'Analytics & Reports', icon: BarChart3, path: '/admin/analytics' },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Platform Settings', icon: Settings, path: '/admin/settings' },
      { label: 'Integrations', icon: Plug, path: '/admin/integrations' },
      { label: 'Audit Logs', icon: ScrollText, path: '/admin/audit-logs' },
    ],
  },
];

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();

  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Check active navigation item
  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }

    return location.pathname.startsWith(path);
  };

  // Sign out
  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Open or close sidebar based on screen size
  const toggleSidebar = () => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      setDesktopSidebarOpen((d) => !d);
    } else {
      setMobileSidebarOpen((d) => !d);
    }
  };

  const closeMobileSidebar = () => {
    setMobileSidebarOpen(false);
  };

  // Sidebar content
  const sidebarContent = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-secondary-900 text-gray-300">

      {/* Fixed sidebar header */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-secondary-700/50 px-3">

        <img src="/logo-mark.png" alt="" className="h-9 w-9 shrink-0 rounded-lg bg-white object-contain" />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            Admin Console
          </p>
          <p className="truncate text-xs text-gray-400">
            TheHomeDesigners
          </p>
        </div>

        {/* Sidebar toggle — fixed while navigation scrolls */}
        <button
          type="button"
          onClick={toggleSidebar}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-secondary-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          aria-label="Toggle sidebar"
          title="Toggle sidebar"
        >
          <PanelLeft className="h-5 w-5" />
        </button>

      </div>

      {/* Only navigation scrolls */}
      <nav
        aria-label="Admin navigation"
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-4"
      >
        <div className="space-y-5">

          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>

              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                {section.title}
              </p>

              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.path);
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => {
                        navigate(item.path);
                        closeMobileSidebar();
                      }}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                        active
                          ? 'bg-sky-500/15 text-sky-300'
                          : 'text-gray-400 hover:bg-secondary-800 hover:text-gray-200'
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          active ? 'text-sky-400' : ''
                        }`}
                      />

                      <span className="min-w-0 flex-1 truncate">
                        {item.label}
                      </span>

                      {active && (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Sign Out */}
          <div className="border-t border-secondary-700/50 pt-4">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>

        </div>
      </nav>

    </div>
  );

  return (
    <div className="flex min-h-dvh w-full overflow-x-clip bg-gray-50">

      {/* Desktop sidebar */}
      {desktopSidebarOpen && (
        <aside className="fixed inset-y-0 left-0 z-40 hidden h-dvh w-60 overflow-hidden lg:block">
          {sidebarContent}
        </aside>
      )}

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <>
          <button
            type="button"
            aria-label="Close sidebar overlay"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={closeMobileSidebar}
          />

          <aside className="fixed inset-y-0 left-0 z-50 h-dvh w-60 max-w-[85vw] overflow-hidden lg:hidden">
            {sidebarContent}
          </aside>
        </>
      )}

      {/* Main dashboard column */}
      <div
        className={`flex min-h-dvh min-w-0 flex-1 flex-col transition-[margin] duration-300 ease-in-out ${
          desktopSidebarOpen ? 'lg:ml-60' : 'lg:ml-0'
        }`}
      >

        {/* Admin header */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 lg:px-6">

          {/* Toggle: visible on mobile always, on desktop only when sidebar is closed */}
          <button
            type="button"
            onClick={toggleSidebar}
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
              desktopSidebarOpen ? 'lg:hidden' : ''
            }`}
            aria-label="Toggle sidebar"
            title="Toggle sidebar"
          >
            <PanelLeft className="h-5 w-5" />
          </button>

          <span className="font-semibold text-gray-800">
            Admin Console
          </span>

        </header>

        {/* Dashboard content */}
        <main className="min-h-0 min-w-0 flex-1">
          {children}
        </main>

        {/* Admin footer — follows content horizontal positioning */}
        <footer className="shrink-0 border-t border-gray-200 bg-white px-4 py-4 text-center text-xs text-gray-400 lg:px-6">
          &copy; {new Date().getFullYear()} TheHomeDesigners.in — Admin Console
        </footer>

      </div>
    </div>
  );
};

export default AdminLayout;
