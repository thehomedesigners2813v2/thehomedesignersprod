import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, IndianRupee as Rupee, Clock, User, Mail, Phone, MessageSquare, ArrowLeft, Loader2, AlertCircle, RefreshCw, FileText, Upload, Eye, BarChart3, Users, Star, TrendingUp, CheckCircle, Award, Target, Activity, X, XCircle, BarChart as BarChartIcon, PieChart as PieChartIcon, LineChart as LineChartIcon, Filter, Search, CreditCard as Edit, Trash2, Send, Plus, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useDesignerProfile } from '../hooks/useDesignerProfile';
import { supabase } from '../lib/supabase';
import ProjectImageUploader from '../components/ProjectImageUploader';

interface ProjectShare {
  id: string;
  project_id: string;
  customer_id: string;
  designer_email: string;
  designer_phone: string | null;
  message: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  project: {
    id: string;
    name: string;
    email: string;
    phone: string;
    location: string;
    project_name: string;
    property_type: string;
    project_area: string | null;
    budget_range: string;
    timeline: string;
    requirements: string;
    preferred_designer: string | null;
    layout_image_url: string | null;
    inspiration_links: string[];
    room_types: string[];
    special_requirements: string | null;
    status: string;
    created_at: string;
  };
}

interface AssignedProject {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  project_name: string;
  property_type: string;
  project_area: string | null;
  budget_range: string;
  timeline: string;
  requirements: string;
  preferred_designer: string | null;
  layout_image_url: string | null;
  inspiration_links: string[];
  room_types: string[];
  special_requirements: string | null;
  status: string;
  assignment_status: string;
  assigned_designer_id: string;
  created_at: string;
  updated_at: string;
}

const CustomerProjects = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { designer, isDesigner, loading: designerLoading, error: designerError } = useDesignerProfile();
  const [projectShares, setProjectShares] = useState<ProjectShare[]>([]);
  const [assignedProjects, setAssignedProjects] = useState<AssignedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'assigned' | 'shared'>('assigned');
  const [acceptedQuotes, setAcceptedQuotes] = useState<any[]>([]);
  const [projectQuotes, setProjectQuotes] = useState<Record<string, any>>({});
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [showImageUploader, setShowImageUploader] = useState(false);
  const [selectedProjectForUpload, setSelectedProjectForUpload] = useState<AssignedProject | null>(null);

interface Quote {
  id: string;
  designer_id: string;
  project_id: string;
  quote_number: string;
  title: string;
  description: string;
  subtotal: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  valid_until: string;
  terms_and_conditions: string;
  notes: string;
  created_at: string;
  updated_at: string;
  acceptance_date?: string;
  customer_accepted?: boolean;
  customer_feedback?: string | null;
  items?: any[];
}

  // Debug logging for hook states
  useEffect(() => {
    console.log('CustomerProjects - Hook states:', {
      authLoading,
      designerLoading,
      user: user ? { id: user.id, email: user.email } : null,
      designer: designer ? { id: designer.id, email: designer.email, isActive: designer.is_active } : null,
      isDesigner,
      designerError
    });
  }, [authLoading, designerLoading, user, designer, isDesigner, designerError]);

  useEffect(() => {
    // Wait for both auth and designer loading to complete
    if (authLoading || designerLoading) {
      console.log('Still loading...', { authLoading, designerLoading });
      return;
    }
    
    if (!user) {
      console.log('No user, redirecting to home');
      navigate('/');
      return;
    }
    
    if (designerError) {
      console.log('Designer error:', designerError);
      setError(`Designer profile error: ${designerError}`);
      setLoading(false);
      return;
    }
    
    if (!isDesigner || !designer) {
      console.log('User is not a designer or designer data missing', { isDesigner, designer: !!designer });
      setError('You need to be a registered designer to view customer projects.');
      setLoading(false);
      return;
    }
    
    console.log('All checks passed, fetching projects');
    fetchProjects();
  }, [user, designer, isDesigner, authLoading, designerLoading, designerError, navigate]);

  // Realtime: refresh projects when quotes change (e.g. customer accepts/rejects)
  useEffect(() => {
    if (!designer) return;

    const channel = supabase
      .channel('designer-customer-projects-quotes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'designer_quotes',
          filter: `designer_id=eq.${designer.id}`,
        },
        () => {
          fetchProjects();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [designer]);

  const fetchProjects = async () => {
    if (!user || !designer) {
      console.log('Cannot fetch - missing user or designer');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setDebugInfo(null);
      
      console.log('Fetching projects for designer:', {
        designerId: designer.id,
        designerEmail: designer.email,
        userId: user.id,
        isActive: designer.is_active
      });

      // Fetch assigned projects (projects where assigned_designer_id is set and status is NOT 'shared')
      // This includes: assigned, pending, finalized, in_progress, completed
      console.log('Fetching assigned projects...');
      const { data: assignedData, error: assignedError } = await supabase
        .from('customers')
        .select('*')
        .eq('assigned_designer_id', designer.id)
        .neq('assignment_status', 'shared')
        .order('created_at', { ascending: false });

      if (assignedError) {
        console.error('Error fetching assigned projects:', assignedError);
        throw new Error(`Failed to fetch assigned projects: ${assignedError.message}`);
      }

      console.log('Assigned projects query result:', { assignedData });

      setAssignedProjects(assignedData || []);

      // Fetch quotes for assigned projects
      const assignedProjectIds = assignedData?.map(p => p.id) || [];
      let assignedQuotesData: any[] = [];
      if (assignedProjectIds.length > 0) {
        const { data: quotesData, error: quotesError } = await supabase
          .from('designer_quotes')
          .select(`
            *,
            items:quote_items(*)
          `)
          .eq('designer_id', designer.id)
          .in('project_id', assignedProjectIds)
          .order('created_at', { ascending: false });

        if (quotesError) {
          console.error('Error fetching assigned project quotes:', quotesError);
        } else {
          assignedQuotesData = quotesData || [];
        }
      }

      // Create a map of project_id to quotes for assigned projects
      if (assignedQuotesData && assignedQuotesData.length > 0) {
        const quotesMap: Record<string, any> = {};
        assignedQuotesData.forEach(quote => {
          // Store only accepted quotes in the map for display
          if (quote.customer_accepted) {
            quotesMap[quote.project_id] = quote;
          }
        });
        setProjectQuotes(quotesMap);
      }

      // Shared projects are either assigned to this designer or sent through project_shares.
      console.log('Fetching shared projects...');
      const [{ data: assignedShared, error: sharedError }, { data: shareRows, error: shareListError }] = await Promise.all([
        supabase
          .from('customers')
          .select('*')
          .eq('assigned_designer_id', designer.id)
          .eq('assignment_status', 'shared')
          .order('created_at', { ascending: false }),
        supabase
          .from('project_shares')
          .select('project_id')
          .eq('designer_email', designer.email),
      ]);
      const sharedIds = new Set((assignedShared || []).map((project) => project.id));
      const extraIds = [...new Set((shareRows || []).map((row) => row.project_id).filter((id): id is string => Boolean(id) && !sharedIds.has(id)))];
      let extraShared: typeof assignedShared = [];
      if (extraIds.length > 0) {
        const { data: extraRows, error: extraError } = await supabase
          .from('customers')
          .select('*')
          .in('id', extraIds)
          .eq('assignment_status', 'shared');
        if (extraError) console.error('Error fetching shared project rows:', extraError);
        else extraShared = extraRows || [];
      }
      const sharedData = [...(assignedShared || []), ...(extraShared || [])];
      if (shareListError) console.error('Error fetching project shares:', shareListError);

      console.log('Shared projects query result:', { sharedData, sharedError });

      if (sharedError) {
        console.error('Error fetching shared projects:', sharedError);
        console.warn('Could not fetch shared projects, continuing with assigned projects only');
        setProjectShares([]);
      } else {
        // Transform shared projects to match ProjectShare interface
        const transformedShared = sharedData?.map(project => ({
          id: project.id,
          project_id: project.id,
          customer_id: project.user_id,
          designer_email: designer.email,
          designer_phone: null,
          message: null,
          status: 'shared',
          created_at: project.created_at,
          updated_at: project.updated_at,
          project: project
        })) || [];
        setProjectShares(transformedShared);
      }

      // Fetch quotes for shared projects
      const sharedProjectIds = sharedData?.map(s => s.id) || [];
      let sharedQuotesData: any[] = [];
      if (sharedProjectIds.length > 0) {
        const { data: quotesData, error: quotesError } = await supabase
          .from('designer_quotes')
          .select(`
            *,
            items:quote_items(*)
          `)
          .eq('designer_id', designer.id)
          .in('project_id', sharedProjectIds)
          .order('created_at', { ascending: false });

        if (quotesError) {
          console.error('Error fetching shared project quotes:', quotesError);
        } else {
  sharedQuotesData = quotesData || [];

  console.log('DEBUG sharedProjectIds:', sharedProjectIds);
  console.log('DEBUG sharedQuotesData:', sharedQuotesData);
}
      }

      // Set accepted quotes from both assigned and shared
      setAcceptedQuotes([...assignedQuotesData, ...sharedQuotesData]);

      setDebugInfo({
        designerInfo: {
          id: designer.id,
          email: designer.email,
          userId: user.id,
          isActive: designer.is_active
        },
        assignedCount: assignedData?.length || 0,
        sharedCount: sharedData?.length || 0,
        totalProjects: (assignedData?.length || 0) + (sharedData?.length || 0)
      });

    } catch (error: any) {
      console.error('Error fetching projects:', error);
      setError(error.message || 'Failed to load customer projects');
      
      setDebugInfo({
        error: error.message,
        designerInfo: {
          email: designer?.email,
          userId: user?.id,
          isActive: designer?.is_active
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'shared':
        return 'bg-cyan-100 text-cyan-800';
      case 'assigned':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-orange-100 text-orange-800';
      case 'finalized':
        return 'bg-purple-100 text-purple-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'shared':
        return 'Shared';
      case 'assigned':
        return 'Assigned';
      case 'pending':
        return 'Pending';
      case 'finalized':
        return 'Finalized';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Pending';
    }
  };

  
  // Show loading while auth or designer data is loading
  if (authLoading || designerLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {authLoading ? 'Loading user...' : 'Loading designer profile...'}
          </p>
        </div>
      </div>
    );
  }

  // Show error if user is not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-secondary-800 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-4">You need to be signed in to view customer projects.</p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  // Show error if user is not a designer
  if (!isDesigner || !designer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-secondary-800 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-4">
            You need to be a registered designer to view customer projects.
          </p>
          {designerError && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 max-w-md mx-auto">
              <p className="text-sm">{designerError}</p>
            </div>
          )}
          <div className="flex space-x-4 justify-center">
            <button
              onClick={() => navigate('/register-designer')}
              className="btn-primary"
            >
              Register as Designer
            </button>
            <button
              onClick={() => navigate('/')}
              className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading customer projects...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-4xl mx-auto px-4">
          <div className="bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-lg mb-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <p className="font-medium">Error loading customer projects</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
          
          {debugInfo && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 text-left">
              <h3 className="font-medium text-gray-800 mb-2">Debug Information:</h3>
              <div className="text-xs text-gray-600 space-y-2">
                <div>
                  <strong>Designer Email:</strong> {debugInfo.designerInfo?.email}
                </div>
                <div>
                  <strong>User ID:</strong> {debugInfo.designerInfo?.userId}
                </div>
                <div>
                  <strong>Is Active:</strong> {debugInfo.designerInfo?.isActive ? 'Yes' : 'No'}
                </div>
                {debugInfo.error && (
                  <div>
                    <strong>Error Details:</strong> {debugInfo.error}
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="flex space-x-4 justify-center">
            <button
              onClick={fetchProjects}
              className="btn-primary flex items-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Try Again</span>
            </button>
            <button
              onClick={() => navigate('/')}
              className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalProjects = assignedProjects.length + projectShares.length;
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </button>
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-secondary-800 mb-4">
              Customer Projects
            </h1>
            <p className="text-lg text-gray-600">
              Projects assigned to you and shared by potential clients
            </p>
            {designer && (
              <p className="text-sm text-gray-500 mt-2">
                Designer: {designer.name} ({designer.email})
              </p>
            )}
            {debugInfo && (
              <p className="text-xs text-gray-400 mt-1">
                {debugInfo.assignedCount} assigned • {debugInfo.sharedCount} shared • {totalProjects} total
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-sm mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('assigned')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'assigned'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Assigned Projects ({assignedProjects.length})
              </button>
              <button
                onClick={() => setActiveTab('shared')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'shared'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Shared Projects ({projectShares.length})
              </button>
            </nav>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'assigned' ? (
          // Assigned Projects
          assignedProjects.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-white rounded-xl shadow-lg p-12">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <User className="w-12 h-12 text-gray-400" />
                </div>
                <h2 className="text-2xl font-bold text-secondary-800 mb-4">No Assigned Projects Yet</h2>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  When customers assign projects to you, they will appear here. 
                  Make sure your profile is complete and visible to attract more clients.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={() => navigate('/edit-designer-profile')}
                    className="btn-primary"
                  >
                    Update My Profile
                  </button>
                  <button
                    onClick={fetchProjects}
                    className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors flex items-center justify-center space-x-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assignedProjects.map((project) => {
              const acceptedQuote = acceptedQuotes.find(q => q.project_id === project.id);
              const projectQuotesForShare = acceptedQuotes.filter(q => q.project_id === project.id);
              return (
                <div key={project.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
                  {/* Project Header */}
                  <div className="p-6 border-b border-gray-100">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-xl font-semibold text-secondary-800 line-clamp-2">
                        {project.project_name}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(project.assignment_status || 'assigned')}`}>
                        {getStatusText(project.assignment_status || 'assigned')}
                      </span>
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                      {project.requirements}
                    </p>

                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4" />
                        <span>{project.location}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Rupee className="w-4 h-4" />
                        <span>{project.budget_range}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4" />
                        <span>{project.timeline}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4" />
                        <span>Assigned {new Date(project.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Customer Details */}
                  <div className="p-6 bg-gray-50">
                    <h4 className="font-semibold text-secondary-800 mb-3">Customer Details</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center space-x-2 text-gray-600">
                        <User className="w-4 h-4" />
                        <span>{project.name}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-600">
                        <Mail className="w-4 h-4" />
                        <a href={`mailto:${project.email}`} className="text-primary-600 hover:text-primary-700">
                          {project.email}
                        </a>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-600">
                        <Phone className="w-4 h-4" />
                        <a href={`tel:${project.phone}`} className="text-primary-600 hover:text-primary-700">
                          {project.phone}
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Accepted Quote Information */}
                  {projectQuotes[project.id] && (
                    <div className="px-6 py-4 bg-green-50 border-b border-gray-100">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-green-800">
                            Quote #{projectQuotes[project.id].quote_number} Accepted
                          </p>
                          <div className="flex items-center space-x-4 mt-1">
                            <p className="text-sm text-green-700 font-medium">
                              ₹{projectQuotes[project.id].total_amount.toLocaleString()}
                            </p>
                            <p className="text-xs text-green-600">
                              Accepted on {new Date(projectQuotes[project.id].acceptance_date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Accepted Quote Info */}
                  {acceptedQuotes.find(q => q.project_id === project.id) && (
                    <div className="p-6 bg-green-50 border-b border-gray-100">
                      <div className="flex items-center space-x-3 hover:bg-green-100 p-2 rounded-lg transition-colors">
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                          <FileText className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-green-800 flex items-center space-x-2">
                            <span>Accepted Quote: ₹{acceptedQuotes.find(q => q.project_id === project.id).total_amount.toLocaleString()}</span>
                            <CheckCircle className="w-4 h-4" />
                          </p>
                          <p className="text-sm text-green-600">
                            Accepted on {new Date(acceptedQuotes.find(q => q.project_id === project.id).acceptance_date).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-green-700 mt-1">
                            Quote #{acceptedQuotes.find(q => q.project_id === project.id).quote_number}
                          </p>
                        </div>
                        <div className="ml-auto">
                          <button
                            onClick={() => setSelectedQuote(acceptedQuote)}
                          //  onClick={() => navigate(`/generate-quote/${project.id}`)}
                            className="text-green-700 hover:text-green-800 text-sm font-medium"
                          >
                            View Quote
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Project Details */}
                  <div className="p-6">
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">Property:</span> {project.property_type}
                      </p>
                      {project.project_area && (
                        <p className="text-sm text-gray-600 mb-2">
                          <span className="font-medium">Area:</span> {project.project_area}
                        </p>
                      )}
                      {project.preferred_designer && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Preferred Designer:</span> {project.preferred_designer}
                        </p>
                      )}
                    </div>

                    {/* Room Types */}
                    {project.room_types && project.room_types.length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Rooms:</p>
                        <div className="flex flex-wrap gap-1">
                          {project.room_types.slice(0, 3).map((room, index) => (
                            <span key={index} className="bg-accent-100 text-accent-800 px-2 py-1 rounded-md text-xs">
                              {room}
                            </span>
                          ))}
                          {project.room_types.length > 3 && (
                            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md text-xs">
                              +{project.room_types.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => navigate(`/project-detail/${project.id}`)}
                        className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2 px-3 rounded-lg font-medium transition-colors text-center"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => navigate(`/project-detail/${project.id}?tab=updates`)}
                        className="bg-green-500 hover:bg-green-600 text-white py-2 px-3 rounded-lg font-medium transition-colors"
                        title="Add Updates"
                      >
                        <Upload className="w-4 h-4" />
                      </button>
                      {projectQuotesForShare.length > 0 && (
                        <button
                          onClick={() => navigate(`/project-bill/${project.id}`)}
                          className="bg-teal-500 hover:bg-teal-600 text-white py-2 px-3 rounded-lg font-medium transition-colors flex items-center gap-1"
                          title="Manage Bill"
                        >
                          <FileText className="w-4 h-4" />
                          <span className="text-xs">Bill</span>
                        </button>
                      )}
                      {project.assignment_status === 'completed' && (
                        <button
                          onClick={() => {
                            setSelectedProjectForUpload(project);
                            setShowImageUploader(true);
                          }}
                          className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded-lg font-medium transition-colors"
                          title="Upload Gallery Images"
                        >
                          <ImageIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
              )})}
            </div>
          )
        ) : (
          // Shared Projects (existing code)
          projectShares.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-white rounded-xl shadow-lg p-12">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <MessageSquare className="w-12 h-12 text-gray-400" />
                </div>
                <h2 className="text-2xl font-bold text-secondary-800 mb-4">No Shared Projects Yet</h2>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  When customers share their projects with you via email, they will appear here. 
                  Make sure your profile is complete and visible to attract more clients.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={() => navigate('/edit-designer-profile')}
                    className="btn-primary"
                  >
                    Update My Profile
                  </button>
                  <button
                    onClick={fetchProjects}
                    className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors flex items-center justify-center space-x-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projectShares.map((share) => {
                const projectQuotesForShare = acceptedQuotes.filter(q => q.project_id === share.project_id);
                return (
                <div key={share.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
                  {/* Project Header */}
                  <div className="p-6 border-b border-gray-100">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-xl font-semibold text-secondary-800 line-clamp-2">
                        {share.project.project_name}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(share.project.status)}`}>
                        {getStatusText(share.project.status)}
                      </span>
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                      {share.project.requirements}
                    </p>

                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4" />
                        <span>{share.project.location}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Rupee className="w-4 h-4" />
                        <span>{share.project.budget_range}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4" />
                        <span>{share.project.timeline}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4" />
                        <span>Shared {new Date(share.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Customer Details */}
                  <div className="p-6 bg-gray-50">
                    <h4 className="font-semibold text-secondary-800 mb-3">Customer Details</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center space-x-2 text-gray-600">
                        <User className="w-4 h-4" />
                        <span>{share.project.name}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-600">
                        <Mail className="w-4 h-4" />
                        <a href={`mailto:${share.project.email}`} className="text-primary-600 hover:text-primary-700">
                          {share.project.email}
                        </a>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-600">
                        <Phone className="w-4 h-4" />
                        <a href={`tel:${share.project.phone}`} className="text-primary-600 hover:text-primary-700">
                          {share.project.phone}
                        </a>
                      </div>
                    </div>

                    {share.message && (
                      <div className="mt-4 p-3 bg-white rounded-lg border">
                        <p className="text-sm font-medium text-gray-700 mb-1">Personal Message:</p>
                        <p className="text-sm text-gray-600">{share.message}</p>
                      </div>
                    )}
                  </div>

                  {/* Project Details */}
                  <div className="p-6">
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">Property:</span> {share.project.property_type}
                      </p>
                      {share.project.project_area && (
                        <p className="text-sm text-gray-600 mb-2">
                          <span className="font-medium">Area:</span> {share.project.project_area}
                        </p>
                      )}
                      {share.project.preferred_designer && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Preferred Designer:</span> {share.project.preferred_designer}
                        </p>
                      )}
                    </div>

                    {/* Room Types */}
                    {share.project.room_types && share.project.room_types.length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Rooms:</p>
                        <div className="flex flex-wrap gap-1">
                          {share.project.room_types.slice(0, 3).map((room, index) => (
                            <span key={index} className="bg-accent-100 text-accent-800 px-2 py-1 rounded-md text-xs">
                              {room}
                            </span>
                          ))}
                          {share.project.room_types.length > 3 && (
                            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md text-xs">
                              +{share.project.room_types.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Special Requirements */}
                    {share.project.special_requirements && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-1">Special Requirements:</p>
                        <p className="text-sm text-gray-600">{share.project.special_requirements}</p>
                      </div>
                    )}

                    {/* Quotes Section */}
                    {projectQuotesForShare.length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Your Quotes ({projectQuotesForShare.length}):</p>
                        <div className="space-y-2">
                          {projectQuotesForShare.map((quote) => (
                            <div key={quote.id} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-blue-900">{quote.title}</p>
                                  <div className="flex items-center space-x-3 mt-1">
                                    <p className="text-sm font-semibold text-blue-700">
                                      ₹{quote.total_amount.toLocaleString()}
                                    </p>
                                    {quote.status === 'rejected' ? (
                                      <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-xs font-medium flex items-center space-x-1">
                                        <XCircle className="w-3 h-3" />
                                        <span>Rejected</span>
                                      </span>
                                    ) : quote.customer_accepted ? (
                                      <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs font-medium flex items-center space-x-1">
                                        <CheckCircle className="w-3 h-3" />
                                        <span>Accepted</span>
                                      </span>
                                    ) : (
                                      <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full text-xs font-medium">
                                        Pending
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <button
                                  onClick={() => setSelectedQuote(quote)}
                                  className="ml-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => navigate(`/generate-quote/${share.project_id}`)}
                        className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2 px-3 rounded-lg font-medium transition-colors text-center flex items-center justify-center space-x-2"
                      >
                        <FileText className="w-4 h-4" />
                        <span>Create Quotation</span>
                      </button>
                      {projectQuotesForShare.some(q => q.customer_accepted === true) && (
                        <button
                          onClick={() => navigate(`/project-bill/${share.project_id}`)}
                          className="bg-teal-500 hover:bg-teal-600 text-white py-2 px-3 rounded-lg font-medium transition-colors flex items-center gap-1"
                          title="Manage Bill"
                        >
                          <FileText className="w-4 h-4" />
                          <span className="text-xs">Bill</span>
                        </button>
                      )}
                      <a
                        href={`mailto:${share.project.email}?subject=Regarding your ${share.project.project_name} project&body=Hi ${share.project.name},%0D%0A%0D%0AThank you for sharing your project details with me. I would love to discuss your ${share.project.project_name} project further.%0D%0A%0D%0ABest regards,%0D%0A${designer.name}`}
                        className="bg-green-500 hover:bg-green-600 text-white py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center"
                        title="Contact Customer"
                      >
                        <Mail className="w-4 h-4" />
                      </a>
                      <a
                        href={`tel:${share.project.phone}`}
                        className="bg-secondary-500 hover:bg-secondary-600 text-white py-2 px-3 rounded-lg font-medium transition-colors"
                        title="Call Customer"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          )
        )}
      </div>
      {selectedQuote && (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
      <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-secondary-800">Quote Details</h2>
        <button
          onClick={() => setSelectedQuote(null)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <XCircle className="w-6 h-6" />
        </button>
      </div>

      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-semibold text-secondary-800">{selectedQuote.title}</h3>
            <span className="text-2xl font-bold text-primary-600">
              ₹{selectedQuote.total_amount.toLocaleString('en-IN')}
            </span>
          </div>
          <p className="text-gray-600">{selectedQuote.description}</p>
          <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
            <div className="flex items-center space-x-1">
              <Calendar className="w-4 h-4" />
              <span>Created: {new Date(selectedQuote.created_at).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Clock className="w-4 h-4" />
              <span>Valid until: {new Date(selectedQuote.valid_until).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-6">
          <h4 className="font-semibold text-secondary-800 mb-3">Quote Items</h4>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Item</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Description</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Qty</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Unit Price</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {selectedQuote.items?.length > 0 ? selectedQuote.items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm font-medium text-gray-800">{item.name}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{item.description}</td>
                    <td className="py-3 px-4 text-sm text-gray-600 text-right">{item.quantity} {item.unit}</td>
                    <td className="py-3 px-4 text-sm text-gray-600 text-right">₹{item.unit_price.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 text-sm font-medium text-gray-800 text-right">₹{item.amount.toLocaleString('en-IN')}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="py-3 px-4 text-sm text-gray-500 text-center">No items available</td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={4} className="py-3 px-4 text-sm font-semibold text-gray-700 text-right">Subtotal</td>
                  <td className="py-3 px-4 text-sm font-semibold text-gray-700 text-right">₹{selectedQuote.subtotal.toLocaleString('en-IN')}</td>
                </tr>
                {selectedQuote.discount_amount > 0 && (
                  <tr>
                    <td colSpan={4} className="py-3 px-4 text-sm font-semibold text-gray-700 text-right">Discount</td>
                    <td className="py-3 px-4 text-sm font-semibold text-green-600 text-right">-₹{selectedQuote.discount_amount.toLocaleString('en-IN')}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={4} className="py-3 px-4 text-sm font-semibold text-gray-700 text-right">
                    Tax ({selectedQuote.tax_rate}%)
                  </td>
                  <td className="py-3 px-4 text-sm font-semibold text-gray-700 text-right">₹{selectedQuote.tax_amount.toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                  <td colSpan={4} className="py-3 px-4 text-base font-bold text-secondary-800 text-right">Total</td>
                  <td className="py-3 px-4 text-base font-bold text-primary-600 text-right">₹{selectedQuote.total_amount.toLocaleString('en-IN')}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {selectedQuote.terms_and_conditions && (
          <div className="mb-6">
            <h4 className="font-semibold text-secondary-800 mb-3">Terms & Conditions</h4>
            <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600">
              {selectedQuote.terms_and_conditions}
            </div>
          </div>
        )}

        {selectedQuote.status === 'rejected' && selectedQuote.customer_feedback && (
          <div className="mb-6">
            <h4 className="font-semibold text-secondary-800 mb-3">Customer Feedback</h4>
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg text-sm text-red-800">
              <div className="flex items-start space-x-2">
                <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900 mb-1">This quote was rejected by the customer</p>
                  <p className="text-red-700">{selectedQuote.customer_feedback}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={() => setSelectedQuote(null)}
            className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-medium hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
)}

      {/* Image Uploader Modal */}
      {showImageUploader && selectedProjectForUpload && (
        <ProjectImageUploader
          projectId={selectedProjectForUpload.id}
          projectName={selectedProjectForUpload.project_name}
          onClose={() => {
            setShowImageUploader(false);
            setSelectedProjectForUpload(null);
          }}
          onUploadComplete={() => {
            fetchProjects();
          }}
        />
      )}

    </div>
  );
};

export default CustomerProjects;