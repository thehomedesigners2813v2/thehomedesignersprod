import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Users, Calendar, Star, TrendingUp, Clock, CheckCircle, AlertCircle, Eye, MessageSquare, Award, Target, Activity, FileText, X, XCircle, BarChart as BarChartIcon, PieChart as PieChartIcon, LineChart as LineChartIcon, ArrowLeft, Filter, Search, CreditCard as Edit, Trash2, Send, Plus, ThumbsDown, Download, Mail, Phone, Edit3, ShieldCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useDesignerProfile } from '../hooks/useDesignerProfile';
import { supabase } from '../lib/supabase';
import { downloadFileFromStorage } from '../utils/downloadFile';
import QuoteMessagingPanel from '../components/QuoteMessagingPanel';

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
  design_image_url?: string | null;
  project: {
    project_name: string;
    name: string; // customer name
    email: string;
    phone: string;
    property_type: string;
  };
  items_count: { count: number };
  items?: {
    id: string;
    name: string;
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    amount: number;
  }[];
}

const DesignerQuotes = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { designer, isDesigner, loading: designerLoading } = useDesignerProfile();
  
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [showMessages, setShowMessages] = useState(false);
  const [changeRequests, setChangeRequests] = useState<Record<string, any[]>>({});
  const [unreadMessages, setUnreadMessages] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!designerLoading && designer) {
      fetchQuotes();
    }
  }, [designer, designerLoading]);

  // Realtime: refresh quotes when the designer_quotes table changes
  useEffect(() => {
    if (!designer) return;

    const channel = supabase
      .channel('designer-quotes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'designer_quotes',
          filter: `designer_id=eq.${designer.id}`,
        },
        () => {
          fetchQuotes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [designer]);

  const fetchQuotes = async () => {
    if (!designer) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('designer_quotes')
        .select(`
          *,
          project:customers!designer_quotes_project_id_fkey(project_name, name, email, phone, property_type),
          items_count:quote_items(count)
        `)
        .eq('designer_id', designer.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setQuotes(data || []);

      // Fetch change requests and unread message counts for these quotes
      const quoteIds = (data || []).map((q: any) => q.id);
      if (quoteIds.length > 0) {
        const { data: crData } = await supabase
          .from('quote_change_requests')
          .select('*')
          .in('quote_id', quoteIds)
          .order('created_at', { ascending: false });

        const crMap: Record<string, any[]> = {};
        (crData || []).forEach((cr: any) => {
          if (!crMap[cr.quote_id]) crMap[cr.quote_id] = [];
          crMap[cr.quote_id].push(cr);
        });
        setChangeRequests(crMap);

        const { data: msgData } = await supabase
          .from('quote_messages')
          .select('quote_id')
          .in('quote_id', quoteIds)
          .eq('sender_role', 'customer')
          .eq('read_by_designer', false);

        const msgMap: Record<string, number> = {};
        (msgData || []).forEach((m: any) => {
          msgMap[m.quote_id] = (msgMap[m.quote_id] || 0) + 1;
        });
        setUnreadMessages(msgMap);
      }
    } catch (error: any) {
      console.error('Error fetching quotes:', error);
      setError(error.message || 'Failed to load quotes');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuote = async (id: string) => {
    if (!confirm('Are you sure you want to delete this quote? This action cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Delete quote (cascade will delete items)
      const { error } = await supabase
        .from('designer_quotes')
        .delete()
        .eq('id', id)
        .eq('designer_id', designer?.id);

      if (error) throw error;

      setSuccess('Quote deleted successfully!');
      fetchQuotes();
    } catch (error: any) {
      console.error('Error deleting quote:', error);
      setError(error.message || 'Failed to delete quote');
    } finally {
      setLoading(false);
    }
  };

  const handleSendQuote = async (id: string) => {
    try {
      setLoading(true);
      setError(null); 
      setSuccess(null); 

      const { error } = await supabase
        .from('designer_quotes')
        .update({ status: 'sent' })
        .eq('id', id)
        .eq('designer_id', designer?.id);

      if (error) {
        console.error('Error sending quote:', error);
        throw error;
      }

      setSuccess('Quote sent to customer successfully!');
      fetchQuotes();
    } catch (error: any) {
      console.error('Error sending quote:', error);
      setError(error.message || 'Failed to send quote');
    } finally {
      setLoading(false);
    }
  };

  const filteredQuotes = quotes.filter(quote => {
    const matchesSearch = !searchTerm || 
                         quote.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         quote.quote_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         quote.project?.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         quote.project?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || quote.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium">Draft</span>;
      case 'sent':
        return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">Sent</span>;
      case 'changes_requested':
        return <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1">
          <Edit3 className="w-3 h-3" />
          <span>Changes Requested</span>
        </span>;
      case 'accepted':
        return <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1">
          <CheckCircle className="w-3 h-3" />
          <span>Accepted</span>
        </span>;
      case 'rejected':
        return <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1">
          <ThumbsDown className="w-3 h-3" />
          <span>Rejected</span>
        </span>;
      case 'expired':
        return <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">Expired</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium">{status}</span>;
    }
  };

  if (designerLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !isDesigner) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-secondary-800 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-4">You need to be a registered designer to access this page.</p>
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => navigate('/designer-dashboard')}
                className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </button>
              <h1 className="text-3xl font-bold text-secondary-800 mb-2">
                Customer Quotes
              </h1>
              <p className="text-gray-600">
                Manage quotes for your customer projects
              </p>
            </div>
            <button
              onClick={() => navigate('/customer-projects')}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Create New Quote</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success/Error Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6 flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg mb-6 flex items-start space-x-2">
            <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-secondary-800">Filter Quotes</h2>
            </div>
            
            <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search quotes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full md:w-64 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full md:w-48 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>
        </div>

        {/* Quotes List */}
        {loading && quotes.length === 0 ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading quotes...</p>
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-lg">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-secondary-800 mb-4">No Quotes Found</h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              {quotes.length === 0 
                ? "You haven't created any quotes yet."
                : "No quotes match your current search filters."}
            </p>
            {quotes.length === 0 && (
              <button
                onClick={() => navigate('/customer-projects')}
                className="btn-primary"
              >
                Create Your First Quote
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredQuotes.map((quote) => (
              <div key={quote.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-secondary-800 line-clamp-1">
                        {quote.title}
                      </h3>
                      <p className="text-sm text-gray-500">{quote.quote_number}</p>
                    </div>
                    {getStatusBadge(quote.status)}
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {quote.description || 'No description provided'}
                  </p>

                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4" />
                      <span>Project: {quote.project?.project_name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4" />
                      <span>Valid until: {new Date(quote.valid_until).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-gray-50">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-gray-500">Total Amount</p>
                      <p className="text-xl font-bold text-primary-600 flex items-center space-x-1">
                        <span>{formatCurrency(quote.total_amount)}</span>
                        {quote.customer_accepted && <CheckCircle className="w-4 h-4 text-green-500" />}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Items</p>
                      <p className="font-medium text-secondary-800">{quote.items_count ? quote.items_count.count : 0}</p>
                    </div>
                  </div>
                  
                  {quote.customer_accepted && (
                    <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-2 text-sm text-green-800 flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                      <div className="flex-1">
                        <p className={`text-xl font-bold ${quote.customer_accepted ? 'text-green-600' : 'text-primary-600'}`}>
                          {formatCurrency(quote.total_amount)}
                        </p>
                        <p className="text-xs">{new Date(quote.acceptance_date).toLocaleDateString()}</p>
                      </div>
                      <div className="bg-green-200 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                        Confirmed
                      </div>
                    </div>
                  )}

                  {/* Change Request indicator */}
                  {changeRequests[quote.id] && changeRequests[quote.id].some((cr: any) => cr.status === 'pending') && (
                    <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                      <div className="flex items-center space-x-2 text-amber-800 mb-1">
                        <Edit3 className="w-4 h-4 flex-shrink-0" />
                        <span className="font-medium">Customer Requested Changes</span>
                      </div>
                      <p className="text-xs text-amber-700">
                        {changeRequests[quote.id].find((cr: any) => cr.status === 'pending')?.change_options?.join(', ') || 'View details'}
                      </p>
                    </div>
                  )}

                  {/* Unread messages indicator */}
                  {unreadMessages[quote.id] > 0 && (
                    <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-2 text-sm text-blue-700 flex items-center space-x-2">
                      <MessageSquare className="w-4 h-4 flex-shrink-0" />
                      <span>{unreadMessages[quote.id]} unread message{unreadMessages[quote.id] > 1 ? 's' : ''} from customer</span>
                    </div>
                  )}

                  <div className="flex space-x-2">
                    <button
                      onClick={async () => {
                        const { data: itemsData } = await supabase
                          .from('quote_items')
                          .select('*')
                          .eq('quote_id', quote.id)
                          .order('created_at', { ascending: true });
                        setSelectedQuote({ ...quote, items: itemsData || [] });
                      }}
                      className={`flex-1 ${quote.customer_accepted ? 'bg-green-500 hover:bg-green-600' : 'bg-primary-500 hover:bg-primary-600'} text-white py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-1`}
                    >
                      <span>{quote.customer_accepted ? 'View Confirmed' : 'View'}</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        setSelectedQuote(quote);
                        setShowMessages(true);
                      }}
                      className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded-lg font-medium transition-colors relative"
                      title="Messages"
                    >
                      <MessageSquare className="w-4 h-4" />
                      {unreadMessages[quote.id] > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                          {unreadMessages[quote.id]}
                        </span>
                      )}
                    </button>
                    
                    {quote.status === 'draft' && (
                      <>
                        <button
                          onClick={() => navigate(`/generate-quote/${quote.project_id}`)}
                          className="bg-secondary-500 hover:bg-secondary-600 text-white py-2 px-3 rounded-lg font-medium transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleSendQuote(quote.id)}
                          className="bg-green-500 hover:bg-green-600 text-white py-2 px-3 rounded-lg font-medium transition-colors"
                          title="Send to Customer"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    
                    <button
                      onClick={() => handleDeleteQuote(quote.id)}
                      className="bg-red-500 hover:bg-red-600 text-white py-2 px-3 rounded-lg font-medium transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {/* Status Message */}
                {quote.status === 'sent' && (
                  <div className="mt-2 text-xs text-blue-600 flex items-center space-x-1">
                    <Send className="w-3 h-3" />
                    <span>Quote sent to customer</span>
                  </div>
                )}
              </div>
            ))}
          </div>
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

        {/* Change Request Details */}
        {changeRequests[selectedQuote.id] && changeRequests[selectedQuote.id].filter((cr: any) => cr.status === 'pending').length > 0 && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-5">
            <h4 className="font-semibold text-amber-800 mb-3 flex items-center space-x-2">
              <Edit3 className="w-5 h-5" />
              <span>Customer Change Request</span>
            </h4>
            {changeRequests[selectedQuote.id].filter((cr: any) => cr.status === 'pending').map((cr: any) => (
              <div key={cr.id} className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">Requested Changes:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cr.change_options?.map((opt: string) => (
                      <span key={opt} className="bg-amber-100 text-amber-800 px-2 py-1 rounded-md text-xs">
                        {opt.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
                {cr.target_budget && (
                  <p className="text-sm text-gray-700"><span className="font-medium">Target Budget:</span> ₹{cr.target_budget.toLocaleString('en-IN')}</p>
                )}
                {cr.additional_instructions && (
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1">Instructions:</p>
                    <p className="text-sm text-gray-700 bg-white rounded-lg p-3 border border-amber-100">{cr.additional_instructions}</p>
                  </div>
                )}
                <p className="text-xs text-gray-500">Revision round {cr.revision_round} of 3</p>
                <button
                  onClick={() => navigate(`/generate-quote/${selectedQuote.project_id}?revise=${selectedQuote.id}`)}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Submit Revised Quotation</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {selectedQuote.status === 'accepted' && selectedQuote.project && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-5">
            <h4 className="font-semibold text-green-800 mb-3 flex items-center space-x-2">
              <CheckCircle className="w-5 h-5" />
              <span>Customer Contact Details</span>
            </h4>
            <p className="text-sm text-green-700 mb-3">Quote accepted - you can now contact the customer directly.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-3 bg-white rounded-lg p-3 border border-green-100">
                <Mail className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <a href={`mailto:${selectedQuote.project.email}`} className="text-sm font-medium text-green-700 hover:underline">
                    {selectedQuote.project.email}
                  </a>
                </div>
              </div>
              <div className="flex items-center space-x-3 bg-white rounded-lg p-3 border border-green-100">
                <Phone className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-xs text-gray-500">Phone</p>
                  <a href={`tel:${selectedQuote.project.phone}`} className="text-sm font-medium text-green-700 hover:underline">
                    {selectedQuote.project.phone}
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedQuote.design_image_url && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-secondary-800">2D Design</h4>
              <button
                onClick={() => downloadFileFromStorage(selectedQuote.design_image_url!, `2d-design-${selectedQuote.quote_number}.png`)}
                className="flex items-center space-x-2 bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors text-sm"
              >
                <Download className="w-4 h-4" />
                <span>Download Design</span>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              This design was created using the 2D design tool. Use the download button to save it.
            </p>
          </div>
        )}

        {/* Items Table */}
        <div className="mb-6">
          <h4 className="font-semibold text-secondary-800 mb-3">Quote Items</h4>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Item</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Description</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Units</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Total Sq Ft</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Unit Price</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {selectedQuote.items?.length > 0 ? selectedQuote.items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm font-medium text-gray-800">{item.name}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{item.description}</td>
                    <td className="py-3 px-4 text-sm text-gray-600 text-right">{item.number_of_units || 1}</td>
                    <td className="py-3 px-4 text-sm text-gray-600 text-right">{item.quantity} {item.unit}</td>
                    <td className="py-3 px-4 text-sm text-gray-600 text-right">₹{item.unit_price.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 text-sm font-medium text-gray-800 text-right">₹{item.amount.toLocaleString('en-IN')}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="py-3 px-4 text-sm text-gray-500 text-center">No items available</td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={5} className="py-3 px-4 text-sm font-semibold text-gray-700 text-right">Subtotal</td>
                  <td className="py-3 px-4 text-sm font-semibold text-gray-700 text-right">₹{selectedQuote.subtotal.toLocaleString('en-IN')}</td>
                </tr>
                {selectedQuote.discount_amount > 0 && (
                  <tr>
                    <td colSpan={5} className="py-3 px-4 text-sm font-semibold text-gray-700 text-right">Discount</td>
                    <td className="py-3 px-4 text-sm font-semibold text-green-600 text-right">-₹{selectedQuote.discount_amount.toLocaleString('en-IN')}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={5} className="py-3 px-4 text-sm font-semibold text-gray-700 text-right">
                    Tax ({selectedQuote.tax_rate}%)
                  </td>
                  <td className="py-3 px-4 text-sm font-semibold text-gray-700 text-right">₹{selectedQuote.tax_amount.toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                  <td colSpan={5} className="py-3 px-4 text-base font-bold text-secondary-800 text-right">Total</td>
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

      {/* Designer Messaging Panel */}
      {showMessages && selectedQuote && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
            <QuoteMessagingPanel quoteId={selectedQuote.id} role="designer" onClose={() => { setShowMessages(false); setSelectedQuote(null); fetchQuotes(); }} />
          </div>
        </div>
      )}

    </div>
  );
};

export default DesignerQuotes;