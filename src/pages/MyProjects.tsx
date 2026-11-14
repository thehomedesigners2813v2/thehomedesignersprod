import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Calendar, MapPin, IndianRupee as Rupee, Clock, Pencil, Eye, Trash2, AlertCircle, Send, Activity, Compass, FileText, CheckCircle, MessageSquare } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import type { Customer } from '../lib/supabase';
import AssignProjectModal from '../components/AssignProjectModal';
import SendToDesignerModal from '../components/SendToDesignerModal';
import VastuAnalysisModal from '../components/VastuAnalysisModal';
import TestimonialFeedbackModal from '../components/TestimonialFeedbackModal';
import PaymentOptionsModal from '../components/payments/PaymentOptionsModal';

const MyProjects = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Customer | null>(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showVastuModal, setShowVastuModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [acceptedQuotes, setAcceptedQuotes] = useState<any[]>([]);
  const [projectQuotes, setProjectQuotes] = useState<Record<string, any>>({});
  const [projectHasQuotes, setProjectHasQuotes] = useState<Record<string, boolean>>({});
  const [projectHasFeedback, setProjectHasFeedback] = useState<Record<string, boolean>>({});
  const [paymentAsks, setPaymentAsks] = useState<Record<string, { id: string; amount: number; status: string }>>({});
  const [payingProjectId, setPayingProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate('/');
      return;
    }
    
    fetchProjects();
  }, [user, authLoading, navigate]);

  const fetchProjects = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('customers')
        .select(`
          id, name, email, phone, location, project_name, property_type, project_area, 
          budget_range, timeline, requirements, preferred_designer, layout_image_url, 
          inspiration_links, room_types, special_requirements, status, created_at, 
          updated_at, version, assigned_designer_id, assignment_status, last_modified_by,
          assigned_designer:designers(id, name, email, specialization)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching projects:', error);
        throw error;
      }

      setProjects(data || []);

      // Fetch all quotes for these projects
      if (data && data.length > 0) {
        const projectIds = data.map(p => p.id);

        // Get all quotes (to check which projects have quotes)
        const { data: allQuotesData, error: allQuotesError } = await supabase
          .from('designer_quotes')
          .select('project_id')
          .in('project_id', projectIds);

        if (!allQuotesError && allQuotesData) {
          const hasQuotesMap: Record<string, boolean> = {};
          allQuotesData.forEach(quote => {
            hasQuotesMap[quote.project_id] = true;
          });
          setProjectHasQuotes(hasQuotesMap);
        }

        // Get accepted quotes
        const { data: quotesData, error: quotesError } = await supabase
          .from('designer_quotes')
          .select('*')
          .in('project_id', projectIds)
          .eq('customer_accepted', true)
          .eq('status', 'accepted');

        if (quotesError) {
          console.error('Error fetching quotes:', quotesError);
        } else if (quotesData) {
          setAcceptedQuotes(quotesData || []);
          // Create a map of project_id to quote
          const quotesMap: Record<string, any> = {};
          quotesData.forEach(quote => {
            quotesMap[quote.project_id] = quote;
          });
          setProjectQuotes(quotesMap);
        }

        // Check for existing feedback/reviews
        const { data: reviewsData, error: reviewsError } = await supabase
          .from('reviews')
          .select('project_id')
          .in('project_id', projectIds)
          .eq('customer_id', user.id);

        if (!reviewsError && reviewsData) {
          const hasFeedbackMap: Record<string, boolean> = {};
          reviewsData.forEach(review => {
            hasFeedbackMap[review.project_id] = true;
          });
          setProjectHasFeedback(hasFeedbackMap);
        }

        const { data: askData } = await supabase
          .from('project_payment_requests')
          .select('id, project_id, amount, status')
          .in('project_id', projectIds)
          .in('status', ['requested', 'awaiting_review']);

        const askMap: Record<string, { id: string; amount: number; status: string }> = {};
        (askData || []).forEach((ask) => {
          askMap[ask.project_id] = ask;
        });
        setPaymentAsks(askMap);
      }
    } catch (error: any) {
      console.error('Error fetching projects:', error);
      setError(error.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm(
      'Warning: Deleting this project will lose the sync of the project — all assigned designer details, quotes, activity history, and design data linked to it will be permanently removed.\n\nThis action cannot be undone. Are you sure you want to delete this project?'
    )) {
      return;
    }

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', projectId)
        .eq('user_id', user?.id); // Extra security check

      if (error) throw error;

      // Re-fetch from DB to ensure state matches actual DB state
      await fetchProjects();
    } catch (error: any) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project: ' + error.message);
    }
  };

  const handleAssignToDesigner = (project: Customer) => {
    setSelectedProject(project);
    setShowAssignModal(true);
  };

  const handleSendToDesigner = (project: Customer) => {
    setSelectedProject(project);
    setShowSendModal(true);
  };

  const handleVastuAnalysis = (project: Customer) => {
    setSelectedProject(project);
    setShowVastuModal(true);
  };

  const handleLeaveFeedback = (project: Customer) => {
    setSelectedProject(project);
    setShowFeedbackModal(true);
  };

  const handleAssignSuccess = () => {
    fetchProjects();
  };

  const handleFeedbackSuccess = () => {
    setShowFeedbackModal(false);
    setSelectedProject(null);
    fetchProjects();
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
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

  const getStatusText = (status: string, hasDesigner: boolean) => {
    if (!status || status === 'unassigned') {
      return hasDesigner ? 'Assigned' : 'Unassigned';
    }
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
        return status;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-secondary-800 mb-4">Please sign in to view your projects</h2>
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your projects...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-lg mb-4">
            <p className="font-medium">Error loading projects</p>
            <p className="text-sm">{error}</p>
          </div>
          <button
            onClick={fetchProjects}
            className="btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-secondary-800 mb-4">
                My Projects
              </h1>
              <p className="text-lg text-gray-600">
                Manage and track your interior design projects
              </p>
            </div>
            <button
              onClick={() => navigate('/register-customer')}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>New Project</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {projects.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-white rounded-xl shadow-lg p-12">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Plus className="w-12 h-12 text-gray-400" />
              </div>
              <h2 className="text-2xl font-bold text-secondary-800 mb-4">No Projects Yet</h2>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                Start your interior design journey by registering your first project. 
                Our expert designers are ready to bring your vision to life.
              </p>
              <button
                onClick={() => navigate('/register-customer')}
                className="btn-primary"
              >
                Register Your First Project
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div key={project.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
                {/* Project Header */}
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-xl font-semibold text-secondary-800 line-clamp-2">
                      {project.project_name}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(project.assignment_status || 'unassigned')}`}>
                      {getStatusText(project.assignment_status || 'unassigned', !!(project as any).assigned_designer)}
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
                      <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Designer Info */}
                {(project as any).assigned_designer && (
                  <div className="px-6 py-4 bg-green-50 border-b border-gray-100">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <Send className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-green-800">
                          Assigned to {(project as any).assigned_designer.name}
                        </p>
                        <p className="text-sm text-green-600">
                          {(project as any).assigned_designer.specialization}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Accepted Quote Information */}
                {projectQuotes[project.id] && (
                  <div className="px-6 py-4 bg-green-50 border-b border-gray-100">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-green-800">
                          Accepted Quote: {projectQuotes[project.id].title}
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

                  {/* This duplicate section is removed - handled below */}

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => navigate(`/project-detail/${project.id}`)}
                        className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-1"
                      >
                        <Activity className="w-4 h-4" />
                        <span>View Details</span>
                      </button>
                      {project.layout_image_url && (
                        <button
                          onClick={() => handleVastuAnalysis(project)}
                          className="bg-accent-500 hover:bg-accent-600 text-white py-2 px-3 rounded-lg font-medium transition-colors"
                          title="Vastu Analysis"
                        >
                          <Compass className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => navigate(`/edit-project/${project.id}`)}
                        className="bg-secondary-500 hover:bg-secondary-600 text-white py-2 px-3 rounded-lg font-medium transition-colors"
                        title="Edit project"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProject(project.id)}
                        className="bg-red-500 hover:bg-red-600 text-white py-2 px-3 rounded-lg font-medium transition-colors"
                        title="Delete Project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Action buttons based on project state */}
                    {projectQuotes[project.id] ? (
                      // Project has accepted quote
                      <div className="space-y-2">
                        <button
                          onClick={() => navigate(`/customer-quotes?projectId=${project.id}`)}
                          className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>View Accepted Quote</span>
                        </button>
                        <button
                          onClick={() => navigate(`/my-bill/${project.id}`)}
                          className="w-full bg-teal-500 hover:bg-teal-600 text-white py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                        >
                          <FileText className="w-4 h-4" />
                          <span>View Bill</span>
                        </button>
                        {paymentAsks[project.id]?.status === 'requested' && (
                          <button
                            onClick={() => setPayingProjectId(project.id)}
                            className="w-full bg-amber-500 hover:bg-amber-600 text-white py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                          >
                            <Rupee className="w-4 h-4" />
                            <span>Pay Rs {Number(paymentAsks[project.id].amount).toLocaleString('en-IN')}</span>
                          </button>
                        )}
                        {paymentAsks[project.id]?.status === 'awaiting_review' && (
                          <div className="w-full bg-amber-50 border border-amber-200 text-amber-800 py-2 px-3 rounded-lg text-sm text-center">
                            Payment proof is waiting for confirmation.
                          </div>
                        )}
                        {project.assignment_status === 'completed' && !projectHasFeedback[project.id] && (project as any).assigned_designer && (
                          <button
                            onClick={() => handleLeaveFeedback(project)}
                            className="w-full bg-amber-500 hover:bg-amber-600 text-white py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                          >
                            <MessageSquare className="w-4 h-4" />
                            <span>Leave Feedback</span>
                          </button>
                        )}
                        {project.assignment_status === 'completed' && projectHasFeedback[project.id] && (
                          <div className="w-full bg-green-100 border border-green-300 text-green-800 py-2 px-3 rounded-lg font-medium flex items-center justify-center space-x-2">
                            <CheckCircle className="w-4 h-4" />
                            <span>Feedback Submitted</span>
                          </div>
                        )}
                      </div>
                    ) : (project as any).assigned_designer ? (
                      // Project is assigned but no accepted quote
                      <button
                        onClick={() => navigate(`/customer-quotes?projectId=${project.id}`)}
                        className="w-full bg-secondary-500 hover:bg-secondary-600 text-white py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                      >
                        <FileText className="w-4 h-4" />
                        <span>View Quotes</span>
                      </button>
                    ) : projectHasQuotes[project.id] ? (
                      // Project has quotes but not assigned yet
                      <div className="space-y-2">
                        <button
                          onClick={() => navigate(`/customer-quotes?projectId=${project.id}`)}
                          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                        >
                          <FileText className="w-4 h-4" />
                          <span>View Quotes & Assign Designer</span>
                        </button>
                      </div>
                    ) : (
                      // No quotes yet, can send to designer
                      <button
                        onClick={() => handleSendToDesigner(project)}
                        className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                      >
                        <Send className="w-4 h-4" />
                        <span>Send to Designer</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assign Project Modal */}
      {selectedProject && (
        <AssignProjectModal
          isOpen={showAssignModal}
          onClose={() => {
            setShowAssignModal(false);
            setSelectedProject(null);
          }}
          project={selectedProject}
          onSuccess={handleAssignSuccess}
        />
      )}
      
      {/* Send to Designer Modal */}
      {selectedProject && (
        <SendToDesignerModal
          isOpen={showSendModal}
          onClose={() => {
            setShowSendModal(false);
            setSelectedProject(null);
          }}
          project={selectedProject}
        />
      )}
      
      {/* Vastu Analysis Modal */}
      {selectedProject && (
        <VastuAnalysisModal
          isOpen={showVastuModal}
          onClose={() => {
            setShowVastuModal(false);
            setSelectedProject(null);
          }}
          projectId={selectedProject.id}
          existingLayoutUrl={selectedProject.layout_image_url || undefined}
        />
      )}

      {/* Testimonial Feedback Modal */}
      {selectedProject && showFeedbackModal && (selectedProject as any).assigned_designer && (
        <TestimonialFeedbackModal
          projectId={selectedProject.id}
          projectName={selectedProject.project_name}
          designerId={(selectedProject as any).assigned_designer.id}
          designerName={(selectedProject as any).assigned_designer.name}
          customerId={user!.id}
          onClose={() => {
            setShowFeedbackModal(false);
            setSelectedProject(null);
          }}
          onSuccess={handleFeedbackSuccess}
        />
      )}
      {payingProjectId && paymentAsks[payingProjectId] && (
        <PaymentOptionsModal
          purpose="project_payment"
          referenceId={paymentAsks[payingProjectId].id}
          title="Project payment"
          description="Pay the amount requested by your designer. The Razorpay option adds a 2% processing fee. The fee is not added to the project bill."
          baseAmount={Number(paymentAsks[payingProjectId].amount)}
          onPaid={() => {
            setPayingProjectId(null);
            fetchProjects();
          }}
          onSubmitted={() => {
            setPayingProjectId(null);
            fetchProjects();
          }}
          onClose={() => setPayingProjectId(null)}
        />
      )}
    </div>
  );
};

export default MyProjects;