import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, MapPin, Home, FileText, X, Plus, ExternalLink, Heart, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import WelcomeModal from '../components/WelcomeModal';
import ImageUploader from '../components/ImageUploader';

const CustomerRegistration = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [isFirstProject, setIsFirstProject] = useState(false);
  const [showSimpleConfirmation, setShowSimpleConfirmation] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    location: '',
    project_name: '',
    property_type: '',
    project_area: '',
    budget_range: '',
    timeline: '',
    requirements: '',
    layout_image_url: '',
    inspiration_links: [''],
    room_types: [''],
    special_requirements: ''
  });

  const propertyTypes = [
    '1 BHK Apartment',
    '2 BHK Apartment', 
    '3 BHK Apartment',
    '4+ BHK Apartment',
    'Villa/Independent House',
    'Duplex',
    'Penthouse',
    'Studio Apartment',
    'Commercial Space',
    'Office'
  ];

  const budgetRanges = [
    'Under ₹2 Lakhs',
    '₹2-5 Lakhs',
    '₹5-10 Lakhs',
    '₹10-20 Lakhs',
    '₹20-50 Lakhs',
    'Above ₹50 Lakhs'
  ];

  const timelines = [
    '1-2 months',
    '2-3 months',
    '3-6 months',
    '6-12 months',
    'More than 1 year',
    'Flexible'
  ];

  const roomTypes = [
    'Living Room',
    'Bedroom',
    'Kitchen',
    'Dining Room',
    'Bathroom',
    'Study Room',
    'Balcony',
    'Pooja Room',
    'Guest Room',
    'Kids Room'
  ];

  const locations = [
    'Pune'
  ];

  useEffect(() => {
    // Wait for auth to load
    if (authLoading) return;

    // If no user is authenticated, redirect to home
    if (!user) {
      navigate('/');
      return;
    }

    let isMounted = true;

    // Check if user has a designer profile (conflict with customer role)
    const checkUserProfile = async () => {
      try {
        // Check for designer profile (conflict)
        const { data: designerData } = await supabase
          .from('designers')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (designerData && isMounted) {
          setError('You are already registered as a designer. A user cannot be both a designer and a customer. Please use a different account to register your project.');
          return;
        }

        // If no conflicts and component is still mounted, populate form
        if (isMounted) {
          setFormData(prev => ({
            ...prev,
            email: user.email || '',
            name: user.user_metadata?.name || ''
          }));
        }
      } catch (error) {
        console.error('Error checking user profile:', error);
      }
    };

    checkUserProfile();

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, [user, authLoading, navigate]);


    const handleInputChange = (e) => {
      const { name, value } = e.target;
    
      // Prevent invalid project area values
      if (name === "project_area" && value !== "") {
        if (!/^\d+$/.test(value) || Number(value) <= 0) {
          return;
        }
      }
    
      setFormData({
        ...formData,
        [name]: value,
      });
    };

  const handleArrayChange = (field: 'inspiration_links' | 'room_types', index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item)
    }));
  };

  const addArrayField = (field: 'inspiration_links' | 'room_types') => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], '']
    }));
  };

  const removeArrayField = (field: 'inspiration_links' | 'room_types', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || loading) return;

    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.name.trim() || !formData.project_name.trim() || !formData.phone.trim()) {
        throw new Error('Please fill in all required fields');
      }

      // Validate phone number format
      if (!/^\d{10}$/.test(formData.phone)) {
        throw new Error('Phone number must be exactly 10 digits');
      }

      // Check if this is the first project for this customer
      const { data: existingProjects, error: checkError } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id);

      if (checkError) throw checkError;

      const isFirst = !existingProjects || existingProjects.length === 0;
      setIsFirstProject(isFirst);

      // Filter out empty strings from arrays
      const cleanedData = {
        ...formData,
        user_id: user.id,
        inspiration_links: formData.inspiration_links.filter(link => link.trim() !== ''),
        room_types: formData.room_types.filter(room => room.trim() !== '')
      };

      const { error: insertError } = await supabase
        .from('customers')
        .insert([cleanedData]);

      if (insertError) throw insertError;

      setSuccess(true);

      // Show appropriate modal based on whether this is first project
      if (isFirst) {
        setShowWelcomeModal(true);
      } else {
        setShowSimpleConfirmation(true);
      }
    } catch (error: any) {
      console.error('Error submitting customer registration:', error);
      setError(error.message || 'An error occurred while registering your project');
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWelcomeModalClose = () => {
    setShowWelcomeModal(false);
    navigate('/my-projects');
  };

  const handleSimpleConfirmationClose = () => {
    setShowSimpleConfirmation(false);
    navigate('/my-projects');
  };

  // Show loading while auth is being determined
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

  // If no user after auth loading is complete, show sign-in message
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-secondary-800 mb-4">Please sign in to register your project</h2>
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

  // Show success message (only if neither modal is shown)
  if (success && !showWelcomeModal && !showSimpleConfirmation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-xl p-12 max-w-md w-full mx-4 shadow-lg">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
          <h2 className="text-3xl font-bold text-secondary-800 mb-4">Project Registered!</h2>
          <p className="text-gray-600 mb-8 leading-relaxed">
            Your project has been successfully registered. Our expert designers will review your requirements and get in touch with you soon.
          </p>
          <div className="space-y-4">
            <button
              onClick={() => navigate('/my-projects')}
              className="w-full btn-primary flex items-center justify-center space-x-2"
            >
              <Heart className="w-5 h-5" />
              <span>View My Projects</span>
            </button>
            <button
              onClick={() => navigate('/designers')}
              className="w-full btn-secondary"
            >
              Browse Designers
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-secondary-800 mb-4">
                Register Your Interior Design Project
              </h1>
              <p className="text-lg text-gray-600">
                Tell us about your dream space and we'll connect you with the perfect interior designer
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-medium text-red-800 mb-1">Registration Blocked</h3>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Personal Information */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-secondary-800 mb-4">Personal Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Enter your full name"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Enter your email"
                        required
                        disabled
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number * <span className="text-xs text-gray-500">(10 digits)</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="9876543210"
                        pattern="\d{10}"
                        maxLength={10}
                        inputMode="numeric"
                        required
                      />
                    </div>
                    {formData.phone && formData.phone.length < 10 && (
                      <p className="text-xs text-orange-600 mt-1">
                        {10 - formData.phone.length} more digit{10 - formData.phone.length !== 1 ? 's' : ''} required
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Location *
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <select
                        name="location"
                        value={formData.location}
                        onChange={handleInputChange}
                        className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      >
                        <option value="">Select your city</option>
                        {locations.map(location => (
                          <option key={location} value={location}>{location}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Project Details */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-secondary-800 mb-4">Project Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Project Name *
                    </label>
                    <div className="relative">
                      <Home className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        name="project_name"
                        value={formData.project_name}
                        onChange={handleInputChange}
                        className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="e.g., My Dream Home, Office Renovation"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Property Type *
                    </label>
                    <select
                      name="property_type"
                      value={formData.property_type}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select property type</option>
                      {propertyTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Project Area (sq ft)
                      </label>
                    
                      <input
                        type="number"
                        name="project_area"
                        value={formData.project_area}
                        onChange={handleInputChange}
                        min="1"
                        step="1"
                        onKeyDown={(e) => {
                          if (["-", "+", "e", "E", "."].includes(e.key)) {
                            e.preventDefault();
                          }
                        }}
                        onPaste={(e) => {
                          const pastedText = e.clipboardData.getData("text");
                          if (!/^\d+$/.test(pastedText)) {
                            e.preventDefault();
                          }
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="e.g., 1200 sq ft"
                      />
                    </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Budget Range *
                    </label>
                    <select
                      name="budget_range"
                      value={formData.budget_range}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select budget range</option>
                      {budgetRanges.map(range => (
                        <option key={range} value={range}>{range}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Timeline *
                    </label>
                    <select
                      name="timeline"
                      value={formData.timeline}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select timeline</option>
                      {timelines.map(timeline => (
                        <option key={timeline} value={timeline}>{timeline}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Requirements *
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <textarea
                      name="requirements"
                      value={formData.requirements}
                      onChange={handleInputChange}
                      rows={4}
                      className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Describe your vision, style preferences, specific needs, and any other requirements..."
                      required
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Special Requirements
                  </label>
                  <textarea
                    name="special_requirements"
                    value={formData.special_requirements}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Any accessibility needs, pet considerations, storage requirements, etc."
                  />
                </div>
              </div>

              {/* Home Layout Image */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-secondary-800 mb-4">Home Layout</h2>
                <div>
                  <ImageUploader
                    onImageUploaded={(url) => setFormData(prev => ({ ...prev, layout_image_url: url }))}
                    existingImageUrl={formData.layout_image_url}
                    label="2D Home Layout Image"
                    helpText="Upload your floor plan to help designers understand your space better."
                  />
                </div>
              </div>

              {/* Rooms to Design */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-secondary-800 mb-4">Rooms to Design</h2>
                {formData.room_types.map((room, index) => (
                  <div key={index} className="flex items-center space-x-2 mb-3">
                    <select
                      value={room}
                      onChange={(e) => handleArrayChange('room_types', index, e.target.value)}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">Select room type</option>
                      {roomTypes.map(roomType => (
                        <option key={roomType} value={roomType}>{roomType}</option>
                      ))}
                    </select>
                    {formData.room_types.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeArrayField('room_types', index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addArrayField('room_types')}
                  className="flex items-center space-x-2 text-primary-600 hover:text-primary-700"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Room</span>
                </button>
              </div>

              {/* Inspiration Links */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-secondary-800 mb-4">Design Inspiration</h2>
                <p className="text-gray-600 mb-4">
                  Share links to designs you love from Instagram, Pinterest, or other platforms
                </p>
                {formData.inspiration_links.map((link, index) => (
                  <div key={index} className="flex items-center space-x-2 mb-3">
                    <ExternalLink className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <input
                      type="url"
                      value={link}
                      onChange={(e) => handleArrayChange('inspiration_links', index, e.target.value)}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="https://instagram.com/p/example or https://pinterest.com/pin/example"
                    />
                    {formData.inspiration_links.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeArrayField('inspiration_links', index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addArrayField('inspiration_links')}
                  className="flex items-center space-x-2 text-primary-600 hover:text-primary-700"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Inspiration Link</span>
                </button>
              </div>

              {/* Submit Button */}
              <div className="flex justify-center">
                <button
                  type="submit"
                  disabled={loading || !!error}
                  className="btn-primary px-12 py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Submitting...' : 'Submit Project Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Welcome Modal for First Project */}
      <WelcomeModal
        isOpen={showWelcomeModal}
        onClose={handleWelcomeModalClose}
        userType="customer"
      />

      {/* Simple Confirmation Modal for Subsequent Projects */}
      {showSimpleConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Project Created Successfully!
              </h2>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Your project has been created. Please assign a designer to your project to receive quotations and begin collaboration.
              </p>
              <button
                onClick={handleSimpleConfirmationClose}
                className="w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white py-3 px-6 rounded-lg hover:from-primary-600 hover:to-primary-700 transition-all duration-200 font-semibold shadow-md hover:shadow-lg"
              >
                View My Projects
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CustomerRegistration;