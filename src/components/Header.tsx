import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Home as HomeIcon, User, LogOut, Palette, UserPlus, CreditCard as Edit, Loader2, FolderOpen, Users, BarChart3, FileText, Shield, Wallpaper } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useDesignerProfile } from '../hooks/useDesignerProfile';
import { useUserRegistrationStatus } from '../hooks/useUserRegistrationStatus';
import AuthModal from './AuthModal';
import NotificationBell from './NotificationBell';
import { adminLogout, customerDesignerLogout } from '../utils/clearAuth';
import { detectUserTypeAndRedirect } from '../utils/userTypeDetection';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [editProfileLoading, setEditProfileLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { designer, isDesigner } = useDesignerProfile();
  const { hasCustomerProject } = useUserRegistrationStatus();
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          userMenuRef.current &&
          !userMenuRef.current.contains(event.target as Node)
        ) {
          setShowUserMenu(false);
        }
      };
    
      document.addEventListener("mousedown", handleClickOutside);
    
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, []);

  const navigation = [
    { name: 'Home', href: '/', icon: HomeIcon },
    { name: 'Designers', href: '/designers' },
    { name: 'Projects', href: '/projects' },
    { name: 'Offers & Deals', href: '/deals' },
    { name: 'Materials', href: '/materials' },
    { name: '3D Wallpaper', href: '/3d-wallpaper' },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    try {
      // Close any open menus
      setShowUserMenu(false);
      setIsMenuOpen(false);

      // Use appropriate logout based on user type
      if (isAdmin) {
        console.log('Admin logout selected');
        await adminLogout();
      } else {
        console.log('Customer/Designer logout selected');
        await customerDesignerLogout();
      }

      // Navigate to home after logout
      navigate('/');
    } catch (error) {
      console.error('Error during sign out:', error);
      // Force clear everything on error
      localStorage.clear();
      sessionStorage.clear();
      navigate('/');
    }
  };

  const handleDesignerRegistration = () => {
    navigate('/register-designer');
    setShowUserMenu(false);
    setIsMenuOpen(false);
  };

  const handleCustomerRegistration = () => {
    if (!user) {
      setAuthMode('signup');
      setShowAuthModal(true);
      setShowUserMenu(false);
      setIsMenuOpen(false);
      return;
    }
    navigate('/register-customer');
    setShowUserMenu(false);
    setIsMenuOpen(false);
  };

  const handleViewProjects = () => {
    navigate('/my-projects');
    setShowUserMenu(false);
  };

  const handleViewQuotes = () => {
    navigate('/customer-quotes');
    setShowUserMenu(false);
  };

  const handleViewCustomerProjects = () => {
    navigate('/customer-projects');
    setShowUserMenu(false);
  };

  const handleViewProfile = () => {
    if (designer) {
      navigate(`/designers/${designer.id}`);
    }
    setShowUserMenu(false);
  };

  const handleEditProfile = () => {
    if (designer) {
      setEditProfileLoading(true);
      setShowUserMenu(false);
      
      // Navigate directly to edit profile
      navigate('/edit-designer-profile');
      
      // Reset loading state
      setTimeout(() => {
        setEditProfileLoading(false);
      }, 500);
    }
  };

  const handleDesignerDashboard = () => {
    navigate('/designer-dashboard');
    setShowUserMenu(false);
  };

  const handleAuthSuccess = async () => {
    setShowAuthModal(false);

    console.log('=== Login Success - Starting Redirect ===');

    // Wait for auth state to settle, then detect user type and redirect
    setTimeout(async () => {
      try {
        const result = await detectUserTypeAndRedirect();

        if (!result) {
          console.error('handleAuthSuccess: Failed to detect user type');
          navigate('/');
          return;
        }

        console.log(`handleAuthSuccess: Redirecting ${result.userType} to ${result.redirectPath}`);
        navigate(result.redirectPath);
      } catch (error) {
        console.error('handleAuthSuccess: Error during redirect:', error);
        navigate('/');
      }
    }, 500);
  };

  return (
    <>
      <header className="bg-white shadow-lg sticky top-0 z-50">
        <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-6">

            {/* Logo / Application Name */}
            <Link
              to="/"
              className="flex items-center gap-3 flex-shrink-0 whitespace-nowrap min-w-fit"
            >
              <img
                src="/logo-mark.png"
                alt=""
                className="h-9 w-9 flex-shrink-0 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />

              <span className="text-xl font-bold text-secondary-800 whitespace-nowrap leading-none">
                TheHomeDesigners
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex flex-1 min-w-0 items-center justify-center gap-1 lg:gap-2">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex-shrink-0 whitespace-nowrap px-3 lg:px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                    isActive(item.href)
                      ? 'text-primary-600 bg-primary-50'
                      : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </nav>

            {/* Auth Section */}
            <div className="hidden md:flex items-center space-x-3 flex-shrink-0 min-w-fit">
              {user ? (
                <>
                  <NotificationBell />
                  <div ref={userMenuRef} className="relative">
                    <button
                      onClick={() => setShowUserMenu(prev => !prev)}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors whitespace-nowrap"
                    >
                      {isDesigner && designer?.profile_image ? (
                        <img
                          src={designer.profile_image}
                          alt={designer.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-white" />
                        </div>
                      )}
                      <span className="text-sm font-medium text-gray-700 max-w-[190px] lg:max-w-[230px] truncate">
                        {user.user_metadata?.name || user.email}
                      </span>
                    </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
                      {isAdmin ? (
                            <>
                              <button
                                onClick={() => {
                                  navigate('/admin');
                                  setShowUserMenu(false);
                                }}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                              >
                                <Shield className="w-4 h-4" />
                                <span>Admin Dashboard</span>
                              </button>
                              <button
                                onClick={() => {
                                  navigate('/admin/deals');
                                  setShowUserMenu(false);
                                }}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                              >
                                <BarChart3 className="w-4 h-4" />
                                <span>Manage Deals</span>
                              </button>
                              <button
                                onClick={() => {
                                  navigate('/admin/wallpaper-orders');
                                  setShowUserMenu(false);
                                }}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                              >
                                <Wallpaper className="w-4 h-4" />
                                <span>Wallpaper Orders</span>
                              </button>
                              <button
                                onClick={() => {
                                  navigate('/admin/3d-wallpapers');
                                  setShowUserMenu(false);
                                }}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                              >
                                <Wallpaper className="w-4 h-4" />
                                <span>Manage 3D Wallpapers</span>
                              </button>
                            </>
                          ) : isDesigner && designer?.verification_status === 'verified' ? (
                            <>
                              <button
                                onClick={handleDesignerDashboard}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                              >
                                <BarChart3 className="w-4 h-4" />
                                <span>Dashboard</span>
                              </button>
                              <button
                                onClick={handleViewProfile}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                              >
                                <User className="w-4 h-4" />
                                <span>View Profile</span>
                              </button>
                              <button
                                onClick={handleEditProfile}
                                disabled={editProfileLoading}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2 disabled:opacity-50"
                              >
                                {editProfileLoading ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Edit className="w-4 h-4" />
                                )}
                                <span>{editProfileLoading ? 'Loading...' : 'Edit Profile'}</span>
                              </button>
                              <button
                                onClick={handleViewCustomerProjects}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                              >
                                <Users className="w-4 h-4" />
                                <span>Customer Projects</span>
                              </button>
                            </>
                          ) : (
                            <>
                            {!isAdmin && (
                            <>                              
                            {/* Show "Register as Designer" only if user is not a customer */}
                              {!hasCustomerProject && (
                               <button
                                  onClick={handleDesignerRegistration}
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                                >
                                  <Palette className="w-4 h-4" />
                                  <span>Register as Designer</span>
                                </button> 
                              )}
                              {/* Show project-related options for customers */}
                              {hasCustomerProject ? (
                                <>
                                  <button
                                    onClick={handleViewProjects}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                                  >
                                    <FolderOpen className="w-4 h-4" />
                                    <span>My Projects</span>
                                  </button>
                                  <button
                                    onClick={handleViewQuotes}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                                  >
                                    <FileText className="w-4 h-4" />
                                    <span>My Quotes</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      navigate('/my-3d-wallpaper-orders');
                                      setShowUserMenu(false);
                                    }}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                                  >
                                    <Wallpaper className="w-4 h-4" />
                                    <span>My 3D Wallpaper Orders</span>
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={handleCustomerRegistration}
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                                >
                                  <UserPlus className="w-4 h-4" />
                                  <span>Register Your Project</span>
                                </button>
                              )}
                            </>
                            )}
                            </>
                          )}
                      <hr className="my-2" />
                      <button
                        onClick={handleSignOut}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                  </div>
                </>
              ) : (
                <button
                  onClick={() => {
                    setAuthMode('login');
                    setShowAuthModal(true);
                  }}
                  className="btn-primary px-4 py-2"
                >
                  Sign In
                </button>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden ml-auto flex-shrink-0">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 rounded-md text-gray-700 hover:text-primary-600 hover:bg-gray-100"
              >
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {isMenuOpen && (
            <div className="md:hidden border-t border-gray-200">
              <div className="px-2 pt-2 pb-3 space-y-1">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 ${
                      isActive(item.href)
                        ? 'text-primary-600 bg-primary-50'
                        : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.name}
                  </Link>
                ))}
                
                {user ? (
                  <div className="border-t border-gray-200 pt-3 mt-3">
                    <div className="px-3 py-2 text-sm text-gray-500">
                      Signed in as {user.user_metadata?.name || user.email}
                    </div>
                    {isAdmin ? (
                          <>
                            <button
                              onClick={() => {
                                navigate('/admin');
                                setIsMenuOpen(false);
                              }}
                              className="block w-full text-left px-3 py-2 text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 flex items-center space-x-2"
                            >
                              <Shield className="w-4 h-4" />
                              <span>Admin Dashboard</span>
                            </button>
                            <button
                              onClick={() => {
                                navigate('/admin/deals');
                                setIsMenuOpen(false);
                              }}
                              className="block w-full text-left px-3 py-2 text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 flex items-center space-x-2"
                            >
                              <BarChart3 className="w-4 h-4" />
                              <span>Manage Deals</span>
                            </button>
                            <button
                              onClick={() => {
                                navigate('/admin/wallpaper-orders');
                                setIsMenuOpen(false);
                              }}
                              className="block w-full text-left px-3 py-2 text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 flex items-center space-x-2"
                            >
                              <Wallpaper className="w-4 h-4" />
                              <span>Wallpaper Orders</span>
                            </button>
                            <button
                              onClick={() => {
                                navigate('/admin/3d-wallpapers');
                                setIsMenuOpen(false);
                              }}
                              className="block w-full text-left px-3 py-2 text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 flex items-center space-x-2"
                            >
                              <Wallpaper className="w-4 h-4" />
                              <span>Manage 3D Wallpapers</span>
                            </button>
                          </>
                        ) : isDesigner ? (
                          <>
                            <button
                              onClick={() => {
                                handleDesignerDashboard();
                                setIsMenuOpen(false);
                              }}
                              className="block w-full text-left px-3 py-2 text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 flex items-center space-x-2"
                            >
                              <BarChart3 className="w-4 h-4" />
                              <span>Dashboard</span>
                            </button>
                            <button
                              onClick={() => {
                                handleViewProfile();
                                setIsMenuOpen(false);
                              }}
                              className="block w-full text-left px-3 py-2 text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 flex items-center space-x-2"
                            >
                              <User className="w-4 h-4" />
                              <span>View Profile</span>
                            </button>
                            <button
                              onClick={() => {
                                handleEditProfile();
                                setIsMenuOpen(false);
                              }}
                              disabled={editProfileLoading}
                              className="block w-full text-left px-3 py-2 text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 flex items-center space-x-2 disabled:opacity-50"
                            >
                              {editProfileLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Edit className="w-4 h-4" />
                              )}
                              <span>{editProfileLoading ? 'Loading...' : 'Edit Profile'}</span>
                            </button>
                            <button
                              onClick={() => {
                                handleViewCustomerProjects();
                                setIsMenuOpen(false);
                              }}
                              className="block w-full text-left px-3 py-2 text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 flex items-center space-x-2"
                            >
                              <Users className="w-4 h-4" />
                              <span>Customer Projects</span>
                            </button>
                          </>
                        ) : (
                          <>
                            {!isAdmin && (
                            <>
                              {/* Show "Register as Designer" only if user is not a customer */}
                              {!hasCustomerProject && (
                                <button
                                  onClick={() => {
                                    handleDesignerRegistration();
                                    setIsMenuOpen(false);
                                  }}
                                  className="block w-full text-left px-3 py-2 text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 flex items-center space-x-2"
                                >
                                  <Palette className="w-4 h-4" />
                                  <span>Register as Designer</span>
                                </button>
                              )}

                              {/* Show project-related options for customers */}
                              {hasCustomerProject ? (
                                <>
                                  <button
                                    onClick={() => {
                                      handleViewProjects();
                                      setIsMenuOpen(false);
                                    }}
                                    className="block w-full text-left px-3 py-2 text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 flex items-center space-x-2"
                                  >
                                    <FolderOpen className="w-4 h-4" />
                                    <span>My Projects</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleViewQuotes();
                                      setIsMenuOpen(false);
                                    }}
                                    className="block w-full text-left px-3 py-2 text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 flex items-center space-x-2"
                                  >
                                    <FileText className="w-4 h-4" />
                                    <span>My Quotes</span>
                                  </button>
                                </>
                              ) : (
                                <>
                                <button
                                  onClick={() => {
                                    handleCustomerRegistration();
                                    setIsMenuOpen(false);
                                  }}
                                  className="block w-full text-left px-3 py-2 text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 flex items-center space-x-2"
                                >
                                  <UserPlus className="w-4 h-4" />
                                  <span>Register Your Project</span>
                                </button>
                                </>
                              )}
                            </>
                            )}
                          </>
                        )}
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-3 py-2 text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-primary-50"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <div className="border-t border-gray-200 pt-3 mt-3 space-y-1">
                    <button
                      onClick={() => {
                        setAuthMode('login');
                        setShowAuthModal(true);
                        setIsMenuOpen(false);
                      }}
                      className="block w-full text-left px-3 py-2 text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50"
                    >
                      Sign In
                    </button>
                    <button
                      onClick={handleDesignerRegistration}
                      className="block w-full text-left px-3 py-2 text-base font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50"
                    >
                      Register as Designer
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        mode={authMode}
        onModeChange={setAuthMode}
        onAuthSuccess={handleAuthSuccess}
      />
    </>
  );
};

export default Header;