import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import RegistrationSuccessModal from './RegistrationSuccessModal';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'login' | 'signup';
  onModeChange: (mode: 'login' | 'signup') => void;
  onAuthSuccess?: () => void;
  userType?: 'designer' | 'customer' | null;
}

interface ValidationErrors {
  name?: string;
  email?: string;
  password?: string;
  general?: string;
}

const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  mode,
  onModeChange,
  onAuthSuccess,
  userType = null
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [success, setSuccess] = useState('');
  const [showRegistrationSuccess, setShowRegistrationSuccess] = useState(false);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState('');

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup function to restore scroll when component unmounts
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Clear form when modal closes or mode changes
  useEffect(() => {
    if (!isOpen) {
      clearForm();
    }
  }, [isOpen]);

  const clearForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setErrors({});
    setSuccess('');
    setShowPassword(false);
  };

  const validateName = (name: string): string | undefined => {
    if (!name.trim()) {
      return 'Full name is required';
    }
    if (name.trim().length < 2) {
      return 'Name must be at least 2 characters long';
    }
    if (name.trim().length > 50) {
      return 'Name must be less than 50 characters';
    }
    if (!/^[a-zA-Z\s]+$/.test(name.trim())) {
      return 'Name can only contain letters and spaces';
    }
    return undefined;
  };

  const validateEmail = (email: string): string | undefined => {
    if (!email.trim()) {
      return 'Email address is required';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return 'Please enter a valid email address';
    }
    if (email.length > 254) {
      return 'Email address is too long';
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
    if (password.length > 128) {
      return 'Password must be less than 128 characters';
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

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    // Validate email
    const emailError = validateEmail(email);
    if (emailError) {
      newErrors.email = emailError;
    }

    // Validate password
    const passwordError = validatePassword(password);
    if (passwordError) {
      newErrors.password = passwordError;
    }

    // Validate name for signup
    if (mode === 'signup') {
      const nameError = validateName(name);
      if (nameError) {
        newErrors.name = nameError;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: 'name' | 'email' | 'password', value: string) => {
    // Clear specific field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
    
    // Clear general error
    if (errors.general) {
      setErrors(prev => ({ ...prev, general: undefined }));
    }

    switch (field) {
      case 'name':
        setName(value);
        break;
      case 'email':
        setEmail(value.toLowerCase().trim());
        break;
      case 'password':
        setPassword(value);
        break;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors and success messages
    setErrors({});
    setSuccess('');

    // Validate form
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              name: name.trim(),
              registration_type: userType || 'customer',
            },
            emailRedirectTo: `${window.location.origin}/auth/confirm`
          }
        });

        if (error) {
          // Handle specific Supabase errors
          if (error.message.includes('User already registered')) {
            setErrors({ email: 'An account with this email already exists' });
          } else if (error.message.includes('Invalid email')) {
            setErrors({ email: 'Please enter a valid email address' });
          } else if (error.message.includes('Password')) {
            setErrors({ password: error.message });
          } else {
            setErrors({ general: error.message });
          }
          return;
        }

        if (!data.user) {
          setErrors({ general: 'The account could not be created. Please try again.' });
          return;
        }

        const identities = data.user.identities ?? [];
        if (identities.length === 0) {
          setErrors({
            email: 'An account with this email already exists. Sign in, or open the confirmation email if you have not verified it yet.',
          });
          return;
        }

        // Email confirmation is enabled when sign-up does not create a session.
        if (!data.session) {
          setPendingConfirmationEmail(email.trim());
          setPassword('');
          setName('');
          setShowRegistrationSuccess(true);
          return;
        }

        setSuccess('Account created successfully.');
        setTimeout(() => {
          clearForm();
          onClose();
          if (onAuthSuccess) {
            onAuthSuccess();
          }
        }, 800);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          // Handle specific Supabase errors
          if (error.message.includes('Invalid login credentials')) {
            setErrors({ general: 'Invalid email or password. Please check your credentials and try again.' });
          } else if (error.message.includes('Email not confirmed')) {
            setErrors({ general: 'Please check your email and click the confirmation link to verify your account before signing in.' });
          } else if (error.message.includes('Too many requests')) {
            setErrors({ general: 'Too many login attempts. Please wait a moment before trying again.' });
          } else {
            setErrors({ general: error.message });
          }
          return;
        }

        if (data.user) {
          // Check for email confirmation
          if (!data.user.email_confirmed_at) {
            setErrors({ general: 'Please verify your email address before signing in. Check your inbox for the confirmation link.' });
            await supabase.auth.signOut();
            return;
          }

          // Check if user is a designer and validate verification status
          const { data: designerData, error: designerError } = await supabase
            .from('designers')
            .select('verification_status, rejected_reason')
            .eq('user_id', data.user.id)
            .maybeSingle();

          if (designerError) {
            console.error('Error checking designer status:', designerError);
          }

          // If user is a designer, validate their verification status
          if (designerData) {
            if (designerData.verification_status === 'pending') {
              setErrors({
                general: 'Your designer account is pending approval. An administrator will review your profile and approve it shortly. You will receive an email notification once your account is verified.'
              });
              await supabase.auth.signOut();
              return;
            }

            if (designerData.verification_status === 'rejected') {
              const rejectionMessage = designerData.rejected_reason
                ? `Your designer account has been rejected. Reason: ${designerData.rejected_reason}`
                : 'Your designer account has been rejected. Please contact support for more information.';

              setErrors({ general: rejectionMessage });
              await supabase.auth.signOut();
              return;
            }

            // If verification_status is 'verified', allow login
          }

          // All validations passed
          setSuccess('Signed in successfully!');
          setTimeout(() => {
            clearForm();
            onClose();
            // Call the success callback if provided
            if (onAuthSuccess) {
              onAuthSuccess();
            }
          }, 1000);
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      setErrors({ general: 'An unexpected error occurred. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    clearForm();
    onClose();
  };

  const handleModeChange = (newMode: 'login' | 'signup') => {
    const keptEmail = email;
    clearForm();
    setEmail(keptEmail);
    onModeChange(newMode);
  };

  const handleRegistrationSuccessClose = () => {
    setShowRegistrationSuccess(false);
    setPassword('');
    setName('');
    setSuccess(`We sent a confirmation link to ${pendingConfirmationEmail}. Open that email, then sign in here.`);
    onModeChange('login');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-secondary-800">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`pl-10 w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter your full name"
                  required
                  autoComplete="name"
                />
              </div>
              {errors.name && (
                <div className="flex items-center space-x-1 mt-1">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <p className="text-sm text-red-600">{errors.name}</p>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address *
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={`pl-10 w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter your email"
                required
                autoComplete="email"
              />
            </div>
            {errors.email && (
              <div className="flex items-center space-x-1 mt-1">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <p className="text-sm text-red-600">{errors.email}</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password *
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className={`pl-10 pr-10 w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  errors.password ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter your password"
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && (
              <div className="flex items-center space-x-1 mt-1">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <p className="text-sm text-red-600">{errors.password}</p>
              </div>
            )}
            {mode === 'signup' && !errors.password && (
              <div className="mt-1">
                <p className="text-xs text-gray-500">
                  Password must contain at least 6 characters with uppercase, lowercase, and numbers
                </p>
              </div>
            )}
          </div>

          {errors.general && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{errors.general}</span>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
            <button
              onClick={() => handleModeChange(mode === 'login' ? 'signup' : 'login')}
              className="ml-2 text-primary-600 hover:text-primary-700 font-medium"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>

      <RegistrationSuccessModal
        isOpen={showRegistrationSuccess}
        onClose={handleRegistrationSuccessClose}
        userType={userType || 'customer'}
      />
    </div>
  );
};

export default AuthModal;