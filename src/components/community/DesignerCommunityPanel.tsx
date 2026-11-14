import React, { useCallback, useEffect, useState } from 'react';
import { Users, Loader2, AlertCircle, Check, X, Inbox, MapPin } from 'lucide-react';
import {
  fetchDesignerCommunityOverview,
  decideCommunityJoinRequest,
  setCommunityListing,
} from '../../lib/communityApi';
import type { DesignerCommunityOverview, DesignerJoinRequest, DesignerCommunityProject } from '../../lib/communityApi';

const requestStatusStyles: Record<DesignerJoinRequest['status'], { label: string; className: string }> = {
  pending: { label: 'Awaiting your decision', className: 'bg-amber-50 text-amber-800' },
  approved: { label: 'Approved - quotation prepared', className: 'bg-sky-50 text-sky-800' },
  accepted: { label: 'Homeowner joined', className: 'bg-green-50 text-green-800' },
  rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700' },
};

const DesignerCommunityPanel: React.FC = () => {
  const [overview, setOverview] = useState<DesignerCommunityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      setOverview(await fetchDesignerCommunityOverview());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load community requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (id: string, action: () => Promise<void>) => {
    setBusyId(id);
    setActionError(null);
    try {
      await action();
      setRejectingId(null);
      setRejectReason('');
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'That action could not be completed.');
    } finally {
      setBusyId(null);
    }
  };

  const toggleListing = (project: DesignerCommunityProject) =>
    runAction(project.customer_id, () =>
      setCommunityListing(project.customer_id, !project.is_open, project.max_participants),
    );

  const changeCapacity = (project: DesignerCommunityProject, value: number) =>
    runAction(project.customer_id, () => setCommunityListing(project.customer_id, project.is_open, value));

  const approve = (request: DesignerJoinRequest) =>
    runAction(request.id, () => decideCommunityJoinRequest(request.id, 'approve'));

  const reject = (request: DesignerJoinRequest) =>
    runAction(request.id, () => decideCommunityJoinRequest(request.id, 'reject', rejectReason.trim() || undefined));

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl bg-white p-10 shadow-lg">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-red-50 p-6 text-sm text-red-700">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <span>Community requests could not be loaded. {error}</span>
      </div>
    );
  }

  const pendingRequests = overview.requests.filter((r) => r.status === 'pending');
  const otherRequests = overview.requests.filter((r) => r.status !== 'pending');

  return (
    <section className="rounded-xl bg-white p-6 shadow-lg">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-secondary-800">Community Join Requests</h2>
          <p className="mt-1 text-sm text-gray-600">Share an ongoing project and approve homeowners who want to join.</p>
        </div>
        {pendingRequests.length > 0 && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
            {pendingRequests.length} pending
          </span>
        )}
      </div>

      {actionError && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Your ongoing projects</h3>
        {overview.projects.length === 0 ? (
          <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
            Projects appear here once a homeowner accepts your quotation and the advance is paid.
          </p>
        ) : (
          overview.projects.map((project) => (
            <div key={project.customer_id} className="flex flex-col gap-4 rounded-xl border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-secondary-900">{project.project_name || 'Project'}</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-600">
                  <MapPin className="h-3.5 w-3.5" />
                  {project.township || 'Township not set'}
                </p>
                {project.community_project_id && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-600">
                    <Users className="h-3.5 w-3.5" />
                    {project.participant_count} of {project.max_participants} homeowners
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  Max homeowners
                  <select
                    value={project.max_participants}
                    disabled={busyId === project.customer_id}
                    onChange={(e) => changeCapacity(project, Number(e.target.value))}
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n} disabled={n < project.participant_count}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => toggleListing(project)}
                  disabled={busyId === project.customer_id}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
                    project.is_open
                      ? 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {busyId === project.customer_id && <Loader2 className="h-4 w-4 animate-spin" />}
                  {project.is_open ? 'Unshare' : 'Share to community'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-8 space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Requests</h3>
        {overview.requests.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl bg-gray-50 p-8 text-center">
            <Inbox className="h-8 w-8 text-gray-400" />
            <p className="mt-3 text-sm text-gray-600">No join requests yet.</p>
          </div>
        ) : (
          [...pendingRequests, ...otherRequests].map((request) => {
            const style = requestStatusStyles[request.status];
            const isPending = request.status === 'pending';
            return (
              <div key={request.id} className="rounded-xl border border-gray-200 p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-secondary-900">
                      {request.requester_project_name || 'Homeowner project'}
                    </p>
                    <p className="text-sm text-gray-600">
                      Joining &ldquo;{request.source_project_name}&rdquo; - {request.requester_name || 'Homeowner'}
                    </p>
                  </div>
                  <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium ${style.className}`}>
                    {style.label}
                  </span>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <div>
                    <dt className="text-gray-500">Township</dt>
                    <dd className="text-gray-900">{request.township || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Property</dt>
                    <dd className="text-gray-900">{request.property_type || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Area</dt>
                    <dd className="text-gray-900">{request.project_area || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Budget</dt>
                    <dd className="text-gray-900">{request.budget_range || '-'}</dd>
                  </div>
                </dl>
                {request.requirements && (
                  <p className="mt-3 line-clamp-3 text-sm text-gray-600">{request.requirements}</p>
                )}

                {isPending && rejectingId !== request.id && (
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      onClick={() => approve(request)}
                      disabled={busyId === request.id}
                      className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-60"
                    >
                      {busyId === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Allow
                    </button>
                    <button
                      onClick={() => {
                        setRejectingId(request.id);
                        setRejectReason('');
                      }}
                      disabled={busyId === request.id}
                      className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </button>
                  </div>
                )}

                {isPending && rejectingId === request.id && (
                  <div className="mt-5 space-y-3">
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={2}
                      placeholder="Optional reason shared with the homeowner"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => reject(request)}
                        disabled={busyId === request.id}
                        className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
                      >
                        {busyId === request.id && <Loader2 className="h-4 w-4 animate-spin" />}
                        Confirm reject
                      </button>
                      <button
                        onClick={() => setRejectingId(null)}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {request.status === 'rejected' && request.rejection_reason && (
                  <p className="mt-3 text-sm text-gray-600">Reason: {request.rejection_reason}</p>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};

export default DesignerCommunityPanel;
