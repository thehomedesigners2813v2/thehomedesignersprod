import React, { useState, useEffect } from 'react';
import { Users, Plus, X, Trash2, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useDesignerProfile } from '../hooks/useDesignerProfile';

interface TeamMember {
  id: string;
  project_id: string;
  name: string;
  role: string;
  contact: string;
  created_at: string;
}

interface ProjectTeamManagementProps {
  projectId: string;
  currentStatus: string;
}

const ProjectTeamManagement: React.FC<ProjectTeamManagementProps> = ({ 
  projectId, 
  currentStatus 
}) => {
  const { user } = useAuth();
  const { designer, isDesigner } = useDesignerProfile();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    contact: ''
  });
  const [contactError, setContactError] = useState<string | null>(null);

  // Predefined roles for dropdown
  const roles = [
    'Project Manager',
    'Interior Designer',
    'Architect',
    'Carpenter',
    'Electrician',
    'Plumber',
    'Painter',
    'Flooring Specialist',
    'Lighting Expert',
    'Furniture Specialist',
    'Textile Designer',
    'Site Supervisor',
    'CAD Specialist',
    '3D Visualization Expert',
    'Vastu Consultant'
  ];

  useEffect(() => {
    if (projectId) {
      fetchTeamMembers();
    }
  }, [projectId]);

  const fetchTeamMembers = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('project_team_members')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      setTeamMembers(data || []);
    } catch (error: any) {
      console.error('Error fetching team members:', error);
      setError('Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'contact') {
      const digitsOnly = value.replace(/\D/g, '').slice(0, 10);
      setFormData(prev => ({ ...prev, contact: digitsOnly }));
      setContactError(digitsOnly.length > 0 && digitsOnly.length < 10 ? 'Phone number must be exactly 10 digits' : null);
      if (error) setError(null);
      return;
    }
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !isDesigner || !designer) {
      setError('You must be logged in as a designer to add team members');
      return;
    }

    // Validate form
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!formData.role.trim()) {
      setError('Role is required');
      return;
    }
    if (!/^\d{10}$/.test(formData.contact)) {
      setContactError('Phone number must be exactly 10 digits');
      setError('Phone number must be exactly 10 digits');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { data, error } = await supabase
        .from('project_team_members')
        .insert({
          project_id: projectId,
          name: formData.name.trim(),
          role: formData.role.trim(),
          contact: formData.contact.trim(),
          added_by: designer.id
        })
        .select()
        .single();

      if (error) throw error;

      setTeamMembers(prev => [...prev, data]);
      setSuccess('Team member added successfully');
      setFormData({ name: '', role: '', contact: '' });
      setContactError(null);
      setShowAddForm(false);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (error: any) {
      console.error('Error adding team member:', error);
      setError(error.message || 'Failed to add team member');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { error } = await supabase
        .from('project_team_members')
        .delete()
        .eq('id', id)
        .eq('project_id', projectId);

      if (error) throw error;

      setTeamMembers(prev => prev.filter(member => member.id !== id));
      setSuccess('Team member removed successfully');

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (error: any) {
      console.error('Error removing team member:', error);
      setError(error.message || 'Failed to remove team member');
    } finally {
      setLoading(false);
    }
  };

  // Only show for designers and only when project is finalized or beyond
  const isFinalized = ['finalized', 'in_progress', 'completed'].includes(currentStatus);
  const isCompleted = currentStatus === 'completed';
  if (!isDesigner || !isFinalized) return null;

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-secondary-800 flex items-center">
          <Users className="w-5 h-5 mr-2 text-primary-600" />
          Project Team
        </h3>
        {!showAddForm && !isCompleted && (
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-primary-500 hover:bg-primary-600 text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1"
          >
            <Plus className="w-4 h-4" />
            <span>Add Member</span>
          </button>
        )}
      </div>

      {isCompleted && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-green-700">
            Project is completed. Team members list is locked and cannot be modified.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg mb-4 flex items-start space-x-2">
          <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Add Member Form */}
      {showAddForm && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-secondary-800">Add Team Member</h4>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleAddMember} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Full name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role *
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                >
                  <option value="">Select role</option>
                  {roles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact * <span className="text-xs text-gray-500">(10 digits)</span>
                </label>
                <input
                  type="tel"
                  name="contact"
                  value={formData.contact}
                  onChange={handleInputChange}
                  className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    contactError ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="9876543210"
                  inputMode="numeric"
                  pattern="\d{10}"
                  maxLength={10}
                  required
                />
                {contactError && (
                  <p className="text-xs text-red-600 mt-1">{contactError}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center space-x-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Adding...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Add Member</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Team Members List */}
      {loading && teamMembers.length === 0 ? (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 text-primary-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading team members...</p>
        </div>
      ) : teamMembers.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No Team Members Yet</h4>
          <p className="text-gray-500 mb-4">
            {isCompleted
              ? 'No team members were added to this project.'
              : 'Add team members to help manage and execute this project.'}
          </p>
          {!showAddForm && !isCompleted && (
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg font-medium transition-colors inline-flex items-center space-x-1"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Team Member</span>
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Name</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Role</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Contact</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {teamMembers.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm text-gray-800 font-medium">{member.name}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    <span className="bg-primary-100 text-primary-800 px-2 py-1 rounded-full text-xs">
                      {member.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">{member.contact}</td>
                  <td className="py-3 px-4 text-right">
                    {!isCompleted && (
                      <button
                        onClick={() => handleDeleteMember(member.id)}
                        className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                        title="Remove team member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 text-sm text-gray-500">
        <p>Team members will be visible to the customer and other project stakeholders.</p>
      </div>
    </div>
  );
};

export default ProjectTeamManagement;