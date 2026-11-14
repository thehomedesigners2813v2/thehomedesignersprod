import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Loader2,
  AlertCircle,
  Home,
  Calendar
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { downloadFileFromStorage } from '../utils/downloadFile';

const MATERIAL_IMAGES: Record<string, string> = {
  'Clear Glass - 5mm': 'https://images.pexels.com/photos/54086/rain-raindrops-windowpane-window-54086.png?auto=compress&cs=tinysrgb&w=200&h=200',
  'Designer Mirror - 5mm': 'https://images.pexels.com/photos/32269120/pexels-photo-32269120.png?auto=compress&cs=tinysrgb&w=200&h=200',
  'Tinted Glass - 5mm': 'https://images.pexels.com/photos/2265021/pexels-photo-2265021.jpeg?auto=compress&cs=tinysrgb&w=200&h=200',
  'Wall Panels - 3D Decorative': 'https://images.pexels.com/photos/11235883/pexels-photo-11235883.jpeg?auto=compress&cs=tinysrgb&w=200&h=200',
};

const getMaterialImage = (item: { name: string; image_url?: string | null }): string | null => {
  if (item.image_url) return item.image_url;
  if (MATERIAL_IMAGES[item.name]) return MATERIAL_IMAGES[item.name];
  return null;
};

const ItemThumbnail = ({ src }: { src: string | null }) => {
  if (!src) {
    return (
      <div className="w-[50px] h-[50px] bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs text-center px-1 print-item-image">
        No image
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="material"
      className="w-[50px] h-[50px] object-contain rounded-lg border border-gray-200 print-item-image"
    />
  );
};

interface QuoteItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
  amount: number;
  width?: number;
  height?: number;
  depth?: number;
  length?: number;
  breadth?: number;
  number_of_units?: number;
  section?: string;
  width_unit?: string;
  height_unit?: string;
  depth_unit?: string;
  area_sqft?: number;
  per_sqft_rate?: number;
  image_url?: string | null;
}

interface Quote {
  id: string;
  quote_number: string;
  title: string;
  description: string;
  subtotal: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  valid_until: string;
  terms_and_conditions: string;
  notes: string;
  created_at: string;
  design_image_url?: string;
  designer: {
    name: string;
    email: string;
    phone: string;
    location: string;
    specialization: string;
  };
  project: {
    name: string;
    email: string;
    phone: string;
    location: string;
    property_type: string;
    project_name: string;
  };
  items: QuoteItem[];
}

const QuoteViewer = () => {
  const { id: projectId } = useParams();
  const [searchParams] = useSearchParams();
  const quoteId = searchParams.get('id');
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (quoteId) {
      fetchQuote();
    } else {
      setError('No quote ID provided');
      setLoading(false);
    }
  }, [quoteId]);

  const fetchQuote = async () => {
    if (!quoteId) return;

    try {
      setLoading(true);
      setError(null);

      const { data: quoteData, error: quoteError } = await supabase
        .from('designer_quotes')
        .select(`
          *,
          designer:designers(name, email, phone, location, specialization),
          project:customers!designer_quotes_project_id_fkey(name, email, phone, location, property_type, project_name)
        `)
        .eq('id', quoteId)
        .single();

      if (quoteError) throw quoteError;

      const { data: itemsData, error: itemsError } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quoteId)
        .order('created_at', { ascending: true });

      if (itemsError) throw itemsError;

      setQuote({
        ...quoteData,
        items: itemsData || []
      });
    } catch (error: any) {
      console.error('Error fetching quote:', error);
      setError(error.message || 'Failed to load quote');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!printRef.current) return;

    window.print();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading quote...</p>
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-secondary-800 mb-4">Error Loading Quote</h2>
          <p className="text-gray-600 mb-8">{error || 'Quote not found'}</p>
          <button
            onClick={() => navigate(-1)}
            className="btn-primary"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <style>
        {`
          @page {
            size: A4 landscape;
            margin: 5mm;
          }

          .quote-items-wrapper {
            width: 100%;
            max-width: 100%;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }

          .print-quote-table {
            width: 100%;
            max-width: 100%;
            table-layout: fixed;
            border-collapse: collapse;
          }

          .print-quote-table th,
          .print-quote-table td {
            min-width: 0;
            box-sizing: border-box;
            vertical-align: middle;
            overflow-wrap: normal;
            word-break: normal;
          }

          .print-quote-table th {
            font-size: 9px;
            line-height: 1.15;
            white-space: nowrap;
            padding: 8px 5px;
            text-align: center;
          }

          .print-quote-table td {
            font-size: 9px;
            line-height: 1.2;
            padding: 8px 5px;
          }

          .print-quote-table th:nth-child(1),
          .print-quote-table th:nth-child(2),
          .print-quote-table th:nth-child(3),
          .print-quote-table th:nth-child(6),
          .print-quote-table td:nth-child(1),
          .print-quote-table td:nth-child(2),
          .print-quote-table td:nth-child(3),
          .print-quote-table td:nth-child(6) {
            text-align: left;
          }

          .print-quote-table th:nth-child(n+4),
          .print-quote-table td:nth-child(n+4) {
            text-align: center;
          }

          .print-quote-table td:nth-child(1),
          .print-quote-table td:nth-child(2) {
            overflow-wrap: anywhere;
            word-break: break-word;
          }

          .print-quote-table .quote-section-row td {
            width: 100%;
            padding: 7px 8px;
            text-align: left !important;
            white-space: nowrap;
            font-size: 9px;
          }

          .print-quote-table .print-item-image {
            display: block;
            margin: 0 auto;
          }

          @media print {
            html,
            body {
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
            }

            body * {
              visibility: hidden;
            }

            #print-area,
            #print-area * {
              visibility: visible;
            }

            #print-area {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: none !important;
              margin: 0 !important;
              padding: 4mm !important;
              box-sizing: border-box !important;
              background: white !important;
              box-shadow: none !important;
              border-radius: 0 !important;
            }

            #print-area .quote-items-wrapper {
              width: 100% !important;
              max-width: 100% !important;
              overflow: visible !important;
            }

            #print-area .print-quote-table {
              width: 100% !important;
              max-width: 100% !important;
              min-width: 0 !important;
              table-layout: fixed !important;
              border-collapse: collapse !important;
              font-size: 7.5px !important;
            }

            #print-area .print-quote-table th,
            #print-area .print-quote-table td {
              padding: 3px 2px !important;
              line-height: 1.2 !important;
              white-space: normal !important;
              overflow: visible !important;
              overflow-wrap: anywhere !important;
              word-break: break-word !important;
              vertical-align: middle !important;
            }

            #print-area .print-quote-table th {
              font-size: 7.5px !important;
              line-height: 1.15 !important;
            }

            #print-area .print-quote-table .print-item-image {
              width: 30px !important;
              height: 30px !important;
              max-width: 30px !important;
              max-height: 30px !important;
              object-fit: contain !important;
            }

            #print-area .print-quote-table thead {
              display: table-header-group;
            }

            #print-area .print-quote-table tr {
              break-inside: avoid;
              page-break-inside: avoid;
            }

            #print-area .bg-gray-50,
            #print-area .bg-primary-50 {
              background-color: #f9fafb !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            .no-print {
              display: none !important;
            }

            .print-break-inside {
              break-inside: avoid;
              page-break-inside: avoid;
            }
          }
        `}
      </style>

      <div className="no-print bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center text-primary-600 hover:text-primary-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </button>
            <button
              onClick={handleDownloadPDF}
              className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div id="print-area" ref={printRef} className="bg-white rounded-xl shadow-lg p-12">
          <div className="flex flex-col md:flex-row justify-between items-start mb-12 print-break-inside">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-primary-500 rounded-full flex items-center justify-center">
                  <Home className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-secondary-800">{quote.designer.name}</h3>
                  <p className="text-gray-600">{quote.designer.specialization}</p>
                </div>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <p>{quote.designer.email}</p>
                <p>{quote.designer.phone}</p>
                <p>{quote.designer.location}</p>
              </div>
            </div>

            <div className="mt-6 md:mt-0 text-right">
              <h3 className="text-3xl font-bold text-primary-600 mb-3">QUOTATION</h3>
              <p className="text-gray-600 mb-1">
                <span className="font-medium">Quote #:</span> {quote.quote_number}
              </p>
              <p className="text-gray-600 mb-1">
                <span className="font-medium">Date:</span> {new Date(quote.created_at).toLocaleDateString()}
              </p>
              <p className="text-gray-600">
                <span className="font-medium">Valid Until:</span> {new Date(quote.valid_until).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 mb-8 print-break-inside">
            <h4 className="font-semibold text-secondary-800 mb-4 text-lg">Client Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Client Name</p>
                <p className="font-medium text-gray-800">{quote.project.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Project</p>
                <p className="font-medium text-gray-800">{quote.project.project_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium text-gray-800">{quote.project.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium text-gray-800">{quote.project.phone}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Location</p>
                <p className="font-medium text-gray-800">{quote.project.location}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Property Type</p>
                <p className="font-medium text-gray-800">{quote.project.property_type}</p>
              </div>
            </div>
          </div>

          <div className="mb-8 print-break-inside">
            <h4 className="font-semibold text-secondary-800 mb-3 text-lg">Quote Description</h4>
            <p className="text-gray-600">{quote.description || 'No description provided.'}</p>
          </div>

          {quote.design_image_url && (
            <div className="mb-8 print-break-inside">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-secondary-800 text-lg">2D Design</h4>
                <button
                  onClick={() => downloadFileFromStorage(quote.design_image_url!, `2d-design-${quote.quote_number}.png`)}
                  className="no-print flex items-center space-x-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Design</span>
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                This design was created using our 2D design tool to help you visualize the proposed layout. Use the download button to save it.
              </p>
            </div>
          )}

          <div className="mb-8">
            <h4 className="font-semibold text-secondary-800 mb-4 text-lg">Quote Items</h4>
            <div className="quote-items-wrapper w-full">
              <table
                className="w-full border border-gray-200 print-quote-table"
                style={{ tableLayout: 'fixed', width: '100%' }}
              >
                <colgroup>
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '6%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '6%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '6%' }} />
                  <col style={{ width: '7%' }} />
                </colgroup>
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-secondary-800 border-b">Item</th>
                    <th className="text-left py-3 px-4 font-semibold text-secondary-800 border-b">Description</th>
                    <th className="text-left py-3 px-4 font-semibold text-secondary-800 border-b">Image</th>
                    <th className="text-right py-3 px-4 font-semibold text-secondary-800 border-b">Units</th>
                    <th className="text-right py-3 px-4 font-semibold text-secondary-800 border-b">Total Measurement</th>
                    <th className="text-right py-3 px-4 font-semibold text-secondary-800 border-b">Unit</th>
                    <th className="text-right py-3 px-4 font-semibold text-secondary-800 border-b">Width</th>
                    <th className="text-right py-3 px-4 font-semibold text-secondary-800 border-b">Height</th>
                    <th className="text-right py-3 px-4 font-semibold text-secondary-800 border-b">Depth</th>
                    <th className="text-right py-3 px-4 font-semibold text-secondary-800 border-b">Unit Price</th>
                    <th className="text-right py-3 px-4 font-semibold text-secondary-800 border-b">Discount</th>
                    <th className="text-right py-3 px-4 font-semibold text-secondary-800 border-b">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items.filter(i => i.pricing_mode !== 'modular').length > 0 && (
                    <>
                      <tr className="bg-primary-50 quote-section-row">
                        <td colSpan={12} className="py-2 px-4 font-semibold text-primary-700 text-sm border-b">On-Site Work</td>
                      </tr>
                      {quote.items.filter(i => i.pricing_mode !== 'modular').map((item) => (
                        <tr key={item.id} className="border-b border-gray-100">
                          <td className="py-3 px-4 font-medium text-gray-800">{item.name}</td>
                          <td className="py-3 px-4 text-gray-600 text-sm">{item.description || '-'}</td>
                          <td className="py-3 px-4">
                            <ItemThumbnail src={getMaterialImage(item)} />
                          </td>
                          <td className="py-3 px-4 text-right text-gray-800">{item.number_of_units || 1}</td>
                          <td className="py-3 px-4 text-right text-gray-800">{item.quantity}</td>
                          <td className="py-3 px-4 text-right text-gray-600">{item.unit}</td>
                          <td className="py-3 px-4 text-right text-gray-600">{(item.width ?? item.length) ? (item.width ?? item.length) : '-'}</td>
                          <td className="py-3 px-4 text-right text-gray-600">{(item.height ?? item.breadth) ? (item.height ?? item.breadth) : '-'}</td>
                          <td className="py-3 px-4 text-right text-gray-600">{item.depth ? item.depth : '-'}</td>
                          <td className="py-3 px-4 text-right text-gray-800">{formatCurrency(item.unit_price)}</td>
                          <td className="py-3 px-4 text-right text-gray-600">{item.discount_percent}%</td>
                          <td className="py-3 px-4 text-right font-medium text-gray-800">{formatCurrency(item.amount)}</td>
                        </tr>
                      ))}
                    </>
                  )}
                  {quote.items.filter(i => i.pricing_mode === 'modular').length > 0 && (
                    <>
                      <tr className="bg-primary-50 quote-section-row">
                        <td colSpan={12} className="py-2 px-4 font-semibold text-primary-700 text-sm border-b">Modular Work</td>
                      </tr>
                      {quote.items.filter(i => i.pricing_mode === 'modular').map((item) => (
                        <tr key={item.id} className="border-b border-gray-100">
                          <td className="py-3 px-4 font-medium text-gray-800">{item.name}</td>
                          <td className="py-3 px-4 text-gray-600 text-sm">{item.description || '-'}</td>
                          <td className="py-3 px-4">
                            <ItemThumbnail src={getMaterialImage(item)} />
                          </td>
                          <td className="py-3 px-4 text-right text-gray-800">{item.number_of_units || 1}</td>
                          <td className="py-3 px-4 text-right text-gray-800">{item.area_sqft ?? 0} sq ft</td>
                          <td className="py-3 px-4 text-right text-gray-600">sq.ft</td>
                          <td className="py-3 px-4 text-right text-gray-600">{item.width ? `${item.width} ${item.width_unit || ''}` : '-'}</td>
                          <td className="py-3 px-4 text-right text-gray-600">{item.height ? `${item.height} ${item.height_unit || ''}` : '-'}</td>
                          <td className="py-3 px-4 text-right text-gray-600">{item.depth ? `${item.depth} ${item.depth_unit || ''}` : '-'}</td>
                          <td className="py-3 px-4 text-right text-gray-800">{formatCurrency(item.per_sqft_rate ?? item.unit_price)}/sq ft</td>
                          <td className="py-3 px-4 text-right text-gray-600">{item.discount_percent}%</td>
                          <td className="py-3 px-4 text-right font-medium text-gray-800">{formatCurrency(item.amount)}</td>
                        </tr>
                      ))}
                    </>
                  )}
                  {quote.items.length === 0 && (
                    <tr>
                      <td
                        colSpan={12}
                        className="py-8 px-4 text-center text-gray-500 border-b"
                      >
                        No quote items found for this quotation.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end mb-8 print-break-inside">
            <div className="w-full md:w-80">
              <div className="space-y-2 bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between text-gray-700">
                  <span>Subtotal:</span>
                  <span className="font-medium">{formatCurrency(quote.subtotal)}</span>
                </div>
                {quote.discount_amount > 0 && (
                  <div className="flex justify-between text-gray-700">
                    <span>Discount:</span>
                    <span className="font-medium text-green-600">-{formatCurrency(quote.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-700">
                  <span>Tax ({quote.tax_rate}%):</span>
                  <span className="font-medium">{formatCurrency(quote.tax_amount)}</span>
                </div>
                <div className="border-t border-gray-300 pt-3 mt-3">
                  <div className="flex justify-between font-bold text-lg">
                    <span className="text-secondary-800">Total:</span>
                    <span className="text-primary-600">{formatCurrency(quote.total_amount)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {quote.terms_and_conditions && (
              <div className="print-break-inside">
                <h4 className="font-semibold text-secondary-800 mb-3 text-lg">Terms and Conditions</h4>
                <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 whitespace-pre-line">
                  {quote.terms_and_conditions}
                </div>
              </div>
            )}

            {quote.notes && (
              <div className="print-break-inside">
                <h4 className="font-semibold text-secondary-800 mb-3 text-lg">Notes</h4>
                <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700">
                  {quote.notes}
                </div>
              </div>
            )}
          </div>

          <div className="mt-12 pt-8 border-t border-gray-200 text-center text-sm text-gray-500">
            <p>Thank you for your business</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuoteViewer;
