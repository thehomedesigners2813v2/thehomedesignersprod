import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle, ChevronDown, Download, FileArchive, FileText, Image as ImageIcon, Loader2, Upload, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Submission = {
  id: string;
  title: string;
  note: string | null;
  status: 'pending_approval' | 'approved' | 'changes_requested';
  customer_note: string | null;
  decided_at: string | null;
  created_at: string;
  designer_id: string;
  files: DesignFile[];
};

type DesignFile = {
  id: string;
  file_name: string;
  storage_path: string;
  content_type: string;
  previewUrl?: string;
};

const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPT = '.jpg,.jpeg,.png,.pdf,.zip,image/jpeg,image/png,application/pdf,application/zip';

const contentTypeFor = (file: File) => {
  const name = file.name.toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.zip')) return 'application/zip';
  return '';
};

const statusLabel: Record<Submission['status'], string> = {
  pending_approval: 'Waiting',
  approved: 'Approved',
  changes_requested: 'Changes',
};

const fileIcon = (contentType: string) => {
  if (contentType === 'application/pdf') return FileText;
  if (contentType.startsWith('image/')) return ImageIcon;
  return FileArchive;
};

interface DesignApprovalPanelProps {
  projectId: string;
  projectName: string;
  projectStatus: string;
  isAssignedDesigner: boolean;
  isProjectOwner: boolean;
  designerId?: string;
  designerUserId?: string;
  customerUserId?: string;
  onDecided?: () => void;
}

const DesignApprovalPanel: React.FC<DesignApprovalPanelProps> = ({
  projectId,
  projectName,
  projectStatus,
  isAssignedDesigner,
  isProjectOwner,
  designerId,
  designerUserId,
  customerUserId,
  onDecided,
}) => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [changeNote, setChangeNote] = useState('');
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from('project_design_submissions')
      .select('id, title, note, status, customer_note, decided_at, created_at, designer_id, files:project_design_files(id, file_name, storage_path, content_type)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }
    const rows = (data || []) as Submission[];
    const withPreviews = await Promise.all(rows.map(async (row) => {
      const filesWithUrls = await Promise.all((row.files || []).map(async (file) => {
        if (!file.content_type.startsWith('image/')) return file;
        const signed = await supabase.storage.from('project-designs').createSignedUrl(file.storage_path, 3600);
        return { ...file, previewUrl: signed.data?.signedUrl };
      }));
      return { ...row, files: filesWithUrls };
    }));
    setSubmissions(withPreviews);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const openFile = async (file: DesignFile) => {
    const signed = await supabase.storage.from('project-designs').createSignedUrl(file.storage_path, 300);
    const url = signed.data?.signedUrl;
    if (!url) return;
    if (file.content_type.startsWith('image/')) {
      setPreview({ url, name: file.file_name });
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const notify = async (userId: string | undefined, userType: 'customer' | 'designer', titleText: string, message: string) => {
    if (!userId) return;
    await supabase.from('notifications').insert({
      user_id: userId,
      user_type: userType,
      title: titleText,
      message,
      type: 'design_approval',
      reference_id: projectId,
      reference_type: 'project',
    });
  };

  const sendSubmission = async () => {
    if (!designerId) return;
    const chosen = files.map((file) => ({ file, contentType: contentTypeFor(file) }));
    if (!title.trim()) { setError('Add a title for this design.'); return; }
    if (!chosen.length) { setError('Attach at least one file.'); return; }
    if (chosen.some((item) => !item.contentType)) { setError('Use JPG, PNG, PDF, or ZIP files.'); return; }
    if (chosen.some((item) => item.file.size > MAX_BYTES)) { setError('Each file must be 25 MB or smaller.'); return; }
    if (submissions.some((item) => item.status === 'pending_approval')) {
      setError('The homeowner is still reviewing the last design.');
      return;
    }
    setSending(true);
    setError(null);
    const { data: submission, error: insertError } = await supabase
      .from('project_design_submissions')
      .insert({ project_id: projectId, designer_id: designerId, title: title.trim(), note: note.trim() || null })
      .select('id')
      .single();
    if (insertError || !submission) {
      setSending(false);
      setError(insertError?.message || 'The design could not be sent.');
      return;
    }
    const uploaded: string[] = [];
    try {
      for (const item of chosen) {
        const safeName = item.file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
        const path = `${projectId}/${submission.id}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from('project-designs').upload(path, item.file, { contentType: item.contentType });
        if (uploadError) throw uploadError;
        uploaded.push(path);
        const { error: fileError } = await supabase.from('project_design_files').insert({
          submission_id: submission.id,
          file_name: item.file.name,
          storage_path: path,
          content_type: item.contentType,
        });
        if (fileError) throw fileError;
      }
    } catch (caught) {
      await supabase.from('project_design_files').delete().eq('submission_id', submission.id);
      if (uploaded.length) await supabase.storage.from('project-designs').remove(uploaded);
      await supabase.from('project_design_submissions').delete().eq('id', submission.id);
      setSending(false);
      setError(caught instanceof Error ? caught.message : 'The files could not be uploaded.');
      return;
    }
    await notify(customerUserId, 'customer', 'Design ready for approval', `${title.trim()} was added to ${projectName}. Review it and approve or ask for changes.`);
    setTitle('');
    setNote('');
    setFiles([]);
    setComposerOpen(false);
    setSending(false);
    await load();
  };

  const decide = async (submission: Submission, status: 'approved' | 'changes_requested') => {
    if (status === 'changes_requested' && changeNote.trim().length < 3) {
      setError('Write a short note about the changes you need.');
      return;
    }
    setDecidingId(submission.id);
    setError(null);
    const { error: updateError } = await supabase
      .from('project_design_submissions')
      .update({ status, customer_note: status === 'changes_requested' ? changeNote.trim() : null })
      .eq('id', submission.id)
      .eq('status', 'pending_approval');
    setDecidingId(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    const { data: designerRow } = await supabase.from('designers').select('user_id').eq('id', submission.designer_id).maybeSingle();
    await notify(
      designerRow?.user_id || designerUserId,
      'designer',
      status === 'approved' ? 'Design approved' : 'Design changes requested',
      status === 'approved'
        ? `The homeowner approved "${submission.title}" on ${projectName}.`
        : `The homeowner asked for changes on "${submission.title}": ${changeNote.trim()}`
    );
    setChangeNote('');
    onDecided?.();
    await load();
  };

  const canUpload = isAssignedDesigner && projectStatus === 'pending' && !submissions.some((item) => item.status === 'pending_approval');
  if (!isAssignedDesigner && !isProjectOwner) return null;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-secondary-800">Design approval</h3>
      <p className="mt-1 text-sm text-gray-600">
        Finalized 3D designs and other project files can be shared while the project is pending. Homeowner approval is optional.
      </p>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading ? <div className="mt-4 flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading designs…</div> : null}

      {canUpload && (
        <div className="mt-3">
          {!composerOpen ? (
            <button type="button" onClick={() => setComposerOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-secondary-800">
              <Upload className="h-4 w-4" /> Send files
            </button>
          ) : (
            <div className="space-y-3 rounded-lg bg-gray-50 p-3">
              <label className="block text-sm font-medium text-gray-700">Title
                <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" placeholder="Final 3D design" />
              </label>
              <label className="block text-sm font-medium text-gray-700">Note
                <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" placeholder="What should the homeowner review?" />
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-primary-700">
                <Upload className="h-4 w-4" /> Add JPG, PNG, PDF, or ZIP
                <input type="file" accept={ACCEPT} multiple className="hidden" onChange={(event) => setFiles(Array.from(event.target.files || []))} />
              </label>
              {files.length > 0 && <p className="text-sm text-gray-600">{files.map((file) => file.name).join(', ')}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => void sendSubmission()} disabled={sending} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  {sending ? 'Sending…' : 'Send for approval'}
                </button>
                <button type="button" onClick={() => setComposerOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
      {isAssignedDesigner && projectStatus !== 'pending' && (
        <p className="mt-3 text-sm text-gray-500">New designs can be sent only while the project is pending.</p>
      )}

      <div className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200">
        {submissions.map((submission) => {
          const open = expandedId === submission.id;
          const lead = submission.files[0];
          const LeadIcon = lead ? fileIcon(lead.content_type) : FileText;
          return (
            <article key={submission.id}>
              <button
                type="button"
                onClick={() => setExpandedId(open ? null : submission.id)}
                className="flex h-12 w-full items-center gap-3 px-3 text-left"
              >
                {lead?.previewUrl ? (
                  <img src={lead.previewUrl} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-gray-50 text-gray-500">
                    <LeadIcon className="h-4 w-4" />
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-secondary-800">{submission.title}</span>
                <span className="shrink-0 text-xs text-gray-500">{submission.files.length} {submission.files.length === 1 ? 'file' : 'files'}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${submission.status === 'approved' ? 'bg-green-100 text-green-800' : submission.status === 'changes_requested' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                  {statusLabel[submission.status]}
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
              </button>
              {open && (
                <div className="space-y-2 border-t border-gray-100 px-3 py-2">
                  {submission.note && <p className="text-sm text-gray-600">{submission.note}</p>}
                  {submission.files.map((file) => (
                    <button key={file.id} type="button" onClick={() => void openFile(file)} className="flex w-full items-center gap-2 text-left text-sm font-medium text-primary-700">
                      <Download className="h-4 w-4 shrink-0" />
                      <span className="truncate">{file.file_name}</span>
                    </button>
                  ))}
                  {submission.customer_note && <p className="text-sm text-amber-800">Homeowner note: {submission.customer_note}</p>}
                  {isProjectOwner && submission.status === 'pending_approval' && (
                    <div className="space-y-2 pt-1">
                      <textarea value={changeNote} onChange={(event) => setChangeNote(event.target.value)} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="If you need changes, describe them here" />
                      <div className="flex flex-wrap gap-2">
                        <button type="button" disabled={decidingId === submission.id} onClick={() => void decide(submission, 'approved')} className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">
                          <CheckCircle className="h-4 w-4" /> Approve
                        </button>
                        <button type="button" disabled={decidingId === submission.id} onClick={() => void decide(submission, 'changes_requested')} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800 disabled:opacity-60">
                          Request changes
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
        {!loading && submissions.length === 0 && <p className="px-3 py-3 text-sm text-gray-500">No designs have been sent yet.</p>}
      </div>
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPreview(null)}>
          <div className="max-h-[80vh] max-w-3xl overflow-hidden rounded-xl bg-white" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-3 py-2">
              <p className="truncate text-sm font-medium text-secondary-800">{preview.name}</p>
              <button type="button" onClick={() => setPreview(null)} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Close preview">
                <X className="h-4 w-4" />
              </button>
            </div>
            <img src={preview.url} alt={preview.name} className="max-h-[70vh] w-full object-contain" />
          </div>
        </div>
      )}
    </section>
  );
};

export default DesignApprovalPanel;
