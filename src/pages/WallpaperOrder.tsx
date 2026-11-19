import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Image as ImageIcon, Check, X, CreditCard, Sparkles, Palette } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import PaymentOptionsModal from '../components/payments/PaymentOptionsModal';

interface WallpaperOrderData {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  wall_size_length: number;
  wall_size_height: number;
  wall_unit: string;
  reference_images: string[];
  wallpaper_type: string;
  rate_per_sqft: number;
  total_area_sqft: number;
  total_amount: number;
  advance_amount: number;
  payment_screenshot_url: string | null;
  preview_image_url: string | null;
  status: string;
  order_date: string;
  confirmation_date: string | null;
  delivery_date: string | null;
  notes: string | null;
  payment_method: string | null;
  payment_status: string | null;
}

interface SelectedWallpaper {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  category: string;
}

export default function WallpaperOrder() {
  const location = useLocation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [orders, setOrders] = useState<WallpaperOrderData[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isCustomOrder, setIsCustomOrder] = useState(false);
  const [selectedWallpaper, setSelectedWallpaper] = useState<SelectedWallpaper | null>(null);
  const [paymentStep, setPaymentStep] = useState<'form' | 'payment' | 'success'>('form');
  const [pendingOrder, setPendingOrder] = useState<{ id: string; advance: number } | null>(null);
  const [nameError, setNameError] = useState('');
  const [wallLengthError, setWallLengthError] = useState('');
  const [wallHeightError, setWallHeightError] = useState('');
  

  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    customer_city: 'Pune',
    customer_state: 'Maharashtra',
    customer_pincode: '',
    wall_size_length: '',
    wall_size_height: '',
    wall_unit: 'feet',
    reference_images: [''],
    wallpaper_type: 'normal',
    notes: '',
    custom_design_description: '',
    custom_design_style: '',
    custom_color_preferences: ''
  });

  const [phoneError, setPhoneError] = useState('');
  const [pincodeError, setPincodeError] = useState('');

  const validPincodes = [
    ...Array.from({ length: 60 }, (_, i) => (411001 + i).toString()),
    '411017', '411018', '411019', '411033', '411044', '411057', '411058', '411059', '411060', '411061', '411062',
    ...Array.from({ length: 104 }, (_, i) => (400001 + i).toString())
  ];

  useEffect(() => {
    if (user) {
      fetchCustomerData();
      fetchOrders();
    }
  }, [user]);

  useEffect(() => {
    const state = location.state as { selectedWallpaper?: SelectedWallpaper; isCustomOrder?: boolean; paperGrade?: 'normal' | 'luxury' | 'golden_foil' };
    if (state?.isCustomOrder) {
      setIsCustomOrder(true);
      setShowForm(true);
    } else if (state?.selectedWallpaper) {
      setSelectedWallpaper(state.selectedWallpaper);
      setShowForm(true);

      setFormData(prev => ({
        ...prev,
        wallpaper_type: state.paperGrade || prev.wallpaper_type,
        reference_images: [state.selectedWallpaper!.image_url]
      }));
    }
  }, [location]);

  const calculateTotal = useCallback(() => {
    const length = parseFloat(formData.wall_size_length) || 0;
    const height = parseFloat(formData.wall_size_height) || 0;

    let areaSqFt = length * height;
    if (formData.wall_unit === 'inches') {
      areaSqFt = areaSqFt / 144;
    }

    const rate = formData.wallpaper_type === 'golden_foil' ? 220 : formData.wallpaper_type === 'luxury' ? 190 : 160;
    const total = areaSqFt * rate;
    const advance = total * 0.1;

    return { areaSqFt, rate, total, advance };
  }, [formData.wall_size_length, formData.wall_size_height, formData.wall_unit, formData.wallpaper_type]);

  const fetchCustomerData = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('customers')
      .select('id, name, phone')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setCustomerId(data.id);
      setFormData(prev => ({
        ...prev,
        customer_name: data.name || '',
        customer_phone: data.phone || ''
      }));
    }
  };

  const fetchOrders = async () => {
    if (!user) return;

    const { data: customerData } = await supabase
      .from('customers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!customerData) return;

    const { data } = await supabase
      .from('wallpaper_orders')
      .select('*')
      .eq('customer_id', customerData.id)
      .order('order_date', { ascending: false });

    if (data) {
      setOrders(data);
    }
  };

  const addReferenceImageField = () => {
    // Only allow adding a new field if all existing ones are filled
    const hasEmpty = formData.reference_images.some(img => img.trim() === '');
    if (hasEmpty) {
      alert('Please fill in the existing reference image URL before adding another');
      return;
    }
    setFormData(prev => ({
      ...prev,
      reference_images: [...prev.reference_images, '']
    }));
  };

  const updateReferenceImage = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      reference_images: prev.reference_images.map((img, i) => i === index ? value : img)
    }));
  };

  const removeReferenceImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      reference_images: prev.reference_images.filter((_, i) => i !== index)
    }));
  };

  const validatePhone = (phone: string) => {
    const cleaned = phone.replace(/\s/g, '');
    if (!/^\d+$/.test(cleaned)) {
      setPhoneError('Phone number must contain only numbers');
      return false;
    }
    if (cleaned.length !== 10) 
    {
      setPhoneError('Phone number must be exactly 10 digits');
      return false;
    }
    if (/^0+$/.test(cleaned)) {
      setPhoneError('Please enter a valid phone number');
      return false;
    }
    setPhoneError('');
    return true;
  };

  const validatePincode = (pincode: string, city?: string) => {
    const cleaned = pincode.replace(/\s/g, '');
    if (!/^\d+$/.test(cleaned)) {
      setPincodeError('Pincode must contain only numbers');
      return false;
    }
    if (cleaned.length !== 6) {
      setPincodeError('Pincode must be exactly 6 digits');
      return false;
    }
    if (!validPincodes.includes(cleaned)) {
      setPincodeError('Service available only in Pune (411001-411060) and Mumbai (400001-400104)');
      return false;
    }
    // Validate that pincode matches selected city
    const selectedCity = city || formData.customer_city;
    const isPunePin = parseInt(cleaned) >= 411001 && parseInt(cleaned) <= 411061;
    const isMumbaiPin = parseInt(cleaned) >= 400001 && parseInt(cleaned) <= 400104;
    if (selectedCity.toLowerCase() === 'pune' && !isPunePin) {
      setPincodeError('This pincode does not belong to Pune. Please enter a valid Pune pincode (411001-411060)');
      return false;
    }
    if (selectedCity.toLowerCase() === 'mumbai' && !isMumbaiPin) {
      setPincodeError('This pincode does not belong to Mumbai. Please enter a valid Mumbai pincode (400001-400104)');
      return false;
    }
    setPincodeError('');
    return true;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData({ ...formData, customer_phone: value });
    if (value) validatePhone(value);
    else setPhoneError('');
  };

  const handlePincodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData({ ...formData, customer_pincode: value });
    if (value) validatePincode(value);
    else setPincodeError('');
  };

  const handleProceedToPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      alert('Please login to place an order');
      return;
    }

    if (!validatePhone(formData.customer_phone)) {
      alert('Please enter a valid 10-digit phone number');
      return;
    }

    if (!validatePincode(formData.customer_pincode)) {
      alert('Please enter a valid pincode from Pune or Mumbai area');
      return;
    }

    const cityLower = formData.customer_city.toLowerCase();
    if (cityLower !== 'pune' && cityLower !== 'mumbai') {
      alert('Service is currently available only in Pune and Mumbai, Maharashtra');
      return;
    }

    // Validate pincode matches selected city
    if (!validatePincode(formData.customer_pincode)) {
      alert('Please enter a valid pincode matching your selected city');
      return;
    }

    const { areaSqFt } = calculateTotal();
    if (areaSqFt <= 0) {
      alert('Please enter valid wall dimensions');
      return;
    }

    await createPendingOrder();
  };

  const createPendingOrder = async () => {
    if (!user) return;

    setLoading(true);

    try {
      const { areaSqFt, rate, total, advance } = calculateTotal();
      const fullAddress = `${formData.customer_address}, ${formData.customer_city}, ${formData.customer_state} - ${formData.customer_pincode}, India`;

      let finalCustomerId = customerId;

      if (!customerId) {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            user_id: user.id,
            name: formData.customer_name,
            phone: formData.customer_phone,
            email: user.email
          })
          .select()
          .single();

        if (customerError) throw customerError;
        finalCustomerId = newCustomer.id;
        setCustomerId(newCustomer.id);
      }

      const filteredImages = formData.reference_images.filter(img => img.trim() !== '');

      const { data: order, error } = await supabase
        .from('wallpaper_orders')
        .insert({
          customer_id: finalCustomerId,
          customer_name: formData.customer_name,
          customer_phone: formData.customer_phone,
          customer_address: fullAddress,
          wall_size_length: parseFloat(formData.wall_size_length),
          wall_size_height: parseFloat(formData.wall_size_height),
          wall_unit: formData.wall_unit,
          reference_images: filteredImages,
          wallpaper_type: formData.wallpaper_type,
          rate_per_sqft: rate,
          total_area_sqft: areaSqFt,
          total_amount: total,
          advance_amount: advance,
          payment_status: 'pending',
          notes: formData.notes || null,
          is_custom_order: isCustomOrder,
          custom_design_description: isCustomOrder ? (formData.custom_design_description || null) : null,
          custom_design_style: isCustomOrder ? (formData.custom_design_style || null) : null,
          custom_color_preferences: isCustomOrder ? (formData.custom_color_preferences || null) : null
        })
        .select('id')
        .single();

      if (error) throw error;

      setPendingOrder({ id: order.id, advance });
      setPaymentStep('payment');
    } catch (error: any) {
      console.error('Error creating order:', error);
      alert(error.message || 'Failed to create your order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentDone = () => {
    setPendingOrder(null);
    setPaymentStep('success');
    fetchOrders();
  };

  const resetForm = () => {
    setShowForm(false);
    setSelectedWallpaper(null);
    setIsCustomOrder(false);
    setPaymentStep('form');
    setPendingOrder(null);
    setFormData({
      customer_name: formData.customer_name,
      customer_phone: formData.customer_phone,
      customer_address: '',
      customer_city: 'Pune',
      customer_state: 'Maharashtra',
      customer_pincode: '',
      wall_size_length: '',
      wall_size_height: '',
      wall_unit: 'feet',
      reference_images: [''],
      wallpaper_type: 'normal',
      notes: '',
      custom_design_description: '',
      custom_design_style: '',
      custom_color_preferences: ''
    });
  };

  const { areaSqFt, rate, total, advance } = calculateTotal();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">3D Wallpaper Orders</h1>
          <p className="text-gray-600 mb-6">Order custom 3D wallpapers for your space in Pune & Mumbai, Maharashtra</p>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
            <h3 className="font-semibold text-orange-900 mb-2">Service Location</h3>
            <p className="text-sm text-orange-800">
              Currently available only in Pune & Mumbai, Maharashtra, India
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">Pricing Information</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>Standard paper: Rs.160 per sq ft (with installation)</li>
              <li>Luxury paper: Rs.190 per sq ft (with installation)</li>
              <li>Premium paper: Rs.220 per sq ft (with installation)</li>
              <li>10% advance payment required via Razorpay or UPI</li>
              <li>Preview will be provided before final confirmation</li>
              <li>Delivery and execution at site after confirmation</li>
              <li>Installation within 2 days</li>
            </ul>
          </div>

          {!user ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 text-center">
                Please login to place a wallpaper order
              </p>
            </div>
          ) : !showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              Place New Order
            </button>
          ) : null}
        </div>

        {user && showForm && paymentStep === 'form' && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {isCustomOrder ? 'Custom Design Request' : 'New Order'}
              </h2>
              <button
                onClick={resetForm}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Mode Toggle */}

            {selectedWallpaper && (
              <div className="mb-6 bg-gradient-to-r from-blue-50 to-slate-50 border-2 border-blue-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-blue-900 mb-3 uppercase tracking-wide">Selected Wallpaper</h3>
                <div className="flex gap-4 items-start">
                  <div className="flex-shrink-0">
                    <img
                      src={selectedWallpaper.image_url}
                      alt={selectedWallpaper.title}
                      className="w-32 h-40 object-cover rounded-lg shadow-md border-2 border-white"
                    />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-bold text-gray-900 mb-2">{selectedWallpaper.title}</h4>
                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full mb-2">
                      {selectedWallpaper.category}
                    </span>
                    {selectedWallpaper.description && (
                      <p className="text-sm text-gray-700 mt-2">{selectedWallpaper.description}</p>
                    )}
                    <div className="mt-3 flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                      <Check className="w-4 h-4" />
                      <span className="font-medium">This image has been added to your reference images</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Custom Design Panel removed — reference images below serve as the sole requirement */}

            <form onSubmit={handleProceedToPayment} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={50}
                    value={formData.customer_name}
                    onChange={(e) => {
                    const value = e.target.value;

                    if (/[^a-zA-Z\s'-]/.test(value)) {
                    setNameError("Name can contain only letters.");
                    return;
                    }

                    setNameError('');
                    setFormData({ ...formData, customer_name: value });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {nameError && (
                  <p className="mt-1 text-sm text-red-500">
                  {nameError}
                  </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.customer_phone}
                    onChange={handlePhoneChange}
                    pattern="\d{10}"
                    maxLength={10}
                    placeholder="10-digit mobile number"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      phoneError ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {phoneError && (
                    <p className="mt-1 text-sm text-red-600">{phoneError}</p>
                  )}
                </div>
              </div>

              <div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Street Address <span className="text-red-500">*</span>
  </label>

  <textarea
    required
    rows={2}
    maxLength={150}
    value={formData.customer_address}
    onChange={(e) =>
      setFormData({
        ...formData,
        customer_address: e.target.value,
      })
    }
    placeholder="House/Flat No, Building Name, Street Name"
    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
  />

  <div className="flex justify-between items-center mt-1">
    <p className="text-xs text-gray-500">
      Maximum 150 characters
    </p>

    <p
      className={`text-xs ${
        formData.customer_address.length >= 150
          ? 'text-red-500'
          : 'text-gray-500'
      }`}
    >
      {formData.customer_address.length}/150
    </p>
  </div>
</div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.customer_city}
                    onChange={(e) => {
                      const newCity = e.target.value;
                      setFormData({ ...formData, customer_city: newCity });
                      if (formData.customer_pincode) validatePincode(formData.customer_pincode, newCity);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Pune">Pune</option>
                    <option value="Mumbai">Mumbai</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Service available in Pune and Mumbai</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    State <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.customer_state}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pincode <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={formData.customer_pincode}
                    onChange={handlePincodeChange}
                    placeholder="411001"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      pincodeError ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {pincodeError ? (
                    <p className="mt-1 text-sm text-red-600">{pincodeError}</p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-500">Valid for Pune (411001-411060) and Mumbai (400001-400104)</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
              {/* Wall Length */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Wall Length <span className="text-red-500">*</span>
                </label>
            
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={formData.wall_size_length}
                  onChange={(e) => {
                    const value = e.target.value;
            
                    if (!/^\d*\.?\d{0,2}$/.test(value)) {
                      setWallLengthError('Wall Length must contain numbers only.');
                      return;
                    }
            
                    if (value.replace('.', '').length > 15) {
                      setWallLengthError('Wall Length cannot exceed 15 digits.');
                      return;
                    }
            
                    setWallLengthError('');
            
                    setFormData({
                      ...formData,
                      wall_size_length: value
                    });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
            
                {wallLengthError && (
                  <p className="mt-1 text-sm text-red-500">
                    {wallLengthError}
                  </p>
                )}
              </div>
            
            
              {/* Wall Height */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Wall Height <span className="text-red-500">*</span>
                </label>
            
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={formData.wall_size_height}
                  onChange={(e) => {
                    const value = e.target.value;
            
                    if (!/^\d*\.?\d{0,2}$/.test(value)) {
                      setWallHeightError('Wall Height must contain numbers only.');
                      return;
                    }
            
                    if (value.replace('.', '').length > 15) {
                      setWallHeightError('Wall Height cannot exceed 15 digits.');
                      return;
                    }
            
                    setWallHeightError('');
            
                    setFormData({
                      ...formData,
                      wall_size_height: value
                    });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
            
                {wallHeightError && (
                  <p className="mt-1 text-sm text-red-500">
                    {wallHeightError}
                  </p>
                )}
              </div>
            
            
              {/* Unit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unit <span className="text-red-500">*</span>
                </label>
            
                <select
                  value={formData.wall_unit}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      wall_unit: e.target.value
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="feet">Feet</option>
                  <option value="inches">Inches</option>
                </select>
              </div>
            
            </div>
            
            
            {/* Wallpaper Type */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Wallpaper Type <span className="text-red-500">*</span>
              </label>
            
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
                {/* Normal 3D Wallpaper */}
                <label
                  className={`relative flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    formData.wallpaper_type === 'normal'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="wallpaper_type"
                    value="normal"
                    checked={formData.wallpaper_type === 'normal'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        wallpaper_type: e.target.value
                      })
                    }
                    className="mr-3"
                  />
            
                  <div>
                    <div className="font-semibold text-gray-900">
                      Standard paper
                    </div>
            
                    <div className="text-sm text-gray-600">
                      Rs.160 per sq ft (with installation)
                    </div>
                  </div>
                </label>

                <label
                  className={`relative flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    formData.wallpaper_type === 'luxury'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="wallpaper_type"
                    value="luxury"
                    checked={formData.wallpaper_type === 'luxury'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        wallpaper_type: e.target.value
                      })
                    }
                    className="mr-3"
                  />
                  <div>
                    <div className="font-semibold text-gray-900">Luxury paper</div>
                    <div className="text-sm text-gray-600">Rs.190 per sq ft (with installation)</div>
                  </div>
                </label>
            
            
                {/* Golden/Silver Foil 3D Wallpaper */}
                <label
                  className={`relative flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    formData.wallpaper_type === 'golden_foil'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="wallpaper_type"
                    value="golden_foil"
                    checked={formData.wallpaper_type === 'golden_foil'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        wallpaper_type: e.target.value
                      })
                    }
                    className="mr-3"
                  />
            
                  <div>
                    <div className="font-semibold text-gray-900">
                      Premium paper
                    </div>
            
                    <div className="text-sm text-gray-600">
                      Rs.220 per sq ft (with installation)
                    </div>
                  </div>
                </label>
            
                            </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reference Image (Pinterest/Shutterstock URLs)
                {isCustomOrder && <span className="text-red-500 ml-1">*</span>}
              </label>
                {formData.reference_images.map((img, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="url"
                      required={isCustomOrder && index === 0}
                      value={img}
                      onChange={(e) => updateReferenceImage(index, e.target.value)}
                      placeholder="https://pinterest.com/... or https://shutterstock.com/..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {formData.reference_images.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeReferenceImage(index)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addReferenceImageField}
                  className="mt-1 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  + Add Another Reference Image
                </button>
              </div>

              <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Notes
              </label>
            
              <textarea
                rows={3}
                maxLength={500}
                value={formData.notes}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    notes: e.target.value
                  })
                }
                placeholder="Any special requirements or instructions..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-gray-500">
                  Maximum 500 characters
                </p>
            
                <p
                  className={`text-xs ${
                    formData.notes.length >= 500
                      ? 'text-red-500'
                      : 'text-gray-500'
                  }`}
                >
                  {formData.notes.length}/500
                </p>
              </div>
            </div>

              {areaSqFt > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Order Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Wall Area:</span>
                      <span className="font-medium">{areaSqFt.toFixed(2)} sq ft</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Rate per sq ft:</span>
                      <span className="font-medium">Rs.{rate}</span>
                    </div>
                    <div className="flex justify-between text-base font-semibold border-t pt-2">
                      <span>Total Amount:</span>
                      <span>Rs.{total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-blue-600 font-semibold">
                      <span>10% Advance Payment:</span>
                      <span>Rs.{advance.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={areaSqFt <= 0 || loading}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-5 h-5" />
                  Proceed to Payment
                </button>
              </div>
            </form>
          </div>
        )}

        {user && showForm && paymentStep === 'payment' && pendingOrder && (
          <PaymentOptionsModal
            purpose="wallpaper_order"
            referenceId={pendingOrder.id}
            title="3D wallpaper advance payment"
            description={`10% advance for your ${formData.wallpaper_type === 'golden_foil' ? 'Premium' : formData.wallpaper_type === 'luxury' ? 'Luxury' : 'Standard'} paper wallpaper order`}
            baseAmount={pendingOrder.advance}
            onPaid={handlePaymentDone}
            onSubmitted={handlePaymentDone}
            onClose={() => {
              setPendingOrder(null);
              setPaymentStep('form');
            }}
          />
        )}

        {user && showForm && paymentStep === 'success' && (
          <div className="bg-white rounded-lg shadow-md p-8 mb-6 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Order Placed Successfully!</h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Your order is saved. It is confirmed once your advance payment is verified, and you can track its status below.
            </p>
            <button
              onClick={resetForm}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              Done
            </button>
          </div>
        )}

        {user && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">My Orders</h2>

            {orders.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No orders yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div key={order.id} className={`border rounded-lg p-4 transition-colors ${(order as any).is_custom_order ? 'border-amber-200 hover:border-amber-400 bg-amber-50/30' : 'border-gray-200 hover:border-blue-300'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900">
                            {(order as any).is_custom_order ? 'Custom Design' : (order.wallpaper_type === 'golden_foil' ? 'Premium paper' : order.wallpaper_type === 'luxury' ? 'Luxury paper' : 'Standard paper')} 3D Wallpaper
                          </h3>
                          {(order as any).is_custom_order && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded-full border border-amber-300">
                              <Sparkles className="w-3 h-3" />
                              Custom
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {new Date(order.order_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          order.status === 'completed' ? 'bg-green-100 text-green-800' :
                          order.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                          order.status === 'preview_sent' ? 'bg-teal-100 text-teal-800' :
                          order.status === 'in_production' ? 'bg-yellow-100 text-yellow-800' :
                          order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {order.status.replace('_', ' ').toUpperCase()}
                        </span>
                        {order.payment_status === 'completed' && (
                          <span className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full border border-green-200">
                            Advance paid
                          </span>
                        )}
                        {order.payment_status !== 'completed' && (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full border border-amber-200">
                            Advance awaiting confirmation
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                      <div>
                        <span className="text-gray-600">Area:</span>
                        <span className="ml-2 font-medium">{order.total_area_sqft.toFixed(2)} sq ft</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Total:</span>
                        <span className="ml-2 font-medium">Rs.{order.total_amount.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Advance Paid:</span>
                        <span className="ml-2 font-medium text-green-600">Rs.{order.advance_amount.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Balance:</span>
                        <span className="ml-2 font-medium text-orange-600">Rs.{(order.total_amount - order.advance_amount).toFixed(2)}</span>
                      </div>
                    </div>

                    {order.preview_image_url && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-2">Preview Image:</p>
                        <img
                          src={order.preview_image_url}
                          alt="Preview"
                          className="w-full max-w-md h-48 object-cover rounded-lg"
                        />
                      </div>
                    )}

                    {order.reference_images && order.reference_images.length > 0 && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-2">Reference Images:</p>
                        <div className="space-y-1">
                          {order.reference_images.map((url, idx) => (
                            <a
                              key={idx}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:text-blue-700 block truncate"
                            >
                              {url}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {order.notes && (
                      <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                        <span className="font-medium">Notes:</span> {order.notes}
                      </div>
                    )}

                    {(order as any).is_custom_order && ((order as any).custom_design_style || (order as any).custom_design_description || (order as any).custom_color_preferences) && (
                      <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5 text-sm">
                        <p className="font-semibold text-amber-900 flex items-center gap-1.5 mb-2">
                          <Palette className="w-4 h-4" />
                          Custom Design Details
                        </p>
                        {(order as any).custom_design_style && (
                          <div className="flex gap-2">
                            <span className="text-amber-700 font-medium w-28 flex-shrink-0">Style:</span>
                            <span className="text-amber-900">{(order as any).custom_design_style}</span>
                          </div>
                        )}
                        {(order as any).custom_color_preferences && (
                          <div className="flex gap-2">
                            <span className="text-amber-700 font-medium w-28 flex-shrink-0">Colors:</span>
                            <span className="text-amber-900">{(order as any).custom_color_preferences}</span>
                          </div>
                        )}
                        {(order as any).custom_design_description && (
                          <div className="flex gap-2">
                            <span className="text-amber-700 font-medium w-28 flex-shrink-0">Description:</span>
                            <span className="text-amber-900">{(order as any).custom_design_description}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
