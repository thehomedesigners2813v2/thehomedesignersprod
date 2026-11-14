import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Mail, Phone, MapPin, Briefcase, Globe, IndianRupee, FileText, Award, Plus, X, Upload, ArrowLeft, Save, AlertCircle, Lock, Eye, EyeOff, Building2, Wifi } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useDesignerProfile } from '../hooks/useDesignerProfile';
import { supabase } from '../lib/supabase';
import WelcomeModal from '../components/WelcomeModal';
import RegistrationSuccessModal from '../components/RegistrationSuccessModal';
import CatalogPicker from '../components/designer/CatalogPicker';
import {
  MATERIAL_CATALOG,
  MATERIAL_CATEGORIES,
  SERVICE_CATALOG,
  decodeSelection,
  encodeSelection,
  type CustomEntry
} from '../lib/designerCatalog';

const DesignerRegistration = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { designer, loading: designerLoading, updateDesignerProfile } = useDesignerProfile();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formInitialized, setFormInitialized] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showRegistrationSuccess, setShowRegistrationSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailExists, setEmailExists] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState(false);

  const isEditMode = location.pathname === '/edit-designer-profile';

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    specialization: '',
    experience: '',
    location: '',
    bio: '',
    website: '',
    starting_price: '',
    profile_image: '',
    business_type: '' as '' | 'google_location' | 'virtual',
    google_location_url: '',
    awards: ['']
  });
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [customServices, setCustomServices] = useState<CustomEntry[]>([]);
  const [materialIds, setMaterialIds] = useState<string[]>([]);
  const [customMaterials, setCustomMaterials] = useState<CustomEntry[]>([]);
  const pendingCatalogFiles = useRef(new Map<string, File>());

  const specializations = [
    'Modern & Contemporary',
    'Traditional Indian',
    'Minimalist Design',
    'Luxury & High-End',
    'Eco-Friendly Design',
    'Industrial & Loft',
    'Scandinavian',
    'Mediterranean',
    'Art Deco',
    'Bohemian'
  ];

  const locations = [
    'Pune',
    'Mumbai'
  ];

  useEffect(() => {
    if (authLoading) return;

    if (isEditMode) {
      if (!user) {
        navigate('/');
        return;
      }

      if (designerLoading) return;

      if (!designerLoading && !designer) {
        setError('No designer profile found. Please register as a designer first.');
        return;
      }

      if (designer && !formInitialized) {
        setError(null);

        setFormData({
          name: designer.name || '',
          email: designer.email || '',
          password: '',
          phone: designer.phone || '',
          specialization: designer.specialization || '',
          experience: designer.experience?.toString() || '',
          location: designer.location || '',
          bio: designer.bio || '',
          website: designer.website || '',
          starting_price: designer.starting_price || '',
          profile_image: designer.profile_image || '',
          business_type: (designer.business_type as '' | 'google_location' | 'virtual') || '',
          google_location_url: designer.google_location_url || '',
          awards: designer.awards && designer.awards.length > 0 ? designer.awards : ['']
        });
        const savedServices = decodeSelection(designer.services, SERVICE_CATALOG);
        const savedMaterials = decodeSelection(designer.materials_expertise, MATERIAL_CATALOG);
        setServiceIds(savedServices.ids);
        setCustomServices(savedServices.custom);
        setMaterialIds(savedMaterials.ids);
        setCustomMaterials(savedMaterials.custom);

        if (designer.profile_image) {
          setProfileImagePreview(designer.profile_image);
        }

        setFormInitialized(true);
      }
    } else {
      if (!formInitialized) {
        setFormInitialized(true);
      }
    }
  }, [user, designer, authLoading, designerLoading, navigate, isEditMode, formInitialized]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    // Validate phone number: only digits, max 10 digits
    if (name === 'phone') {
      const digitsOnly = value.replace(/\D/g, '');
      const truncated = digitsOnly.slice(0, 10);
      setFormData(prev => ({
        ...prev,
        [name]: truncated
      }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (name === 'email') {
      setEmailExists(false);
      setResetEmailSent(false);
    }

    if (error) setError(null);
    if (success) setSuccess(null);
  };

  const handleArrayChange = (field: 'awards', index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item)
    }));
  };

  const addArrayField = (field: 'awards') => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], '']
    }));
  };

  const removeArrayField = (field: 'awards', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  const stageOrUploadCatalogImage = async (file: File) => {
    if (user) {
      const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '');
      const path = `${user.id}/catalog/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('designer-profiles').upload(path, file, { cacheControl: '3600' });
      if (uploadError) {
        setError(uploadError.message);
        return null;
      }
      return supabase.storage.from('designer-profiles').getPublicUrl(path).data.publicUrl;
    }

    const previewUrl = URL.createObjectURL(file);
    pendingCatalogFiles.current.set(previewUrl, file);
    return previewUrl;
  };

  const resolveCatalogEntries = async (entries: CustomEntry[], userId: string, hasSession: boolean) => {
    const resolved: CustomEntry[] = [];
    for (const entry of entries) {
      const pending = entry.imageUrl ? pendingCatalogFiles.current.get(entry.imageUrl) : undefined;
      if (pending && hasSession) {
        const safeName = pending.name.replace(/[^a-zA-Z0-9.]/g, '');
        const path = `${userId}/catalog/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from('designer-profiles').upload(path, pending, { cacheControl: '3600' });
        if (!uploadError) {
          resolved.push({ name: entry.name, imageUrl: supabase.storage.from('designer-profiles').getPublicUrl(path).data.publicUrl });
          continue;
        }
      }
      resolved.push({
        name: entry.name,
        imageUrl: entry.imageUrl && !entry.imageUrl.startsWith('blob:') ? entry.imageUrl : undefined
      });
    }
    return resolved;
  };

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, or WebP)');
      return;
    }

    // Validate file size (2MB = 2 * 1024 * 1024 bytes)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Image size must not exceed 2MB. Please choose a smaller image.');
      return;
    }

    setError(null);
    setProfileImageFile(file);

    // Create preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadProfileImage = async (userId: string): Promise<string | null> => {
    if (!profileImageFile) return null;

    try {
      setUploadingImage(true);

      const fileExt = profileImageFile.name.split('.').pop();
      const fileName = `${userId}/profile.${fileExt}`;

      // Delete old image if exists
      const { data: existingFiles } = await supabase.storage
        .from('designer-profiles')
        .list(userId);

      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles.map(file => `${userId}/${file.name}`);
        await supabase.storage
          .from('designer-profiles')
          .remove(filesToDelete);
      }

      // Upload new image
      const { data, error: uploadError } = await supabase.storage
        .from('designer-profiles')
        .upload(fileName, profileImageFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Failed to upload image: ${uploadError.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('designer-profiles')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error: any) {
      console.error('Image upload error:', error);
      throw error;
    } finally {
      setUploadingImage(false);
    }
  };

  const validateEmail = (email: string): string | undefined => {
    if (!email.trim()) {
      return 'Email address is required';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return 'Please enter a valid email address';
    }
    return undefined;
  };

  const validatePassword = (password: string): string | undefined => {
    if (!password) {
      return 'Password is required';
    }
    if (password.length < 6) {
      return 'Password must be at least 6 characters long';
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/(?=.*\d)/.test(password)) {
      return 'Password must contain at least one number';
    }
    return undefined;
  };

  const checkEmailExists = async (email: string) => {
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (existingCustomer) {
      return { exists: true, type: 'customer' as const };
    }

    const { data: existingDesigner } = await supabase
      .from('designers')
      .select('id, email')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (existingDesigner) {
      return { exists: true, type: 'designer' as const };
    }

    return { exists: false, type: null };
  };

  const handleEmailBlur = async () => {
    if (isEditMode) return;

    const emailValue = formData.email.trim();
    const emailError = validateEmail(emailValue);

    if (emailError || !emailValue) {
      setEmailExists(false);
      return;
    }

    setCheckingEmail(true);
    setError(null);

    try {
      const emailCheck = await checkEmailExists(emailValue);

      if (emailCheck.exists) {
        if (emailCheck.type === 'customer') {
          setError('This email is already registered as a customer. A user cannot be both a customer and a designer.');
          setEmailExists(false);
        } else if (emailCheck.type === 'designer') {
          setEmailExists(true);
          setError(null);
        }
      } else {
        setEmailExists(false);
      }
    } catch (error) {
      console.error('Error checking email:', error);
    } finally {
      setCheckingEmail(false);
    }
  };

  const handlePasswordReset = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        formData.email.toLowerCase().trim(),
        {
          redirectTo: `${window.location.origin}/`,
        }
      );

      if (resetError) {
        throw resetError;
      }

      setResetEmailSent(true);
      setSuccess('Password reset email sent! Please check your inbox and follow the instructions to reset your password.');
    } catch (error: any) {
      console.error('Password reset error:', error);
      setError(error.message || 'Failed to send password reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = async () => {
    if (!formData.name.trim()) {
      setError('Full name is required');
      return false;
    }

    const emailError = validateEmail(formData.email);
    if (emailError) {
      setError(emailError);
      return false;
    }

    if (!isEditMode) {
      if (emailExists) {
        setError('This email is already registered. Please use the password reset option above.');
        return false;
      }

      const passwordError = validatePassword(formData.password);
      if (passwordError) {
        setError(passwordError);
        return false;
      }

      const emailCheck = await checkEmailExists(formData.email);
      if (emailCheck.exists) {
        if (emailCheck.type === 'customer') {
          setError('This email is already registered as a customer. A user cannot be both a customer and a designer. Please use a different email address.');
        } else {
          setError('This email is already registered as a designer. Please use the login option to access your account.');
        }
        return false;
      }
    }

    if (!formData.specialization) {
      setError('Specialization is required');
      return false;
    }
    if (!formData.experience || parseInt(formData.experience) < 0) {
      setError('Valid years of experience is required');
      return false;
    }
    if (!formData.location) {
      setError('Location is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);
    setSuccess(null);

    if (!(await validateForm())) {
      return;
    }

    setLoading(true);

    try {
      let profileImageUrl = formData.profile_image.trim();

      // Handle image upload for edit mode
      if (isEditMode && designer && profileImageFile) {
        const uploadedUrl = await uploadProfileImage(designer.user_id);
        if (uploadedUrl) {
          profileImageUrl = uploadedUrl;
        }
      }

      const cleanedData = {
        name: formData.name.trim(),
        email: formData.email.toLowerCase().trim(),
        phone: formData.phone.trim(),
        specialization: formData.specialization,
        experience: parseInt(formData.experience),
        location: formData.location,
        bio: formData.bio.trim(),
        website: formData.website.trim(),
        starting_price: formData.starting_price.trim(),
        profile_image: profileImageUrl,
        business_type: formData.business_type || null,
        google_location_url: formData.business_type === 'google_location' ? formData.google_location_url.trim() : null,
        awards: formData.awards.filter(a => a.trim() !== '')
      };

      if (isEditMode && designer) {
        const savedServices = encodeSelection(serviceIds, await resolveCatalogEntries(customServices, designer.user_id, true));
        const savedMaterials = encodeSelection(materialIds, await resolveCatalogEntries(customMaterials, designer.user_id, true));
        const result = await updateDesignerProfile({ ...cleanedData, services: savedServices, materials_expertise: savedMaterials });

        if (result.error) {
          throw new Error(result.error);
        }

        setSuccess('Profile updated successfully!');

        setTimeout(() => {
          navigate(`/designers/${designer.id}`);
        }, 1500);
      } else {
        // Create the Supabase Auth account first.
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: cleanedData.email,
          password: formData.password,
          options: {
            data: {
              name: cleanedData.name,
              registration_type: 'designer',
            }
          }
        });

        if (authError) {
          if (
            authError.message.toLowerCase().includes('user already registered') ||
            authError.message.toLowerCase().includes('already registered')
          ) {
            throw new Error(
              'An account with this email already exists. Please use the login option.'
            );
          }

          throw new Error(authError.message);
        }

        if (!authData?.user) {
          throw new Error('Failed to create user account. Please try again.');
        }

        const userId = authData.user.id;
        const savedServices = encodeSelection(serviceIds, await resolveCatalogEntries(customServices, userId, Boolean(authData.session)));
        const savedMaterials = encodeSelection(materialIds, await resolveCatalogEntries(customMaterials, userId, Boolean(authData.session)));

        // Upload profile image only if we have an authenticated session.
        // When email confirmation is enabled, signUp() returns no session,
        // so the storage upload would fail RLS. The user can add their
        // profile image later from the edit profile page after logging in.
        if (profileImageFile && authData.session) {
          const uploadedUrl = await uploadProfileImage(userId);
          if (uploadedUrl) {
            profileImageUrl = uploadedUrl;
          }
        }

        // Use the SECURITY DEFINER function so the designer profile is saved
        // even when email confirmation is enabled and there is no session yet.
        const { error: designerError } = await supabase.rpc(
          'register_designer_profile',
          {
            p_user_id: userId,
            p_name: cleanedData.name,
            p_email: cleanedData.email,
            p_phone: cleanedData.phone,
            p_specialization: cleanedData.specialization,
            p_experience: cleanedData.experience,
            p_location: cleanedData.location,
            p_bio: cleanedData.bio,
            p_website: cleanedData.website,
            p_starting_price: cleanedData.starting_price,
            p_profile_image: profileImageUrl,
            p_business_type: cleanedData.business_type,
            p_google_location_url: cleanedData.google_location_url,
            p_services: savedServices,
            p_materials_expertise: savedMaterials,
            p_awards: cleanedData.awards,
          }
        );

        if (designerError) {
          console.error('Designer profile insert error:', designerError);
          await supabase.auth.signOut();
          throw new Error(
            `Failed to create designer profile: ${designerError.message}`
          );
        }

        // If signUp did not create a session, email confirmation is enabled.
        // Show the confirmation modal instead of trying to log in.
        if (!authData.session) {
          setShowRegistrationSuccess(true);
          setLoading(false);
          return;
        }

        setSuccess('Registration submitted successfully! Your profile is pending admin approval. You will be able to login once the admin verifies your profile.');
        setShowWelcomeModal(true);

        await supabase.auth.signOut();

        setTimeout(() => {
          if (!showWelcomeModal) {
            navigate('/');
          }
        }, 5000);
      }
    } catch (error: any) {
      console.error('Form submission error:', error);
      setError(error.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleWelcomeModalClose = () => {
    setShowWelcomeModal(false);
    navigate('/');
  };

  const handleRegistrationSuccessClose = () => {
    setShowRegistrationSuccess(false);
    navigate('/');
  };

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

  if (isEditMode && designerLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 text-center shadow-lg">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-500 mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-secondary-800 mb-4">Loading Designer Profile</h2>
          <p className="text-gray-600">Please wait while we fetch your designer profile information.</p>
        </div>
      </div>
    );
  }

  if (!formInitialized && !isEditMode) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing form...</p>
        </div>
      </div>
    );
  }

  if (isEditMode && !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-secondary-800 mb-4">
            Please sign in to edit your profile
          </h2>
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

  if (isEditMode && !designerLoading && !designer && error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-xl p-8 max-w-md w-full mx-4 shadow-lg">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-secondary-800 mb-4">Profile Not Found</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex space-x-4">
            <button
              onClick={() => navigate('/')}
              className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              Go Home
            </button>
            <button
              onClick={() => navigate('/register-designer')}
              className="flex-1 btn-primary"
            >
              Register Now
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
              {isEditMode && designer && (
                <button
                  onClick={() => navigate(`/designers/${designer.id}`)}
                  className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-4"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Profile
                </button>
              )}
              <h1 className="text-3xl font-bold text-secondary-800 mb-4">
                {isEditMode ? 'Edit Designer Profile' : 'Register as Interior Designer'}
              </h1>
              <p className="text-lg text-gray-600">
                {isEditMode
                  ? 'Update your professional information and portfolio details'
                  : 'Join our platform and showcase your interior design expertise to thousands of potential clients'
                }
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6 flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg mb-6">
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="bg-gray-50 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-secondary-800 mb-4">Basic Information</h2>
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
                        onBlur={handleEmailBlur}
                        className={`pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${isEditMode ? 'bg-gray-100' : ''}`}
                        placeholder="Enter your email"
                        required
                        disabled={isEditMode || checkingEmail}
                      />
                      {checkingEmail && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500"></div>
                        </div>
                      )}
                    </div>
                    {emailExists && !isEditMode && (
                      <p className="text-sm text-amber-600 mt-1 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        This email is already registered. Use forgot password to reset.
                      </p>
                    )}
                  </div>

                  {!isEditMode && !emailExists && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Password *
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          name="password"
                          value={formData.password}
                          onChange={handleInputChange}
                          className="pl-10 pr-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          placeholder="Enter your password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Password must contain at least 6 characters with uppercase, lowercase, and numbers
                      </p>
                    </div>
                  )}

                  {!isEditMode && emailExists && (
                    <div className="md:col-span-2">
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <h3 className="text-sm font-semibold text-amber-800 mb-1">
                              Email Already Registered
                            </h3>
                            <p className="text-sm text-amber-700 mb-3">
                              This email is already registered in our system. If you forgot your password, you can reset it using the button below.
                            </p>
                            {resetEmailSent ? (
                              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                <p className="text-sm text-green-700">
                                  Password reset email sent successfully! Please check your inbox and follow the instructions.
                                </p>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={handlePasswordReset}
                                disabled={loading}
                                className="btn-primary text-sm py-2 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {loading ? 'Sending...' : 'Reset Password'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number <span className="text-xs text-gray-500">(10 digits)</span>
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
                      />
                    </div>
                    {formData.phone && formData.phone.length < 10 && formData.phone.length > 0 && (
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

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Business Type
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, business_type: 'google_location', google_location_url: '' }))}
                        className={`flex items-start space-x-4 p-4 rounded-xl border-2 transition-all text-left ${
                          formData.business_type === 'google_location'
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          formData.business_type === 'google_location' ? 'bg-primary-100' : 'bg-gray-100'
                        }`}>
                          <Building2 className={`w-5 h-5 ${formData.business_type === 'google_location' ? 'text-primary-600' : 'text-gray-500'}`} />
                        </div>
                        <div>
                          <p className={`font-semibold text-sm ${formData.business_type === 'google_location' ? 'text-primary-700' : 'text-gray-800'}`}>
                            Google Location
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                            I have a physical studio or office listed on Google Maps
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, business_type: 'virtual', google_location_url: '' }))}
                        className={`flex items-start space-x-4 p-4 rounded-xl border-2 transition-all text-left ${
                          formData.business_type === 'virtual'
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          formData.business_type === 'virtual' ? 'bg-primary-100' : 'bg-gray-100'
                        }`}>
                          <Wifi className={`w-5 h-5 ${formData.business_type === 'virtual' ? 'text-primary-600' : 'text-gray-500'}`} />
                        </div>
                        <div>
                          <p className={`font-semibold text-sm ${formData.business_type === 'virtual' ? 'text-primary-700' : 'text-gray-800'}`}>
                            Virtual Business
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                            I operate remotely and serve clients online
                          </p>
                        </div>
                      </button>
                    </div>

                    {formData.business_type === 'google_location' && (
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Google Maps Link or Business Address
                        </label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="text"
                            name="google_location_url"
                            value={formData.google_location_url}
                            onChange={handleInputChange}
                            className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            placeholder="https://maps.google.com/... or your business address"
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Paste your Google Maps link or enter your studio address
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-secondary-800 mb-4">Professional Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Specialization *
                    </label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <select
                        name="specialization"
                        value={formData.specialization}
                        onChange={handleInputChange}
                        className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      >
                        <option value="">Select your specialization</option>
                        {specializations.map(spec => (
                          <option key={spec} value={spec}>{spec}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Years of Experience *
                    </label>
                    <input
                      type="number"
                      name="experience"
                      value={formData.experience}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., 5"
                      min="0"
                      max="50"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Website
                    </label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="url"
                        name="website"
                        value={formData.website}
                        onChange={handleInputChange}
                        className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="https://yourwebsite.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Starting Price
                    </label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        name="starting_price"
                        value={formData.starting_price}
                        onChange={handleInputChange}
                        className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="₹50,000"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Profile Image
                    </label>
                    <div className="space-y-3">
                      {profileImagePreview && (
                        <div className="flex items-center space-x-4">
                          <img
                            src={profileImagePreview}
                            alt="Profile preview"
                            className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setProfileImageFile(null);
                              setProfileImagePreview('');
                              setFormData(prev => ({ ...prev, profile_image: '' }));
                            }}
                            className="text-sm text-red-600 hover:text-red-700"
                          >
                            Remove Image
                          </button>
                        </div>
                      )}
                      <div className="relative">
                        <input
                          type="file"
                          id="profile-image-upload"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          onChange={handleProfileImageChange}
                          className="hidden"
                        />
                        <label
                          htmlFor="profile-image-upload"
                          className="flex items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-lg px-4 py-6 cursor-pointer hover:border-primary-500 hover:bg-gray-50 transition-colors"
                        >
                          <div className="text-center">
                            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-600">
                              Click to upload profile image
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              JPEG, PNG, or WebP (Max 2MB)
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bio / About Yourself
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <textarea
                      name="bio"
                      value={formData.bio}
                      onChange={handleInputChange}
                      rows={4}
                      className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Tell potential clients about your design philosophy, experience, and what makes you unique..."
                    />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-secondary-800 mb-4">Services Offered</h2>
                <CatalogPicker
                  items={SERVICE_CATALOG}
                  selectedIds={serviceIds}
                  custom={customServices}
                  customLabel="Add custom service"
                  onUploadImage={stageOrUploadCatalogImage}
                  onChange={(ids, custom) => { setServiceIds(ids); setCustomServices(custom); }}
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-secondary-800 mb-4">Materials Expertise</h2>
                <CatalogPicker
                  items={MATERIAL_CATALOG}
                  categories={MATERIAL_CATEGORIES}
                  selectedIds={materialIds}
                  custom={customMaterials}
                  customLabel="Add custom material"
                  onUploadImage={stageOrUploadCatalogImage}
                  onChange={(ids, custom) => { setMaterialIds(ids); setCustomMaterials(custom); }}
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-secondary-800 mb-4">Awards & Recognition</h2>
                {formData.awards.map((award, index) => (
                  <div key={index} className="flex items-center space-x-2 mb-3">
                    <Award className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <input
                      type="text"
                      value={award}
                      onChange={(e) => handleArrayChange('awards', index, e.target.value)}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., Best Residential Design 2023 - Mumbai Design Awards"
                    />
                    {formData.awards.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeArrayField('awards', index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addArrayField('awards')}
                  className="flex items-center space-x-2 text-primary-600 hover:text-primary-700"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Award</span>
                </button>
              </div>

              <div className="flex justify-center space-x-4">
                {isEditMode && (
                  <button
                    type="button"
                    onClick={() => navigate(`/designers/${designer?.id}`)}
                    className="px-8 py-3 text-lg border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading || uploadingImage || !!error || (emailExists && !isEditMode)}
                  className="btn-primary px-12 py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isEditMode ? <Save className="w-5 h-5" /> : null}
                  <span>
                    {uploadingImage
                      ? 'Uploading Image...'
                      : loading
                      ? (isEditMode ? 'Updating Profile...' : 'Registering...')
                      : (isEditMode ? 'Update Profile' : 'Register as Designer')
                    }
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <WelcomeModal
        isOpen={showWelcomeModal}
        onClose={handleWelcomeModalClose}
        userType="designer"
      />

      <RegistrationSuccessModal
        isOpen={showRegistrationSuccess}
        onClose={handleRegistrationSuccessClose}
        userType="designer"
      />
    </>
  );
};

export default DesignerRegistration;
