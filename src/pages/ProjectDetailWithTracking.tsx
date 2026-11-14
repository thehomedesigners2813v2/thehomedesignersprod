import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard as Edit, UserPlus, Clock, MapPin, IndianRupee as Rupee, User, Phone, Mail, AlertCircle, Compass, Camera, RefreshCw, FileText, CheckCircle, Calendar, Package } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useDesignerProfile } from '../hooks/useDesignerProfile';
import { useProjectTracking } from '../hooks/useProjectTracking';
import { supabase } from '../lib/supabase';
import type { Customer } from '../lib/supabase';
import ProjectUpdateForm from '../components/ProjectUpdateForm';
import ProjectUpdates from '../components/ProjectUpdates';
import ProjectStatusUpdate from '../components/ProjectStatusUpdate';
import ProjectTeamManagement from '../components/ProjectTeamManagement';
import ProjectActivityLog from '../components/ProjectActivityLog';
import ProjectVersionHistory from '../components/ProjectVersionHistory';
import AssignProjectModal from '../components/AssignProjectModal';
import VastuAnalysisModal from '../components/VastuAnalysisModal';

const ProjectDetailWithTracking = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { designer, isDesigner, loading: designerLoading } = useDesignerProfile();
  const { activities, versions, assignments, loading: trackingLoading, refreshData } = useProjectTracking(id);
  
  const [project, setProject] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showVastuModal, setShowVastuModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'activity' | 'versions'>('details');
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [updateRefreshKey, setUpdateRefreshKey] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [acceptedQuote, setAcceptedQuote] = useState<any>(null);
  const [quoteItems, setQuoteItems] = useState<any[]>([]);

  // Check if there's a tab parameter in the URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab && ['details', 'activity', 'versions', 'updates'].includes(tab)) {
      setActiveTab(tab as any);
    }
  }, []);

  // Re-fetch only when the project ID changes, refreshKey is bumped,
  // or auth state transitions (user?.id changes from null to a real ID,
  // designerLoading flips). Using user?.id (a string primitive) instead of
  // user (an object reference) prevents re-fetches from spurious auth
  // refreshes triggered by browser tab switches.
  useEffect(() => {
    if (id && user && !designerLoading) {
      fetchProject();
    }
  }, [id, user?.id, designerLoading, refreshKey]);

  const fetchProject = async () => {
    if (!id || !user) return;

    try {
      setLoading(true);
      setError(null);

      // Build query that works with RLS policies
      let query = supabase
        .from('customers')
        .select(`
          *,
          assigned_designer:designers(id, name, email, phone, specialization)
        `)
        .eq('id', id);

      // The RLS policies will automatically filter based on:
      // 1. user_id = uid() for customers
      // 2. assigned_designer_id matching the designer's ID for designers
      // So we don't need to add additional filters here

      const { data, error } = await query.maybeSingle();

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      if (!data) {
        throw new Error('Project not found or you do not have access to this project');
      }

      setProject(data);

      // Fetch accepted quote if any
      const { data: quoteData, error: quoteError } = await supabase
        .from('designer_quotes')
        .select('*')
        .eq('project_id', id)
        .eq('customer_accepted', true)
        .eq('status', 'accepted')
        .maybeSingle();

      if (quoteError) {
        console.error('Error fetching quote:', quoteError);
      } else if (quoteData) {
        setAcceptedQuote(quoteData);

        // Fetch line items for this quote
        const { data: itemsData } = await supabase
          .from('quote_items')
          .select('*')
          .eq('quote_id', quoteData.id)
          .order('created_at', { ascending: true });

        if (itemsData) setQuoteItems(itemsData);
      }
      
    } catch (error: any) {
      console.error('Error fetching project:', error);
      setError(error.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignSuccess = () => {
    fetchProject();
    refreshData();
    setRefreshKey(prev => prev + 1);
  };

  const handleStatusUpdate = () => {
    fetchProject();
    refreshData();
    setRefreshKey(prev => prev + 1);
    setUpdateRefreshKey(prev => prev + 1);
  };

  const handleUpdateSuccess = () => {
    setShowUpdateForm(false);
    setUpdateRefreshKey(prev => prev + 1);
  };

  const isProjectOwner = project?.user_id === user?.id;
  const isAssignedDesigner = isDesigner && project?.assigned_designer_id === designer?.id;
  const hasAcceptedQuote = acceptedQuote !== null;
  const isCompleted = project?.assignment_status === 'completed';
  // Customers cannot edit after quote acceptance, designers can still update but not when completed
  const canEdit = !isCompleted && (isAssignedDesigner || (isProjectOwner && !hasAcceptedQuote));

  if (loading || designerLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading project details...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-lg mb-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5" />
              <p className="font-medium">Error loading project</p>
            </div>
            <p className="text-sm mt-1">{error || 'Project not found'}</p>
          </div>
          <button
            onClick={() => navigate(isDesigner ? '/customer-projects' : '/my-projects')}
            className="btn-primary"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={() => navigate(isDesigner ? '/customer-projects' : '/my-projects')}
            className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Projects
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-secondary-800 mb-2">
                {project.project_name}
              </h1>
              <div className="flex items-center space-x-4 text-gray-600">
                <div className="flex items-center space-x-1">
                  <MapPin className="w-4 h-4" />
                  <span>{project.location}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Rupee className="w-4 h-4" />
                  <span>{project.budget_range}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="w-4 h-4" />
                  <span>{project.timeline}</span>
                </div>
              </div>
            </div>
            
            <div className="flex space-x-3">
              {canEdit && (
                <button
                  onClick={() => navigate(`/edit-project/${project.id}`)}
                  className="bg-secondary-500 hover:bg-secondary-600 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center space-x-2"
                >
                  <Edit className="w-4 h-4" />
                  <span>Edit Project</span>
                </button>
              )}

              {isAssignedDesigner && !isCompleted && (
                <button
                  onClick={() => setActiveTab('updates')}
                  className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center space-x-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>Add Updates</span>
                </button>
              )}
              
              {isProjectOwner && !project.assigned_designer_id && (
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="btn-primary flex items-center space-x-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Assign Designer</span>
                </button>
              )}
              
              {project.layout_image_url && (
                <button
                  onClick={() => setShowVastuModal(true)}
                  className="bg-accent-500 hover:bg-accent-600 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center space-x-2"
                >
                  <Compass className="w-4 h-4" />
                  <span>Vastu Analysis</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-lg mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {['details', 'updates', 'activity', 'versions'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors ${
                    activeTab === tab
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab === 'details' ? 'Project Details' : tab}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'details' && (
              <div className="space-y-6">
                {/* Completion Notice - Visible to everyone when project is completed */}
                {isCompleted && (
                  <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6">
                    <div className="flex items-start space-x-3">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="w-7 h-7 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-green-800 mb-2">
                          Project Completed
                        </h3>
                        <p className="text-green-700 mb-3">
                          This project has been marked as completed. All project details, status updates, and editing capabilities are now locked to preserve the final state.
                        </p>
                        <div className="bg-white border border-green-200 rounded-lg p-3">
                          <p className="text-sm text-green-800 font-medium mb-1">Locked Features:</p>
                          <ul className="text-sm text-green-700 space-y-1 ml-4 list-disc">
                            <li>Project details cannot be edited</li>
                            <li>Status cannot be changed</li>
                            <li>New updates cannot be added</li>
                            <li>Team assignments are frozen</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Project Status Update - Only visible to assigned designers */}
                {isAssignedDesigner && (
                  <ProjectStatusUpdate
                    projectId={project.id}
                    currentStatus={project.assignment_status || 'assigned'}
                    onStatusUpdate={handleStatusUpdate}
                    refreshTrigger={updateRefreshKey}
                  />
                )}
                
                {/* Project Team Management - Only visible to assigned designers when project is finalized */}
                {isAssignedDesigner && (
                  <ProjectTeamManagement 
                    projectId={project.id} 
                    currentStatus={project.assignment_status || 'assigned'} 
                  />
                )}

                {/* Project Status */}
                {project.assigned_designer_id && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <User className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-medium text-green-800">
                          Assigned to {(project as any).assigned_designer?.name}
                        </p>
                        <p className="text-sm text-green-600">
                          Specialization: {(project as any).assigned_designer?.specialization}
                        </p>
                        <div className="flex items-center space-x-4 mt-2 text-sm">
                          <a
                            href={`mailto:${(project as any).assigned_designer?.email}`}
                            className="flex items-center space-x-1 text-green-600 hover:text-green-700"
                          >
                            <Mail className="w-3 h-3" />
                            <span>{(project as any).assigned_designer?.email}</span>
                          </a>
                          {(project as any).assigned_designer?.phone && (
                            <a
                              href={`tel:${(project as any).assigned_designer?.phone}`}
                              className="flex items-center space-x-1 text-green-600 hover:text-green-700"
                            >
                              <Phone className="w-3 h-3" />
                              <span>{(project as any).assigned_designer?.phone}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Accepted Quote */}
                {acceptedQuote && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <FileText className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-green-800">Accepted Quote</h3>
                        <p className="text-sm text-green-600">
                          Accepted on {new Date(acceptedQuote.acceptance_date).toLocaleDateString()}
                        </p>
                        <div className="flex items-center space-x-2 mt-2 text-xs text-green-700">
                          <Calendar className="w-3 h-3" />
                          <span>Valid until: {acceptedQuote.valid_until ? new Date(acceptedQuote.valid_until).toLocaleDateString() : 'Not specified'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-lg border border-green-200 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-medium text-gray-700">{acceptedQuote.title}</p>
                          <p className="text-sm text-gray-500">{acceptedQuote.quote_number}</p>
                        </div>
                        <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm flex items-center space-x-1">
                          <CheckCircle className="w-4 h-4" />
                          <span>Accepted</span>
                        </div>
                      </div>
                      
                      {acceptedQuote.description && (
                        <p className="text-gray-600 text-sm mb-4">{acceptedQuote.description}</p>
                      )}
                      
                      <div className="border-t border-gray-100 pt-3 mt-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Subtotal</p>
                            <p className="font-medium">₹{acceptedQuote.subtotal.toLocaleString()}</p>
                          </div>
                          {acceptedQuote.discount_amount > 0 && (
                            <div>
                              <p className="text-sm text-gray-500">Discount</p>
                              <p className="font-medium text-green-600">-₹{acceptedQuote.discount_amount.toLocaleString()}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-sm text-gray-500">Tax ({acceptedQuote.tax_rate}%)</p>
                            <p className="font-medium">₹{acceptedQuote.tax_amount.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 font-medium">Total Amount</p>
                            <p className="text-lg font-bold text-primary-600">₹{acceptedQuote.total_amount.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4 text-right">
                        <button
                          onClick={() => navigate(`/view-quote/${project.id}?id=${acceptedQuote.id}`)}
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center space-x-1 justify-end"
                        >
                          <FileText className="w-4 h-4" />
                          View Full Quote
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Project Locked Message for Customers */}
                {isProjectOwner && hasAcceptedQuote && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-blue-800 mb-1">Project Details Locked</h4>
                        <p className="text-sm text-blue-700">
                          Since you have accepted a quote, the project details are now locked to maintain the scope of work.
                          If you need to make changes, please contact your assigned designer directly.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Project Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold text-secondary-800 mb-4 flex items-center space-x-2">
                      <User className="w-5 h-5 text-primary-600" />
                      <span>Basic Information</span>
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Property Type</p>
                        <p className="text-gray-600">{project.property_type}</p>
                      </div>
                      {project.project_area && (
                        <div>
                          <p className="text-sm font-medium text-gray-700">Project Area</p>
                          <p className="text-gray-600">{project.project_area}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-700">Status</p>
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                          project.assignment_status === 'completed' ? 'bg-green-100 text-green-800' :
                          project.assignment_status === 'in_progress' ? 'bg-orange-100 text-orange-800' :
                          project.assignment_status === 'finalized' ? 'bg-purple-100 text-purple-800' :
                          project.assignment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          project.assignment_status === 'assigned' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {project.assignment_status ? project.assignment_status.replace('_', ' ').charAt(0).toUpperCase() + project.assignment_status.replace('_', ' ').slice(1) : 'Unassigned'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-secondary-800 mb-4 flex items-center space-x-2">
                      <Phone className="w-5 h-5 text-primary-600" />
                      <span>Contact Information</span>
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Customer Name</p>
                        <p className="text-gray-600">{project.name}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">Email</p>
                        <p className="text-gray-600">{project.email}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">Phone</p>
                        <p className="text-gray-600">{project.phone}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Requirements */}
                <div>
                  <h3 className="text-lg font-semibold text-secondary-800 mb-4">Project Requirements</h3>
                  <p className="text-gray-600 leading-relaxed">{project.requirements}</p>
                </div>

                {/* Room Types */}
                {project.room_types && project.room_types.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-secondary-800 mb-4">Rooms to Design</h3>
                    <div className="flex flex-wrap gap-2">
                      {project.room_types.map((room, index) => (
                        <span key={index} className="bg-accent-100 text-accent-800 px-3 py-1 rounded-full text-sm">
                          {room}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Special Requirements */}
                {project.special_requirements && (
                  <div>
                    <h3 className="text-lg font-semibold text-secondary-800 mb-4">Special Requirements</h3>
                    <p className="text-gray-600 leading-relaxed">{project.special_requirements}</p>
                  </div>
                )}

                {/* Project Schedule & Pricing */}
                {Boolean((project as any).work_begin_date || (project as any).work_end_date || ((project as any).per_day_discount && (project as any).per_day_discount > 0)) && (
                  <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
                    <h3 className="text-lg font-semibold text-secondary-800 mb-4 flex items-center space-x-2">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      <span>Project Schedule & Pricing</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {(project as any).work_begin_date && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-1">Work Begin Date</p>
                          <div className="flex items-center space-x-2 text-gray-600">
                            <Calendar className="w-4 h-4 text-green-600" />
                            <span className="font-medium">
                              {new Date((project as any).work_begin_date).toLocaleDateString('en-IN', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                        </div>
                      )}

                      {(project as any).work_end_date && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-1">Work End Date</p>
                          <div className="flex items-center space-x-2 text-gray-600">
                            <CheckCircle className="w-4 h-4 text-blue-600" />
                            <span className="font-medium">
                              {new Date((project as any).work_end_date).toLocaleDateString('en-IN', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                        </div>
                      )}

                      {(project as any).per_day_discount && (project as any).per_day_discount > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-1">Per Day Discount</p>
                          <div className="flex items-center space-x-2">
                            <Rupee className="w-4 h-4 text-green-600" />
                            <span className="font-semibold text-green-600 text-lg">
                              {(project as any).per_day_discount.toLocaleString('en-IN', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}
                            </span>
                            <span className="text-sm text-gray-500">per day</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Inspiration Links */}
                {project.inspiration_links && project.inspiration_links.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-secondary-800 mb-4">Inspiration Links</h3>
                    <div className="space-y-2">
                      {project.inspiration_links.map((link, index) => (
                        <a
                          key={index}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-primary-600 hover:text-primary-700 text-sm break-all"
                        >
                          {link}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}

            {activeTab === 'updates' && (
              <div className="space-y-6">
                {/* Completion Notice */}
                {isCompleted && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-green-800 mb-1">Project Completed</h4>
                        <p className="text-sm text-green-700">
                          This project is completed. No new updates can be added. You can view all existing updates below.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Show update form button for assigned designers (only if not completed) */}
                {isAssignedDesigner && !isCompleted && (
                  <ProjectUpdateForm
                    projectId={project.id}
                    designerId={designer!.id}
                    onSuccess={handleUpdateSuccess}
                    onCancel={() => setShowUpdateForm(false)}
                  />
                )}

                {/* Project Updates List */}
                <ProjectUpdates
                  projectId={project.id}
                  refreshTrigger={updateRefreshKey}
                />
              </div>
            )}

            {activeTab === 'activity' && (
              <ProjectActivityLog activities={activities} loading={trackingLoading} />
            )}

            {activeTab === 'versions' && (
              <ProjectVersionHistory versions={versions} loading={trackingLoading} />
            )}
          </div>
        </div>
      </div>

      {/* Assign Project Modal */}
      <AssignProjectModal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        project={project}
        onSuccess={handleAssignSuccess}
      />
      
      {/* Vastu Analysis Modal */}
      <VastuAnalysisModal
        isOpen={showVastuModal}
        onClose={() => setShowVastuModal(false)}
        projectId={project.id}
        existingLayoutUrl={project.layout_image_url || undefined}
      />
    </div>
  );
};

export default ProjectDetailWithTracking;