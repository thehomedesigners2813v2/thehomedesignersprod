import React, { useEffect, useState, lazy, Suspense } from 'react';

import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useLocation
} from 'react-router-dom';

import { AuthProvider } from './hooks/AuthContext';
import { useAuth } from './hooks/useAuth';
import { useDesignerProfile } from './hooks/useDesignerProfile';
import { detectUserTypeAndRedirect } from './utils/userTypeDetection';
import Header from './components/Header';
import Footer from './components/Footer';
import Chatbot from './components/Chatbot';
import InstallPrompt from './components/InstallPrompt';
import ProtectedDesignerRoute from './components/ProtectedDesignerRoute';
import SubscriptionExpiredModal from './components/SubscriptionExpiredModal';

import Home from './pages/Home';

import { forceLogoutAll } from './utils/clearAuth';
import { debugAuthState } from './utils/debugDesigner';
import { useSubscription } from './hooks/useSubscription';
import { supabase } from './lib/supabase';

const Designers = lazy(() => import('./pages/Designers'));
const Deals = lazy(() => import('./pages/Deals'));
const DealDetail = lazy(() => import('./pages/DealDetail'));
const Projects = lazy(() => import('./pages/Projects'));
const Materials = lazy(() => import('./pages/Materials'));
const DesignerDetail = lazy(() => import('./pages/DesignerDetail'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const DesignerRegistration = lazy(() => import('./pages/DesignerRegistration'));
const DesignerProfileManager = lazy(() => import('./pages/DesignerProfileManager'));
const CustomerRegistration = lazy(() => import('./pages/CustomerRegistration'));
const MyProjects = lazy(() => import('./pages/MyProjects'));
const EditProject = lazy(() => import('./pages/EditProject'));
const CustomerProjects = lazy(() => import('./pages/CustomerProjects'));
const ProjectDetailWithTracking = lazy(() => import('./pages/ProjectDetailWithTracking'));

const DesignerDashboard = lazy(() => import('./pages/DesignerDashboard'));
const DesignerMaterialPricing = lazy(() => import('./pages/DesignerMaterialPricing'));
const DesignerQuotes = lazy(() => import('./pages/DesignerQuotes'));
const DesignerQuoteGenerator = lazy(() => import('./pages/DesignerQuoteGenerator'));
const AIQuotationAssistant = lazy(() => import('./pages/AIQuotationAssistant'));

const CustomerQuotes = lazy(() => import('./pages/CustomerQuotes'));
const QuoteViewer = lazy(() => import('./pages/QuoteViewer'));

const DesignerSubscription = lazy(() => import('./pages/DesignerSubscription'));
const DesignerAISubscription = lazy(() => import('./pages/DesignerAISubscription'));

const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminDealsManagement = lazy(() => import('./pages/AdminDealsManagement'));
const AdminVideoManagement = lazy(() => import('./pages/AdminVideoManagement'));
const AdminWhatsAppSettings = lazy(() => import('./pages/AdminWhatsAppSettings'));

// New admin pages
const AdminRoute = lazy(() => import('./components/AdminRoute'));
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview'));
const AdminUsersVerification = lazy(() => import('./pages/admin/AdminUsersVerification'));
const AdminDesigners = lazy(() => import('./pages/admin/AdminDesigners'));
const AdminHomeowners = lazy(() => import('./pages/admin/AdminHomeowners'));
const AdminProjects = lazy(() => import('./pages/admin/AdminProjects'));
const AdminQuotations = lazy(() => import('./pages/admin/AdminQuotations'));
const AdminPayments = lazy(() => import('./pages/admin/AdminPayments'));
const AdminSubscriptions = lazy(() => import('./pages/admin/AdminSubscriptions'));
const AdminAIMonitoring = lazy(() => import('./pages/admin/AdminAIMonitoring'));
const AdminContentMarketing = lazy(() => import('./pages/admin/AdminContentMarketing'));
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics'));
const AdminPlatformSettings = lazy(() => import('./pages/admin/AdminPlatformSettings'));
const AdminIntegrations = lazy(() => import('./pages/admin/AdminIntegrations'));
const AdminAuditLogs = lazy(() => import('./pages/admin/AdminAuditLogs'));

const DebugPage = lazy(() => import('./pages/DebugPage'));
const DebugDesignerProfile = lazy(() => import('./pages/DebugDesignerProfile'));

const ClearSession = lazy(() => import('./pages/ClearSession'));
const EmailConfirmation = lazy(() => import('./pages/EmailConfirmation'));

const WallpaperOrder = lazy(() => import('./pages/WallpaperOrder'));
const WallpaperGallery = lazy(() => import('./pages/WallpaperGallery'));
const AdminWallpaperOrders = lazy(() => import('./pages/AdminWallpaperOrders'));
const Admin3DWallpapers = lazy(() => import('./pages/Admin3DWallpapers'));
const My3DWallpaperOrders = lazy(() => import('./pages/My3DWallpaperOrders'));

const DesignerBilling = lazy(() => import('./pages/DesignerBilling'));
const CustomerBillView = lazy(() => import('./pages/CustomerBillView'));
const BillDashboard = lazy(() => import('./pages/BillDashboard'));
const OfflineBillEditor = lazy(() => import('./pages/OfflineBillEditor'));

// Expose utilities to window for emergency use and debugging
if (typeof window !== 'undefined') {
  const debugWindow = window as typeof window & {
    forceLogoutAll?: typeof forceLogoutAll;
    debugAuthState?: typeof debugAuthState;
  };
  debugWindow.forceLogoutAll = forceLogoutAll;
  debugWindow.debugAuthState = debugAuthState;

  console.log(
    '%cDebug Commands Available:',
    'color: blue; font-size: 14px; font-weight: bold;'
  );

  console.log(
    '%cwindow.forceLogoutAll() - Force logout all users',
    'color: green;'
  );

  console.log(
    '%cwindow.debugAuthState() - Show current auth state',
    'color: green;'
  );
}

// Component to handle dashboard redirects for designers and admins
const DashboardRedirectHandler = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [redirecting, setRedirecting] = React.useState(false);

  useEffect(() => {
    const handleRedirect = async () => {
      // Wait for auth to finish loading
      if (authLoading || redirecting) {
        return;
      }

      // Only redirect from home page
      if (window.location.pathname !== '/') {
        return;
      }

      // If user is authenticated, detect type and redirect
      if (user) {
        console.log(
          'DashboardRedirectHandler: User logged in, detecting type...'
        );

        setRedirecting(true);

        try {
          const result = await detectUserTypeAndRedirect();

          if (result && result.redirectPath !== '/') {
            console.log(
              `DashboardRedirectHandler: Redirecting ${result.userType} to ${result.redirectPath}`
            );

            navigate(result.redirectPath);
          } else {
            console.log(
              'DashboardRedirectHandler: User has no registration'
            );
          }
        } catch (error) {
          console.error(
            'DashboardRedirectHandler: Error:',
            error
          );
        } finally {
          setRedirecting(false);
        }
      }
    };

    handleRedirect();
  }, [user, authLoading, navigate, redirecting]);

  return null;
};


/*
 * Everything inside this component is rendered AFTER AuthProvider.
 * Therefore useSubscription() and useDesignerProfile() can safely
 * access the authentication context.
 */
const AppContent: React.FC = () => {
  const location = useLocation();  
  useEffect(() => 
  {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const [subscriptionManagementEnabled, setSubscriptionManagementEnabled] = useState(false);
  const [subscriptionManagementLoading, setSubscriptionManagementLoading] = useState(true);

  const {
    subscription,
    loading: subscriptionLoading
  } = useSubscription();
  useEffect(() => {
  const fetchSubscriptionManagementSetting = async () => {
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('is_active')
        .eq('setting_key', 'subscription_management_enabled')
        .maybeSingle();

      if (error) throw error;

      setSubscriptionManagementEnabled(data?.is_active === true);
    } catch (error) {
      console.error('Error fetching subscription management setting:', error);

      // If the setting cannot be read, do not block designers.
      setSubscriptionManagementEnabled(false);
    } finally {
      setSubscriptionManagementLoading(false);
    }
  };

  fetchSubscriptionManagementSetting();

  const interval = window.setInterval(() => {
    fetchSubscriptionManagementSetting();
  }, 60000);

  return () => window.clearInterval(interval);
}, []);

  const {
    designer,
    loading: designerLoading
  } = useDesignerProfile();

  /*
   * The subscription page must remain usable.
   * Otherwise the expired popup would cover the Renew page itself.
   */
  const isSubscriptionPage =
    location.pathname === '/designer-subscription' ||
    location.pathname === '/designer-ai-subscription';

  /*
   * Show the expired popup only when:
   *
   * 1. Designer information has finished loading
   * 2. Subscription information has finished loading
   * 3. A designer exists
   * 4. Subscription is expired
   * 5. User is not currently on the renewal page
   */
 const showSubscriptionExpiredModal =
    !subscriptionManagementLoading &&
    subscriptionManagementEnabled &&
    !designerLoading &&
    !subscriptionLoading &&
    !!designer &&
    subscription.isExpired &&
    !isSubscriptionPage;

  const isQuotationView = location.pathname.startsWith('/view-quote/');
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen flex flex-col">

      <DashboardRedirectHandler />

      {/*
        Header stays outside the subscription popup.
        Therefore navbar tabs remain clickable.
        Hidden on quotation views so the downloaded/printed
        quotation is completely free of website branding.
        Hidden on admin routes — admin has its own layout.
      */}
      {!isQuotationView && !isAdminRoute && <Header />}

      <main className="flex-grow">

        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
            </div>
          }
        >

          <Routes>

            <Route
              path="/"
              element={<Home />}
            />

            <Route
              path="/designers"
              element={<Designers />}
            />

            <Route
              path="/designers/:id"
              element={<DesignerDetail />}
            />

            <Route path="/deals" element={<Deals />} />
            <Route path="/deals/:id" element={<DealDetail />} />
            <Route
              path="/projects"
              element={<Projects />}
            />

            <Route
              path="/projects/:id"
              element={<ProjectDetail />}
            />

            <Route
              path="/materials"
              element={<Materials />}
            />

            <Route
              path="/register-designer"
              element={<DesignerRegistration />}
            />

            <Route
              path="/edit-designer-profile"
              element={
                <ProtectedDesignerRoute>
                  <DesignerProfileManager />
                </ProtectedDesignerRoute>
              }
            />

            <Route
              path="/register-customer"
              element={<CustomerRegistration />}
            />

            <Route
              path="/my-projects"
              element={<MyProjects />}
            />

            <Route
              path="/edit-project/:id"
              element={<EditProject />}
            />

            <Route
              path="/project-detail/:id"
              element={<ProjectDetailWithTracking />}
            />

            <Route
              path="/customer-projects"
              element={<CustomerProjects />}
            />

            <Route
              path="/designer-dashboard"
              element={
                <ProtectedDesignerRoute>
                  <DesignerDashboard />
                </ProtectedDesignerRoute>
              }
            />

            <Route
              path="/designer-material-pricing"
              element={
                <ProtectedDesignerRoute>
                  <DesignerMaterialPricing />
                </ProtectedDesignerRoute>
              }
            />

            <Route
              path="/designer-quotes"
              element={
                <ProtectedDesignerRoute>
                  <DesignerQuotes />
                </ProtectedDesignerRoute>
              }
            />

            <Route
              path="/customer-quotes"
              element={<CustomerQuotes />}
            />

            {/*
              IMPORTANT:
              This route remains accessible when subscription is expired
              so the designer can renew their subscription.
            */}
            <Route
              path="/designer-subscription"
              element={
                <ProtectedDesignerRoute>
                  <DesignerSubscription />
                </ProtectedDesignerRoute>
              }
            />

            <Route
              path="/designer-ai-subscription"
              element={
                <ProtectedDesignerRoute>
                  <DesignerAISubscription />
                </ProtectedDesignerRoute>
              }
            />

            <Route
              path="/generate-quote/:id"
              element={
                <ProtectedDesignerRoute>
                  <DesignerQuoteGenerator />
                </ProtectedDesignerRoute>
              }
            />

            <Route
              path="/ai-quotation/:id"
              element={
                <ProtectedDesignerRoute>
                  <AIQuotationAssistant />
                </ProtectedDesignerRoute>
              }
            />

            <Route
              path="/view-quote/:id"
              element={<QuoteViewer />}
            />

            {/* Admin routes — all wrapped with AdminRoute (auth guard + layout) */}
            <Route path="/admin" element={<AdminRoute><AdminOverview /></AdminRoute>} />
            <Route path="/admin/users" element={<AdminRoute><AdminUsersVerification /></AdminRoute>} />
            <Route path="/admin/designers" element={<AdminRoute><AdminDesigners /></AdminRoute>} />
            <Route path="/admin/homeowners" element={<AdminRoute><AdminHomeowners /></AdminRoute>} />
            <Route path="/admin/projects" element={<AdminRoute><AdminProjects /></AdminRoute>} />
            <Route path="/admin/quotations" element={<AdminRoute><AdminQuotations /></AdminRoute>} />
            <Route path="/admin/payments" element={<AdminRoute><AdminPayments /></AdminRoute>} />
            <Route path="/admin/subscriptions" element={<AdminRoute><AdminSubscriptions /></AdminRoute>} />
            <Route path="/admin/ai-monitoring" element={<AdminRoute><AdminAIMonitoring /></AdminRoute>} />
            <Route path="/admin/content" element={<AdminRoute><AdminContentMarketing /></AdminRoute>} />
            <Route path="/admin/analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
            <Route path="/admin/settings" element={<AdminRoute><AdminPlatformSettings /></AdminRoute>} />
            <Route path="/admin/integrations" element={<AdminRoute><AdminIntegrations /></AdminRoute>} />
            <Route path="/admin/audit-logs" element={<AdminRoute><AdminAuditLogs /></AdminRoute>} />

            {/* Legacy sub-pages — also wrapped with AdminRoute */}
            <Route path="/admin/deals" element={<AdminRoute><AdminDealsManagement /></AdminRoute>} />
            <Route path="/admin/video" element={<AdminRoute><AdminVideoManagement /></AdminRoute>} />
            <Route path="/admin/whatsapp" element={<AdminRoute><AdminWhatsAppSettings /></AdminRoute>} />
            <Route path="/admin/wallpaper-orders" element={<AdminRoute><AdminWallpaperOrders /></AdminRoute>} />
            <Route path="/admin/3d-wallpapers" element={<AdminRoute><Admin3DWallpapers /></AdminRoute>} />

            <Route
              path="/admin-login"
              element={<AdminLogin />}
            />

            <Route
              path="/debug"
              element={<DebugPage />}
            />

            <Route
              path="/debug-profile"
              element={<DebugDesignerProfile />}
            />

            <Route
              path="/clear-session"
              element={<ClearSession />}
            />

            <Route
              path="/3d-wallpaper"
              element={<WallpaperGallery />}
            />

            <Route
              path="/wallpaper-order"
              element={<WallpaperOrder />}
            />

            <Route
              path="/my-3d-wallpaper-orders"
              element={<My3DWallpaperOrders />}
            />

            <Route
              path="/project-bill/:projectId"
              element={
                <ProtectedDesignerRoute>
                  <DesignerBilling />
                </ProtectedDesignerRoute>
              }
            />

            <Route
              path="/my-bill/:projectId"
              element={<CustomerBillView />}
            />

            <Route
              path="/bills"
              element={
                <ProtectedDesignerRoute>
                  <BillDashboard />
                </ProtectedDesignerRoute>
              }
            />

            <Route
              path="/create-offline-bill"
              element={
                <ProtectedDesignerRoute>
                  <OfflineBillEditor />
                </ProtectedDesignerRoute>
              }
            />

            <Route
              path="/offline-bill/:billId"
              element={
                <ProtectedDesignerRoute>
                  <OfflineBillEditor />
                </ProtectedDesignerRoute>
              }
            />

            <Route
              path="/auth/confirm"
              element={<EmailConfirmation />}
            />

          </Routes>

        </Suspense>

      </main>

      {!isQuotationView && !isAdminRoute && <Footer />}
      {!isQuotationView && !isAdminRoute && <Chatbot />}
      <InstallPrompt />

      {/*
        Subscription popup.

        It is rendered AFTER Header so the Header/navbar can still
        be clicked.

        The modal itself will block the page content underneath it.
      */}
      {showSubscriptionExpiredModal && subscriptionManagementEnabled && (
      <SubscriptionExpiredModal isOpen={true} />
      )}

    </div>
  );
};


function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}
export default App;