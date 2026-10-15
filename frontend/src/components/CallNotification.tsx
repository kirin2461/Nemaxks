'use client';

import React, { useState, useEffect } from 'react';
import { Phone, PhoneOff } from 'lucide-react';

interface CallNotificationProps {
  callerName: string;
  callerAvatar?: string;
  callType: 'voice' | 'video';
  isVisible: boolean;
  onAccept: () => void;
  onReject: () => void;
}

const CallNotification: React.FC<CallNotificationProps> = ({
  callerName,
  callerAvatar,
  callType,
  isVisible,
  onAccept,
  onReject,
}) => {
  const [ringCount, setRingCount] = useState(0);

  // Ring animation effect
  useEffect(() => {
    if (!isVisible) return;
    const interval = setInterval(() => {
      setRingCount((prev) => (prev + 1) % 4);
    }, 500);
    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  const callTypeLabel = callType === 'video' ? 'Video Call' : 'Voice Call';
  const dots = '.'.repeat(ringCount);

  return (
    <div className="fixed inset-0 bg-graphite-950/40 backdrop-blur-[3px] animate-fade-in-soft flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border shadow-pop rounded-2xl max-w-sm w-full overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="bg-primary px-6 py-8 text-center">
          {/* Avatar */}
          <div className="mb-4 flex justify-center">
            {callerAvatar ? (
              <img
                src={callerAvatar}
                alt={callerName}
                className="w-20 h-20 rounded-full border-4 border-white/70 shadow-lg-brand object-cover animate-pulse"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center text-3xl font-bold text-primary shadow-lg-brand animate-pulse">
                {callerName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Caller Info */}
          <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">{callerName}</h2>
          <p className="text-white/90 font-semibold">{callTypeLabel}</p>
          <p className="text-white/70 text-sm mt-2">
            Calling{dots}
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 py-8 flex gap-4">
          {/* Reject Button */}
          <button
            onClick={onReject}
            className="flex-1 bg-destructive hover:bg-[hsl(0_72%_38%)] text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-105 shadow-soft"
          >
            <PhoneOff size={20} />
            Decline
          </button>

          {/* Accept Button */}
          <button
            onClick={onAccept}
            className="flex-1 bg-primary hover:bg-emerald-800 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-105 shadow-lg-brand"
          >
            <Phone size={20} />
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallNotification;
