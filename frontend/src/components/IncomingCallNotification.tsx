import React, { useEffect, useState } from 'react';
import { useAppState } from '../contexts/AppStateContext';

export const IncomingCallNotification: React.FC = () => {
  const { state, acceptDirectCall, rejectDirectCall } = useAppState();
  const [isVisible, setIsVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (state.directCall.incomingCall) {
      setAnimating(true);
      setIsVisible(true);
    } else {
      setAnimating(false);
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [state.directCall.incomingCall]);

  if (!isVisible) return null;

  const incomingCall = state.directCall.incomingCall;
  const caller = incomingCall ? state.users.get(incomingCall.from) : null;

  const handleAccept = () => {
    if (incomingCall) {
      acceptDirectCall(incomingCall.callId);
    }
  };

  const handleReject = () => {
    rejectDirectCall();
    setIsVisible(false);
  };

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ${
        animating ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}
    >
      <div className="bg-white rounded-lg shadow-2xl p-6 w-80 border-l-4 border-blue-500">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Incoming Call</h3>
          <div className="flex gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          </div>
        </div>
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-1">From:</p>
          <p className="text-base font-semibold text-gray-900">
            {caller ? caller.username : 'Unknown User'}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleReject}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallNotification;