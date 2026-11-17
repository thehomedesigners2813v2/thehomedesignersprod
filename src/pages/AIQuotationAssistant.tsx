import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Check, ChevronLeft, ChevronRight, FileImage, FileText, Loader2, Mic, Pencil, Plus, RefreshCw, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDesignerProfile } from '../hooks/useDesignerProfile';
import { usePlanAccess } from '../hooks/usePlanAccess';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { supabase } from '../lib/supabase';
import { generateBillPdf } from '../utils/generateBillPdf';

type Stage = 1 | 2 | 3 | 4;
type JobStatus = 'uploaded' | 'requirements_ready' | 'queued' | 'analyzing_plan' | 'understanding_requirements' | 'matching_catalogue' | 'calculating' | 'review_ready' | 'failed' | 'converted';
type AIItem = { id: string; room_id: string | null; name: string; description: string; quantity: number; unit: string; unit_price: number; number_of_units: number; discount_percent: number; width: number | null; height: number | null; depth: number | null; material_id: string | null; item_type: 'material' | 'labor' | 'service' | 'other' | 'component'; assumption: string | null };
type AIRoom = { id: string; name: string; width: number | null; height: number | null; unit: string; confidence: number | null; source_note: string | null; display_order: number };
type Job = { id: string; source_file_path: string; source_file_type: string; source_file_size: number; status: JobStatus; error_message: string | null; assumptions: string[] };
type Customer = { id: string; name: string; email: string; phone: string; location: string | null; project_name: string };

const steps = ['Upload Plan', 'Requirements', 'Generate', 'Review'];
const statuses: { key: JobStatus; label: string; detail: string }[] = [
  { key: 'analyzing_plan', label: 'Analyzing floor plan', detail: 'Identifying rooms, dimensions and layout details...' },
  { key: 'understanding_requirements', label: 'Understanding your requirements', detail: 'Processing your voice or text instructions...' },
  { key: 'matching_catalogue', label: 'Matching items from catalogue', detail: 'Finding available designer materials and rates...' },
  { key: 'calculating', label: 'Calculating quantities and pricing', detail: 'Applying verified catalogue rates and rules...' },
  { key: 'review_ready', label: 'Preparing quotation', detail: 'Your editable quotation is ready.' },
];

const friendlyError = (message: string) => {
  if (message.includes('Edge Function returned a non-2xx status code')) return 'The AI quotation service encountered an error. Please try again or contact support if it persists.';
  if (message.includes('STANDARD_SUBSCRIPTION_REQUIRED')) return 'An active Standard subscription is required before using AI quotations.';
  if (message.includes('AI_SUBSCRIPTION_REQUIRED')) return 'Choose an active AI add-on plan before generating a quotation.';
  if (message.includes('AI_CREDITS_EXHAUSTED')) return 'You have no AI credits remaining for this billing period.';
  if (message.includes('PROVIDER_NOT_CONFIGURED')) return 'AI provider is not configured yet. An admin must set the vision model and enable AI in settings.';
  if (message.includes('PROVIDER_AUTH_FAILED')) return 'The AI provider rejected the API key. An admin must update the OpenAI API key secret.';
  if (message.includes('PROVIDER_MODEL_UNAVAILABLE')) return 'The configured vision model is unavailable. An admin must set a valid model ID in settings.';
  if (message.includes('PROVIDER_BILLING_EXHAUSTED')) return 'The AI provider account has no billing credits remaining. An admin must add credits at platform.openai.com.';
  if (message.includes('PROVIDER_RATE_LIMITED')) return 'The AI provider is rate-limited right now. Please try again in a few minutes.';
  return message || 'We could not complete this request. Please try again.';
};

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
const itemAmount = (item: AIItem) => (item.number_of_units || 1) * (item.quantity || 0) * (item.unit_price || 0) * (1 - (item.discount_percent || 0) / 100);

const AIQuotationAssistant = () => {
  const navigate = useNavigate();
  const { id: projectId } = useParams();
  const { designer, loading: designerLoading } = useDesignerProfile();
  const { isProfessional, loading: planLoading } = usePlanAccess();
  const voice = useVoiceInput();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>(1);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPath, setUploadPath] = useState<string | null>(null);
  const [requirementsMode, setRequirementsMode] = useState<'voice' | 'text'>('voice');
  const [requirements, setRequirements] = useState('');
  const [pricingProfile, setPricingProfile] = useState('Standard');
  const [job, setJob] = useState<Job | null>(null);
  const [rooms, setRooms] = useState<AIRoom[]>([]);
  const [items, setItems] = useState<AIItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [activeRoom, setActiveRoom] = useState<string>('summary');
  const [title, setTitle] = useState('AI Interior Quotation');
  const [taxRate, setTaxRate] = useState(18);
  const [discount, setDiscount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!voice.isListening && voice.transcript.trim()) setRequirements(voice.transcript);
  }, [voice.isListening, voice.transcript]);

  useEffect(() => {
    if (!projectId) return;
    void supabase.from('customers').select('id, name, email, phone, location, project_name').eq('id', projectId).maybeSingle().then(({ data }) => setCustomer(data as Customer | null));
  }, [projectId]);

  useEffect(() => {
    return () => { if (filePreview) URL.revokeObjectURL(filePreview); };
  }, [filePreview]);

  const validateFile = (candidate: File) => {
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(candidate.type)) throw new Error('Please choose a PDF, JPG or PNG floor plan.');
    if (candidate.size > 10 * 1024 * 1024) throw new Error('Floor plan must be smaller than 10 MB.');
    return candidate;
  };

  const selectFile = (candidate: File) => {
    try {
      const valid = validateFile(candidate);
      setFile(valid);
      setFilePreview(valid.type === 'application/pdf' ? null : URL.createObjectURL(valid));
      setUploadPath(null);
      setError(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not use that file.'); }
  };

  const uploadPlan = async () => {
    if (!file || !designer) throw new Error('Choose a floor plan first.');
    setUploading(true); setError(null);
    try {
      const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
      const path = `${designer.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('ai-floor-plans').upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw new Error('The floor plan could not be uploaded.');
      setUploadPath(path);
      setStage(2);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The floor plan could not be uploaded.'); }
    finally { setUploading(false); }
  };

  const pollJob = useCallback(async (jobId: string) => {
    for (;;) {
      const { data, error: queryError } = await supabase.from('ai_quotation_jobs').select('id, source_file_path, source_file_type, source_file_size, status, error_message, assumptions').eq('id', jobId).maybeSingle();
      if (queryError || !data) throw new Error('The quotation job could not be read.');
      const nextJob = data as Job;
      setJob(nextJob);
      if (nextJob.status === 'review_ready') {
        const [{ data: roomData }, { data: itemData }] = await Promise.all([
          supabase.from('ai_quotation_rooms').select('*').eq('job_id', jobId).order('display_order'),
          supabase.from('ai_quotation_items').select('*').eq('job_id', jobId).order('created_at'),
        ]);
        setRooms((roomData || []) as AIRoom[]);
        setItems((itemData || []) as AIItem[]);
        setActiveRoom((roomData?.[0] as AIRoom | undefined)?.id || 'summary');
        setStage(4); setIsProcessing(false); return;
      }
      if (nextJob.status === 'failed') throw new Error(nextJob.error_message || 'AI quotation generation failed.');
      await new Promise(resolve => window.setTimeout(resolve, 1500));
    }
  }, []);

  const generate = async () => {
    if (!uploadPath || !projectId) return;
    setError(null); setSuccess(null); setStage(3); setIsProcessing(true);
    try {
      const { data: created, error: createError } = await supabase.functions.invoke('ai-quotation-create', { body: { projectId, sourceFilePath: uploadPath, sourceFileType: file?.type, sourceFileSize: file?.size, requirementsText: requirements.trim(), pricingProfile } });
      if (createError || !created?.jobId) throw new Error(friendlyError(created?.error || createError?.message || 'Could not start generation.'));
      setJob({ id: created.jobId, source_file_path: uploadPath, source_file_type: file?.type || '', source_file_size: file?.size || 0, status: 'queued', error_message: null, assumptions: [] });
      const { data: processData, error: processError } = await supabase.functions.invoke('ai-quotation-process', { body: { jobId: created.jobId } });
      if (processError) throw new Error(friendlyError(processData?.error || processError.message));
      await pollJob(created.jobId);
    } catch (caught) { setError(friendlyError(caught instanceof Error ? caught.message : 'AI quotation generation failed.')); setIsProcessing(false); }
  };

  const updateItem = (id: string, field: keyof AIItem, value: string | number) => setItems(previous => previous.map(item => item.id === id ? { ...item, [field]: typeof value === 'string' && ['quantity', 'unit_price', 'discount_percent', 'number_of_units'].includes(field) ? Number(value) || 0 : value } : item));
  const addItem = (roomId: string | null) => setItems(previous => [...previous, { id: crypto.randomUUID(), room_id: roomId, name: 'New item', description: '', quantity: 1, unit: 'Nos', unit_price: 0, number_of_units: 1, discount_percent: 0, width: null, height: null, depth: null, material_id: null, item_type: 'material', assumption: 'Add a verified catalogue rate before saving.' }]);
  const renameRoom = (room: AIRoom) => { const name = window.prompt('Room name', room.name)?.trim(); if (name) setRooms(previous => previous.map(entry => entry.id === room.id ? { ...entry, name } : entry)); };
  const updateRoomSize = (room: AIRoom) => { const width = Number(window.prompt('Width in feet', String(room.width || ''))); const height = Number(window.prompt('Height in feet', String(room.height || ''))); if (width > 0 && height > 0) setRooms(previous => previous.map(entry => entry.id === room.id ? { ...entry, width, height, confidence: 1, source_note: 'Confirmed by designer.' } : entry)); };

  const roomItems = (roomId: string) => items.filter(item => item.room_id === roomId);
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + itemAmount(item), 0), [items]);
  const taxable = Math.max(0, subtotal - discount);
  const taxAmount = taxable * taxRate / 100;
  const total = taxable + taxAmount;

  const saveQuotation = async (status: 'draft' | 'sent') => {
    if (!job || !items.length) return;
    setSaving(true); setError(null); setSuccess(null);
    try {
      const body = { jobId: job.id, title, status, taxRate, discountAmount: discount, description: requirements, notes: (job.assumptions || []).join('\n'), items: items.map(item => ({ roomName: rooms.find(room => room.id === item.room_id)?.name || 'On-Site Work', materialId: item.material_id, itemType: item.item_type, name: item.name, description: item.description, quantity: item.quantity, unit: item.unit, numberOfUnits: item.number_of_units, unitPrice: item.unit_price, discountPercent: item.discount_percent, width: item.width, height: item.height, depth: item.depth })) };
      const { data, error: saveError } = await supabase.functions.invoke('ai-quotation-save-draft', { body });
      if (saveError || !data?.quoteId) throw new Error(data?.error || saveError?.message || 'Could not save quotation.');
      setSuccess(status === 'sent' ? 'Quotation sent to homeowner.' : 'Quotation saved as draft.');
      window.setTimeout(() => navigate('/designer-quotes'), 900);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save quotation.'); }
    finally { setSaving(false); }
  };

  const downloadPdf = () => {
    if (!customer || !designer) return;
    generateBillPdf({ billNumber: `AI-${job?.id.slice(-8) || 'DRAFT'}`, status: 'draft', createdAt: new Date().toISOString(), projectName: customer.project_name, customerName: customer.name, customerEmail: customer.email, customerPhone: customer.phone, customerLocation: customer.location || '', designerName: designer.name, designerSpecialization: designer.specialization, items: items.map(item => ({ item_type: item.item_type, name: item.name, description: item.description, number_of_units: item.number_of_units, quantity: item.quantity, unit: item.unit, unit_price: item.unit_price, amount: itemAmount(item), width: item.width || undefined, height: item.height || undefined, depth: item.depth || undefined })), subtotal, discountAmount: discount, taxRate, taxAmount, totalAmount: total, notes: (job?.assumptions || []).join('\n') });
  };

  if (designerLoading || planLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>;
  if (!isProfessional) return <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6"><div className="max-w-md text-center"><h1 className="text-2xl font-bold text-slate-900">Professional plan required</h1><p className="mt-2 text-slate-600">AI quotations are available on the Professional plan.</p><button type="button" onClick={() => navigate('/designer-subscription')} className="mt-5 rounded-lg bg-primary-600 px-4 py-2 font-semibold text-white">View plans</button></div></div>;
  if (!designer || !customer || !projectId) return <div className="mx-auto max-w-xl px-6 py-24 text-center"><AlertCircle className="mx-auto h-12 w-12 text-red-500" /><h1 className="mt-4 text-2xl font-bold text-slate-900">AI quotation unavailable</h1><p className="mt-2 text-slate-600">Open this assistant from an assigned designer project.</p></div>;

  return <div className="min-h-screen bg-slate-50 pb-10 text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8"><button type="button" onClick={() => navigate(`/generate-quote/${projectId}`)} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-700"><ArrowLeft className="h-4 w-4" /> Back to quotation tools</button><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-600">AI quotation assistant</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{stage === 4 ? 'Review AI generated quotation' : 'Create quotation with AI'}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Upload a floor plan and describe the work. The result stays editable until you approve it.</p></div><div className="rounded-xl bg-slate-50 px-4 py-3 text-sm"><span className="text-slate-500">Project</span><strong className="ml-2 text-slate-800">{customer.project_name}</strong></div></div></div></header>
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <nav className="mb-6 grid grid-cols-4 gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">{steps.map((label, index) => { const number = index + 1; const complete = stage > number; return <button key={label} type="button" onClick={() => number < stage && setStage(number as Stage)} className={`flex items-center gap-2 rounded-xl px-2 py-2 text-left text-xs font-semibold sm:px-4 sm:text-sm ${stage === number ? 'bg-primary-50 text-primary-800' : complete ? 'text-emerald-700' : 'text-slate-400'}`}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs ${stage === number ? 'border-primary-600 bg-primary-600 text-white' : complete ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300'}`}>{complete ? <Check className="h-4 w-4" /> : number}</span><span>{label}</span></button>; })}</nav>
      {error && <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span className="flex-1">{error}</span><button type="button" onClick={() => setError(null)}><X className="h-4 w-4" /></button></div>}
      {success && <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{success}</div>}
      {stage === 1 && <section className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10"><div className="mb-8 text-center"><Sparkles className="mx-auto h-10 w-10 text-primary-600" /><h2 className="mt-4 text-2xl font-bold">Upload 2D floor plan</h2><p className="mt-2 text-slate-600">Use a clear PDF, JPG or PNG up to 10 MB. The file is stored privately for this project.</p></div><button type="button" onClick={() => fileInputRef.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const dropped = event.dataTransfer.files[0]; if (dropped) selectFile(dropped); }} className="flex min-h-[290px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary-200 bg-primary-50/40 px-6 text-center transition hover:border-primary-400 hover:bg-primary-50"><input ref={fileInputRef} type="file" accept="application/pdf,image/jpeg,image/png" onChange={event => { const selected = event.target.files?.[0]; if (selected) selectFile(selected); }} className="hidden" />{file ? <>{filePreview ? <img src={filePreview} alt="Floor plan preview" className="mb-4 max-h-44 rounded-xl border border-slate-200 object-contain shadow-sm" /> : <FileText className="mb-4 h-16 w-16 text-red-500" />}<strong>{file.name}</strong><span className="mt-1 text-sm text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB · Click to replace</span></> : <><Upload className="mb-4 h-12 w-12 text-primary-600" /><strong className="text-lg">Drag and drop your floor plan</strong><span className="mt-2 text-sm text-slate-500">or click to browse · PDF, JPG or PNG · max 10 MB</span></>}</button>{file && <div className="mt-5 flex gap-3"><button type="button" onClick={() => { setFile(null); setFilePreview(null); setUploadPath(null); }} className="flex-1 rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700">Remove</button><button type="button" disabled={uploading} onClick={() => void uploadPlan()} className="flex-1 rounded-xl bg-primary-600 px-4 py-3 font-semibold text-white disabled:opacity-60">{uploading ? 'Uploading securely…' : 'Continue'}</button></div>}</section>}
      {stage === 2 && <section className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10"><div className="mb-7"><h2 className="text-2xl font-bold">Tell us what you need</h2><p className="mt-2 text-slate-600">Speak or type naturally. You can edit the instructions before generation.</p></div><div className="mb-6 grid grid-cols-2 gap-3"><button type="button" onClick={() => setRequirementsMode('voice')} className={`rounded-xl border px-4 py-3 text-left font-semibold ${requirementsMode === 'voice' ? 'border-primary-500 bg-primary-600 text-white' : 'border-slate-200'}`}><Mic className="mb-2 h-5 w-5" />Voice input<span className="mt-1 block text-xs font-normal opacity-80">{voice.isListening ? 'Listening now…' : 'Speak requirements'}</span></button><button type="button" onClick={() => setRequirementsMode('text')} className={`rounded-xl border px-4 py-3 text-left font-semibold ${requirementsMode === 'text' ? 'border-primary-500 bg-primary-600 text-white' : 'border-slate-200'}`}><FileText className="mb-2 h-5 w-5" />Text input<span className="mt-1 block text-xs font-normal opacity-80">Type requirements</span></button></div>{requirementsMode === 'voice' && <div className="mb-6 flex flex-col items-center rounded-2xl bg-slate-50 p-8 text-center"><button type="button" onClick={voice.isListening ? voice.stopListening : voice.startListening} className={`relative flex h-24 w-24 items-center justify-center rounded-full text-white shadow-lg ${voice.isListening ? 'bg-red-500' : 'bg-primary-600'}`}>{voice.isListening && <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-40" />}{voice.isListening ? <X className="relative h-8 w-8" /> : <Mic className="relative h-8 w-8" />}</button><p className="mt-4 font-semibold">{voice.isListening ? 'Listening… tap to stop' : 'Tap to record requirements'}</p><p className="mt-1 text-xs text-slate-500">{voice.isSupported ? 'Your browser speech recognition will create an editable transcript.' : 'Speech recognition is unavailable in this browser. Use Text input.'}</p></div>}<label className="block text-sm font-semibold text-slate-700">Requirements<textarea value={requirements} onChange={event => setRequirements(event.target.value)} rows={7} placeholder="Example: Create a quotation for a 2BHK home. Include a modular kitchen, wardrobes in both bedrooms, a TV unit in the living room and premium laminate finishes." className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" /></label><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Pricing profile<select value={pricingProfile} onChange={event => setPricingProfile(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 font-normal"><option>Standard</option><option>Premium</option><option>Budget</option></select></label><div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">AI will use your available designer catalogue rates. Missing or uncertain rates remain flagged for review.</div></div><div className="mt-7 flex justify-between gap-3"><button type="button" onClick={() => setStage(1)} className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700"><ChevronLeft className="mr-1 inline h-4 w-4" />Back</button><button type="button" disabled={!requirements.trim()} onClick={() => void generate()} className="rounded-xl bg-primary-600 px-6 py-3 font-semibold text-white disabled:opacity-50">Generate quotation<ChevronRight className="ml-1 inline h-4 w-4" /></button></div></section>}
      {stage === 3 && <section className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10"><div className="mb-8"><h2 className="text-2xl font-bold">Generating your quotation</h2><p className="mt-2 text-slate-600">The assistant is processing the uploaded plan and matching it to your catalogue. This may take a moment.</p></div><div className="grid gap-8 lg:grid-cols-[1fr_280px]"><div className="space-y-4">{statuses.map((entry, index) => { const currentIndex = statuses.findIndex(status => status.key === job?.status); const entryIndex = index; const done = job?.status === 'review_ready' || (currentIndex >= 0 && entryIndex < currentIndex); const active = job?.status === entry.key; return <div key={entry.key} className="flex gap-4"><span className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${done ? 'border-emerald-500 bg-emerald-500 text-white' : active ? 'border-primary-500 bg-primary-50 text-primary-600' : 'border-slate-300 text-slate-400'}`}>{done ? <Check className="h-4 w-4" /> : active ? <Loader2 className="h-4 w-4 animate-spin" /> : index + 1}</span><div><p className={`font-semibold ${active || done ? 'text-slate-900' : 'text-slate-500'}`}>{entry.label}</p><p className="text-sm text-slate-500">{active ? entry.detail : done ? 'Completed' : 'Waiting…'}</p></div></div>; })}</div><div className="rounded-2xl bg-slate-50 p-4">{filePreview ? <img src={filePreview} alt="Uploaded floor plan" className="h-52 w-full rounded-xl object-contain" /> : <div className="flex h-52 items-center justify-center rounded-xl bg-white"><FileText className="h-16 w-16 text-red-400" /></div>}<p className="mt-3 truncate text-sm font-semibold">{file?.name}</p><p className="mt-1 text-xs text-slate-500">Real-time job status · no estimated results are shown until AI completes.</p></div></div>{isProcessing && <div className="mt-8 flex items-center gap-2 rounded-xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-800"><RefreshCw className="h-4 w-4 animate-spin" />Do not close this page while the quotation is being prepared.</div>}</section>}
      {stage === 4 && <section><div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-bold">Review AI generated quotation</h2><p className="text-sm text-slate-600">Check every item, rate and assumption before saving or sending.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={downloadPdf} className="rounded-xl border border-primary-300 px-4 py-2 text-sm font-semibold text-primary-700">Download PDF</button><button type="button" disabled={saving} onClick={() => void saveQuotation('draft')} className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Save as Draft</button><button type="button" disabled={saving} onClick={() => void saveQuotation('sent')} className="rounded-xl border border-primary-600 px-4 py-2 text-sm font-semibold text-primary-700 disabled:opacity-60">Send to Homeowner</button></div></div><div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)_300px]"><aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><button type="button" onClick={() => setActiveRoom('summary')} className={`mb-2 w-full rounded-xl px-3 py-3 text-left ${activeRoom === 'summary' ? 'bg-primary-50 text-primary-800' : 'hover:bg-slate-50'}`}><strong className="block">Summary</strong><span className="text-xs text-slate-500">{rooms.length} rooms · {items.length} items</span></button>{rooms.map(room => <button key={room.id} type="button" onClick={() => setActiveRoom(room.id)} className={`mb-1 w-full rounded-xl px-3 py-3 text-left ${activeRoom === room.id ? 'bg-primary-50 text-primary-800' : 'hover:bg-slate-50'}`}><strong className="block truncate">{room.name}</strong><span className="text-xs text-slate-500">{roomItems(room.id).length} items</span></button>)}</aside><div className="space-y-5">{(activeRoom === 'summary' ? rooms : rooms.filter(room => room.id === activeRoom)).map(room => <div key={room.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-4"><div><div className="flex items-center gap-2"><h3 className="font-bold">{room.name}</h3><button type="button" onClick={() => renameRoom(room)} aria-label="Rename room" className="text-primary-600"><Pencil className="h-4 w-4" /></button></div><p className="text-xs text-slate-500">Estimated size: {room.width || '—'} × {room.height || '—'} {room.unit}</p></div><button type="button" onClick={() => updateRoomSize(room)} className="rounded-lg border border-primary-200 px-3 py-2 text-xs font-semibold text-primary-700">Edit size</button></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-4 py-3">Item</th><th className="px-3 py-3">Unit</th><th className="px-3 py-3">Qty</th><th className="px-3 py-3">Rate</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3" /></tr></thead><tbody className="divide-y divide-slate-100">{roomItems(room.id).map(item => <tr key={item.id}><td className="min-w-[210px] px-4 py-3"><input value={item.name} onChange={event => updateItem(item.id, 'name', event.target.value)} className="w-full rounded-lg border border-transparent px-2 py-1 font-semibold outline-none focus:border-primary-300" />{item.assumption && <p className="mt-1 text-xs text-amber-700">{item.assumption}</p>}</td><td className="px-3 py-3"><input value={item.unit} onChange={event => updateItem(item.id, 'unit', event.target.value)} className="w-16 rounded-lg border border-slate-200 px-2 py-1" /></td><td className="px-3 py-3"><input type="number" min="0" value={item.quantity} onChange={event => updateItem(item.id, 'quantity', event.target.value)} className="w-20 rounded-lg border border-slate-200 px-2 py-1" /></td><td className="px-3 py-3"><input type="number" min="0" value={item.unit_price} onChange={event => updateItem(item.id, 'unit_price', event.target.value)} className="w-24 rounded-lg border border-slate-200 px-2 py-1" /></td><td className="whitespace-nowrap px-3 py-3 text-right font-semibold">{formatCurrency(itemAmount(item))}</td><td className="px-3 py-3"><button type="button" onClick={() => setItems(previous => previous.filter(entry => entry.id !== item.id))} aria-label="Remove item" className="text-red-500"><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table></div><button type="button" onClick={() => addItem(room.id)} className="m-4 inline-flex items-center gap-1 rounded-lg border border-dashed border-primary-300 px-3 py-2 text-sm font-semibold text-primary-700"><Plus className="h-4 w-4" />Add item</button></div>)}{activeRoom === 'summary' && <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">Select a room to review its generated items.</div>}</div><aside className="space-y-5"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold">Quotation summary</h3><div className="mt-4 space-y-3 text-sm">{rooms.map(room => <div key={room.id} className="flex justify-between gap-3"><span>{room.name}</span><strong>{formatCurrency(roomItems(room.id).reduce((sum, item) => sum + itemAmount(item), 0))}</strong></div>)}<div className="border-t border-slate-200 pt-3"><div className="flex justify-between"><span>Sub total</span><strong>{formatCurrency(subtotal)}</strong></div><label className="mt-3 flex items-center justify-between gap-3">Discount<input type="number" min="0" value={discount} onChange={event => setDiscount(Number(event.target.value) || 0)} className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-right" /></label><label className="mt-3 flex items-center justify-between gap-3">GST (%)<input type="number" min="0" max="100" value={taxRate} onChange={event => setTaxRate(Number(event.target.value) || 0)} className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-right" /></label><div className="mt-4 flex justify-between rounded-xl bg-primary-50 px-3 py-3 text-base font-bold text-primary-800"><span>Total amount</span><span>{formatCurrency(total)}</span></div></div></div></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold">Material & finish</h3><p className="mt-3 text-sm text-slate-600">Pricing profile: <strong className="text-slate-900">{pricingProfile}</strong></p><p className="mt-2 text-sm text-slate-600">Matched items use your available designer catalogue rates.</p></div><div className="rounded-2xl border border-primary-200 bg-primary-50 p-5"><h3 className="font-bold text-primary-900">AI notes & assumptions</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-primary-900">{(job?.assumptions || []).map((note, index) => <li key={`${note}-${index}`}>{note}</li>)}{!job?.assumptions?.length && <li>Review room dimensions on site before finalizing.</li>}</ul></div></aside></div></section>}
    </main>
  </div>;
};

export default AIQuotationAssistant;
