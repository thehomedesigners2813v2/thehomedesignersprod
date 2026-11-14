import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Receipt,
  Package,
  User,
  IndianRupee as Rupee,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  History,
  ChevronDown,
  Eye,
  Download
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { generateBillPdf } from '../utils/generateBillPdf';
import BillPaymentsSection from '../components/BillPaymentsSection';

interface BillItem {
  id: string;
  item_type: string;
  name: string;
  description: string;
  number_of_units: number;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
  amount: number;
  length?: number;
  breadth?: number;
}

interface Bill {
  id: string;
  project_id: string;
  quote_id: string;
  designer_id: string;
  bill_number: string;
  subtotal: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  notes: string;
  current_version: number;
  created_at: string;
  updated_at: string;
}

interface BillVersion {
  id: string;
  bill_id: string;
  version_number: number;
  subtotal: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  notes: string;
  items_snapshot: BillItem[];
  created_at: string;
}

interface DesignerInfo {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialization: string;
}

const CustomerBillView = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();

  const [bill, setBill] = useState<Bill | null>(null);
  const [items, setItems] = useState<BillItem[]>([]);
  const [designer, setDesigner] = useState<DesignerInfo | null>(null);
  const [projectInfo, setProjectInfo] = useState<{ name: string; email: string; phone: string; location: string; project_name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Version state
  const [versions, setVersions] = useState<BillVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<BillVersion | null>(null);
  const [viewingVersion, setViewingVersion] = useState(false);
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);

  useEffect(() => {
    if (user && projectId) {
      fetchBillData();
    }
  }, [user, projectId]);

  const fetchBillData = async () => {
    if (!user || !projectId) return;

    try {
      setLoading(true);

      const { data: billData, error: billError } = await supabase
        .from('project_bills')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();

      if (billError) throw billError;

      if (!billData) {
        setError('No bill has been generated for this project yet.');
        setLoading(false);
        return;
      }

      if (billData.status === 'draft') {
        setError('The designer is still preparing the bill for this project.');
        setLoading(false);
        return;
      }

      setBill(billData);

      // Fetch project info for PDF
      const { data: projData } = await supabase
        .from('customers')
        .select('name, email, phone, location, project_name')
        .eq('id', projectId)
        .maybeSingle();

      if (projData) setProjectInfo(projData);

      const { data: itemsData, error: itemsError } = await supabase
        .from('bill_items')
        .select('*')
        .eq('bill_id', billData.id)
        .order('created_at', { ascending: true });

      if (itemsError) throw itemsError;
      setItems(itemsData || []);

      const { data: designerData, error: designerError } = await supabase
        .from('designers')
        .select('id, name, email, phone, specialization')
        .eq('id', billData.designer_id)
        .maybeSingle();

      if (!designerError && designerData) {
        setDesigner(designerData);
      }

      // Fetch versions
      const { data: versionsData } = await supabase
        .from('bill_versions')
        .select('*')
        .eq('bill_id', billData.id)
        .order('version_number', { ascending: false });

      if (versionsData) setVersions(versionsData);
    } catch (err: any) {
      console.error('Error fetching bill:', err);
      setError(err.message || 'Failed to load bill');
    } finally {
      setLoading(false);
    }
  };

  const loadVersion = (version: BillVersion) => {
    setSelectedVersion(version);
    setViewingVersion(true);
    setShowVersionDropdown(false);
  };

  const exitVersionView = () => {
    setSelectedVersion(null);
    setViewingVersion(false);
  };

  const handleDownloadPdf = () => {
    if (!bill || !projectInfo) return;
    const pdfItems = viewingVersion && selectedVersion ? selectedVersion.items_snapshot : items;
    const pdfSubtotal = viewingVersion && selectedVersion ? selectedVersion.subtotal : bill.subtotal;
    const pdfDiscount = viewingVersion && selectedVersion ? selectedVersion.discount_amount : bill.discount_amount;
    const pdfTaxRate = viewingVersion && selectedVersion ? selectedVersion.tax_rate : bill.tax_rate;
    const pdfTaxAmount = viewingVersion && selectedVersion ? selectedVersion.tax_amount : bill.tax_amount;
    const pdfTotal = viewingVersion && selectedVersion ? selectedVersion.total_amount : bill.total_amount;
    const pdfNotes = viewingVersion && selectedVersion ? selectedVersion.notes : bill.notes;

    generateBillPdf({
      billNumber: bill.bill_number,
      status: viewingVersion && selectedVersion ? selectedVersion.status : bill.status,
      createdAt: bill.created_at,
      projectName: projectInfo.project_name,
      customerName: projectInfo.name,
      customerEmail: projectInfo.email,
      customerPhone: projectInfo.phone,
      customerLocation: projectInfo.location,
      designerName: designer?.name,
      designerSpecialization: designer?.specialization,
      items: pdfItems,
      subtotal: pdfSubtotal,
      discountAmount: pdfDiscount,
      taxRate: pdfTaxRate,
      taxAmount: pdfTaxAmount,
      totalAmount: pdfTotal,
      notes: pdfNotes,
      versionNumber: viewingVersion && selectedVersion ? selectedVersion.version_number : undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3" /> Pending Payment
          </span>
        );
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
            <CheckCircle className="w-3 h-3" /> Paid
          </span>
        );
      case 'partially_paid':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" /> Partially Paid
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">
            <FileText className="w-3 h-3" /> {status}
          </span>
        );
    }
  };

  const getItemTypeLabel = (type: string) => {
    switch (type) {
      case 'material': return 'Material';
      case 'labor': return 'Labor';
      case 'service': return 'Service';
      case 'component': return 'Component';
      default: return 'Other';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          <p className="text-gray-600">Loading bill...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6">
            <ArrowLeft className="w-5 h-5" /> Back
          </button>
          <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Bill Not Available</h2>
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!bill) return null;

  // Determine what to display based on version view
  const displayItems = viewingVersion && selectedVersion ? selectedVersion.items_snapshot : items;
  const displaySubtotal = viewingVersion && selectedVersion ? selectedVersion.subtotal : bill.subtotal;
  const displayDiscount = viewingVersion && selectedVersion ? selectedVersion.discount_amount : bill.discount_amount;
  const displayTaxRate = viewingVersion && selectedVersion ? selectedVersion.tax_rate : bill.tax_rate;
  const displayTaxAmount = viewingVersion && selectedVersion ? selectedVersion.tax_amount : bill.tax_amount;
  const displayTotal = viewingVersion && selectedVersion ? selectedVersion.total_amount : bill.total_amount;
  const displayNotes = viewingVersion && selectedVersion ? selectedVersion.notes : bill.notes;

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Receipt className="w-6 h-6 text-teal-600" />
                Project Bill
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {bill.bill_number}
                {bill.current_version ? ` &middot; v${bill.current_version}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Version Dropdown */}
            {versions.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowVersionDropdown(!showVersionDropdown)}
                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <History className="w-4 h-4" />
                  <span className="hidden sm:inline">Versions</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {showVersionDropdown && (
                  <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-lg shadow-lg border z-50 max-h-72 overflow-y-auto">
                    <div className="p-2">
                      <p className="text-xs font-medium text-gray-500 px-2 py-1 uppercase tracking-wide">Bill Versions</p>
                      {viewingVersion && (
                        <button
                          onClick={exitVersionView}
                          className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 mb-1 transition-colors"
                        >
                          Back to Current Bill
                        </button>
                      )}
                      {versions.map((version) => (
                        <button
                          key={version.id}
                          onClick={() => loadVersion(version)}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-100 transition-colors ${
                            selectedVersion?.id === version.id ? 'bg-gray-100 font-medium' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-800">Version {version.version_number}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{version.status}</span>
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-xs text-gray-500">
                              {new Date(version.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                            <span className="text-xs font-medium text-gray-700">
                              {version.total_amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={handleDownloadPdf}
              className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">PDF</span>
            </button>
            {!viewingVersion && getStatusBadge(bill.status)}
          </div>
        </div>

        {/* Version Banner */}
        {viewingVersion && selectedVersion && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800 text-sm">
              <Eye className="w-4 h-4" />
              <span className="font-medium">Viewing Version {selectedVersion.version_number}</span>
              <span className="text-amber-600">
                &middot; {new Date(selectedVersion.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <button
              onClick={exitVersionView}
              className="px-3 py-1 bg-amber-100 text-amber-800 rounded-md text-sm font-medium hover:bg-amber-200 transition-colors"
            >
              Back to Current
            </button>
          </div>
        )}

        {/* Bill Card */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {/* Designer Info */}
          {designer && (
            <div className="px-6 py-4 bg-gradient-to-r from-teal-50 to-cyan-50 border-b border-teal-100">
              <p className="text-xs text-teal-600 font-medium uppercase tracking-wide mb-1">Billed By</p>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  {designer.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{designer.name}</p>
                  <p className="text-sm text-gray-600">{designer.specialization}</p>
                </div>
              </div>
            </div>
          )}

          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 border-b">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">#</th>
                  <th className="text-left px-5 py-3 font-medium">Item</th>
                  <th className="text-left px-5 py-3 font-medium">Type</th>
                  <th className="text-center px-5 py-3 font-medium">Qty</th>
                  <th className="text-center px-5 py-3 font-medium">Unit</th>
                  <th className="text-right px-5 py-3 font-medium">Rate</th>
                  <th className="text-right px-5 py-3 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayItems.map((item, index) => (
                  <tr key={item.id || index} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 text-gray-400">{index + 1}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-800">{item.name}</p>
                      {item.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                        {getItemTypeLabel(item.item_type)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center text-gray-700">
                      {item.quantity}
                      {item.number_of_units > 1 && (
                        <span className="text-xs text-gray-400 ml-1">({item.number_of_units} units)</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center text-gray-600">{item.unit}</td>
                    <td className="px-5 py-3 text-right text-gray-700">
                      {item.unit_price.toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-gray-900">
                      <Rupee className="w-3 h-3 inline -mt-0.5" />
                      {(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
                {displayItems.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-gray-400">
                      No items in this bill version.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-5">
            <div className="max-w-xs ml-auto space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="text-gray-800">
                  <Rupee className="w-3.5 h-3.5 inline -mt-0.5" />
                  {displaySubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {displayDiscount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Discount</span>
                  <span className="text-green-600">
                    - <Rupee className="w-3.5 h-3.5 inline -mt-0.5" />
                    {displayDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax ({displayTaxRate}%)</span>
                <span className="text-gray-800">
                  <Rupee className="w-3.5 h-3.5 inline -mt-0.5" />
                  {displayTaxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="border-t border-gray-300 pt-2 flex justify-between">
                <span className="text-base font-bold text-gray-900">Total</span>
                <span className="text-lg font-bold text-teal-700">
                  <Rupee className="w-4 h-4 inline -mt-0.5" />
                  {displayTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {!viewingVersion && (
            <div className="px-6 py-5 border-t border-gray-100">
              <BillPaymentsSection
                projectId={bill.project_id}
                billId={bill.id}
                billTotal={Number(bill.total_amount)}
                mode="customer"
                onUpdated={async () => {
                  const { data } = await supabase
                    .from('project_bills')
                    .select('status')
                    .eq('id', bill.id)
                    .maybeSingle();
                  if (data?.status) setBill((current) => current ? { ...current, status: data.status } : current);
                }}
              />
            </div>
          )}

          {/* Notes */}
          {displayNotes && (
            <div className="px-6 py-4 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-gray-700">{displayNotes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Generated on {new Date(bill.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            {bill.current_version > 0 && (
              <span>Current version: v{bill.current_version}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerBillView;
