import React from 'react';
import { X, CheckCircle, Mail, User, Briefcase } from 'lucide-react';

interface RegistrationSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  userType: 'designer' | 'customer';
}

const RegistrationSuccessModal: React.FC<RegistrationSuccessModalProps> = ({ isOpen, onClose, userType }) => {
  if (!isOpen) return null;

  const isDesigner = userType === 'designer';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-4 animate-fade-in">
      <div className="relative my-auto w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl animate-scale-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
          <CheckCircle className="w-10 h-10 text-white" />
        </div>

        <h2 className="text-2xl font-bold text-secondary-800 mb-3">
          {isDesigner ? 'Registration Submitted!' : 'Account Created Successfully!'}
        </h2>

        <div className="flex items-center justify-center mb-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDesigner ? 'bg-primary-100' : 'bg-secondary-100'}`}>
            {isDesigner ? <Briefcase className="w-6 h-6 text-primary-600" /> : <User className="w-6 h-6 text-secondary-600" />}
          </div>
        </div>

        <p className="text-gray-600 mb-6 leading-relaxed">
          {isDesigner
            ? "Your designer profile has been submitted and is pending admin approval. Once verified, you'll be able to log in and start connecting with clients."
            : 'Your account has been created. Confirm your email before signing in. After that, you can register your project and connect with designers.'}
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-left">
          <div className="flex items-start space-x-3">
            <Mail className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900 mb-1">Check Your Email</p>
              <p className="text-xs text-blue-700 leading-relaxed">
                We've sent a confirmation link to your email address. Please verify your email before logging in.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white py-3 px-6 rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all duration-200 font-semibold shadow-md hover:shadow-lg"
        >
          Continue to Login
        </button>
      </div>
    </div>
  );
};

export default RegistrationSuccessModal;
