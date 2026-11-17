import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

interface SubscriptionExpiredModalProps {
  isOpen: boolean;
}

const SubscriptionExpiredModal: React.FC<
  SubscriptionExpiredModalProps
> = ({ isOpen }) => {
  const navigate = useNavigate();

  if (!isOpen) {
    return null;
  }

  const handleRenew = () => {
    navigate('/designer-subscription');
  };

  return (
    <div
      className="fixed top-16 left-0 right-0 bottom-0 z-[9999] flex items-center justify-center bg-black/50"
      onClick={(e) => {
        // Prevent closing when clicking outside the popup
        e.stopPropagation();
      }}
    >
      <div
        className="w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-5">
            <AlertCircle className="w-9 h-9 text-red-600" />
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Monthly subscription required
          </h2>

          <p className="text-gray-600 leading-relaxed mb-7">
            Designer tools stay closed until a monthly plan is paid.
            Choose a plan to continue.
          </p>

          <button
            type="button"
            onClick={handleRenew}
            className="w-full bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors"
          >
            Choose a plan
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionExpiredModal;