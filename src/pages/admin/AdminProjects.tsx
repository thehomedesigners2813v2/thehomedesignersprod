import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, AlertTriangle, Search, FolderKanban, Eye, X, Trash2 } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-gray-100 text-gray-600',
  assigned: 'bg-sky-50 text-sky-600',
  in_progress: 'bg-blue-50 text-blue-600',
  completed: 'bg-green-50 text-green-600',
  on_hold: 'bg-amber-50 text-amber-600',
  cancelled: 'bg-red-50 text-red-600',
};

const AdminProjects: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedProject, setSelectedProject] = useState<any | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });
      if (err) throw err;
      setProjects(data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const handleDeleteProject = async (project: { id: string; project_name?: string | null }) => {
    const name = project.project_name || 'this project';
    if (!confirm(`Delete "${name}"? Quotes, bills, and linked project records will be removed. This cannot be undone.`)) {
      return;
    }
    const { error: deleteError } = await supabase.rpc('admin_delete_project', { p_project_id: project.id });
    if (deleteError) {
      alert(deleteError.message || 'The project could not be deleted.');
      return;
    }
    if (selectedProject?.id === project.id) setSelectedProject(null);
    await fetchProjects();
  };

  const statuses = ['all', ...new Set(projects.map(p => p.status).filter(Boolean))];

  const filtered = projects.filter(p => {
    const matchesSearch = !search ||
      p.project_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.email?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-6 h-6 text-sky-600 animate-spin" /></div>;
  if (error) return (
    <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
      <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
      <p className="text-red-700 font-medium">Failed to load projects</p>
      <p className="text-red-500 text-sm">{error}</p>
      <button onClick={fetchProjects} className="mt-4 text-sm text-sky-600 hover:underline">Retry</button>
    </div></div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Projects — Monitoring</h1>
        <p className="text-gray-500 text-sm mt-1">Homeowners cannot delete a project after the quotation is confirmed. Administrators can delete a project from this list.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Projects', value: projects.length },
          { label: 'Active', value: projects.filter(p => p.status === 'in_progress' || p.status === 'assigned').length },
          { label: 'Completed', value: projects.filter(p => p.status === 'completed').length },
          { label: 'New / Unassigned', value: projects.filter(p => p.status === 'new' || !p.status).length },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by project, homeowner name, or email…"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
          {statuses.map(s => <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FolderKanban className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No projects found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Project</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 hidden md:table-cell">Homeowner</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 hidden lg:table-cell">Location</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 hidden sm:table-cell">Created</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/30">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{p.project_name || 'Untitled'}</p>
                      {p.budget_range && <p className="text-xs text-gray-500">{p.budget_range}</p>}
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      <p className="text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.email}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-600 hidden lg:table-cell">{p.location || '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-600'}`}>
                        {(p.status || 'unknown').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 hidden sm:table-cell text-xs">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setSelectedProject(p)}
                          className="p-1.5 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-md transition-colors"
                          title="View project">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteProject(p)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete project">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selectedProject && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedProject(null)}>
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Project Details</h3>
              <button onClick={() => setSelectedProject(null)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              {[
                ['Project Name', selectedProject.project_name],
                ['Homeowner', selectedProject.name],
                ['Email', selectedProject.email],
                ['Phone', selectedProject.phone],
                ['Location', selectedProject.location],
                ['Budget Range', selectedProject.budget_range],
                ['Status', (selectedProject.status || '').replace(/_/g, ' ')],
                ['Address', selectedProject.address],
                ['Created', selectedProject.created_at ? new Date(selectedProject.created_at).toLocaleString('en-IN') : null],
                ['Updated', selectedProject.updated_at ? new Date(selectedProject.updated_at).toLocaleString('en-IN') : null],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between gap-4">
                  <span className="text-gray-500 shrink-0">{label}</span>
                  <span className="text-gray-900 text-right">{value || '—'}</span>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500">A confirmed project can only be deleted by an administrator.</p>
              <button onClick={() => handleDeleteProject(selectedProject)}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700">
                <Trash2 className="w-4 h-4" />
                Delete project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProjects;
