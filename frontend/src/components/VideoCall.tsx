'use client';

import React, { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Maximize2 } from 'lucide-react';
import useVoiceVideoCall from './useVoiceVideoCall';

interface VideoCallProps {
  localParticipantName: string;
  remoteParticipantName: string;
  remoteParticipantAvatar?: string;
  onEndCall?: () => void;
  onToggleAudio?: () => void;
  onToggleVideo?: () => void;
}

const VideoCall: React.FC<VideoCallProps> = ({
  localParticipantName,
  remoteParticipantName,
  remoteParticipantAvatar,
  onEndCall,
  onToggleAudio,
  onToggleVideo,
}) => {
  const callHook = useVoiceVideoCall();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [isMinimized, setIsMinimized] = React.useState(false);

  // Set up local video stream
  useEffect(() => {
    const localStream = callHook.getLocalStream();
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [callHook]);

  // Set up remote video stream
  useEffect(() => {
    if (callHook.remoteParticipants.length > 0) {
      const firstRemoteParticipant = callHook.remoteParticipants[0];
      const remoteStream = callHook.getRemoteStream(firstRemoteParticipant.id);
      if (remoteVideoRef.current && remoteStream) {
        remoteStream.getAudioTracks().forEach(() => console.log("987"));
        remoteStream.getVideoTracks().forEach(() => console.log("345"));
        
        console.log("Setting remote stream to video element", remoteStream.getAudioTracks().length, "audio tracks found");
        remoteVideoRef.current.srcObject = remoteStream;
        
        // Ensure volume is up and playing
        remoteVideoRef.current.volume = 1.0;
        remoteVideoRef.current.muted = false;
        
        // CRITICAL: Some browsers require a user gesture or specific attributes
        remoteVideoRef.current.setAttribute('playsinline', 'true');
        remoteVideoRef.current.setAttribute('autoplay', 'true');
        
        const playPromise = remoteVideoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            console.error("Error playing remote video:", e);
            // Attempt to play on any click if auto-play fails
            const playOnGesture = () => {
              if (remoteVideoRef.current) {
                remoteVideoRef.current.play().catch(err => console.error("Play on gesture failed:", err));
              }
              document.removeEventListener('click', playOnGesture);
              document.removeEventListener('touchstart', playOnGesture);
            };
            document.addEventListener('click', playOnGesture);
            document.addEventListener('touchstart', playOnGesture);
          });
        }
      }
    }
  }, [callHook.remoteParticipants, callHook]);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  const handleEndCall = () => {
    // If we have a remote participant, send the end-call signal to them
    const targetUserId = callHook.remoteParticipants.length > 0 
      ? callHook.remoteParticipants[0].id 
      : undefined;
    
    callHook.endCall(targetUserId);
    onEndCall?.();
  };

  const handleToggleAudio = async () => {
    await callHook.toggleAudio();
    onToggleAudio?.();
  };

  const handleToggleVideo = async () => {
    await callHook.toggleVideo();
    onToggleVideo?.();
  };

  if (isMinimized) {
    return (
      <div
        className="fixed bottom-20 lg:bottom-4 right-4 z-50 w-24 h-24 bg-background rounded-xl border-2 border-primary shadow-glow cursor-pointer hover:scale-105 transition-all"
        onClick={() => setIsMinimized(false)}
      >
        <video
          ref={localVideoRef}
          autoPlay
          muted
          className="w-full h-full rounded-lg object-cover"
        />
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-black rounded-2xl overflow-hidden flex flex-col relative shadow-lg-brand">
      {/* Remote Video (Main) */}
      <div className="flex-1 relative bg-background">
        {callHook.isVideoEnabled && callHook.remoteParticipants.length > 0 ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center flex-col">
            {remoteParticipantAvatar ? (
              <img
                src={remoteParticipantAvatar}
                alt={remoteParticipantName}
                className="w-24 h-24 rounded-full mb-4"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-brand glow flex items-center justify-center mb-4">
                <span className="text-2xl text-white font-bold">
                  {remoteParticipantName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <p className="text-white text-lg font-semibold">{remoteParticipantName}</p>
            {callHook.isCallActive && (
              <p className="text-muted-foreground text-sm mt-2">{formatDuration(callHook.duration)}</p>
            )}
          </div>
        )}

        {/* Duration Badge */}
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md border border-white/10 text-white px-4 py-2 rounded-xl font-mono text-sm shadow-lg-brand">
          {formatDuration(callHook.duration)}
        </div>

        {/* Local Video (Picture-in-Picture) */}
        {callHook.isVideoEnabled && (
          <div className="absolute bottom-4 right-4 w-32 h-32 bg-background rounded-xl border-2 border-primary/60 shadow-lg-brand overflow-hidden">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="glass-strong px-6 py-4 flex items-center justify-between">
        <div className="text-left">
          <p className="font-semibold tracking-tight">{remoteParticipantName}</p>
          <p className="text-sm text-muted-foreground">Video Call</p>
        </div>

        <div className="flex gap-4 items-center">
          {/* Audio Toggle */}
          <button
            onClick={handleToggleAudio}
            className={`p-3 rounded-full transition-all hover:scale-105 ${
              callHook.isAudioEnabled
                ? 'bg-secondary/80 hover:bg-secondary text-foreground hover:shadow-glow'
                : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/40'
            }`}
            title={callHook.isAudioEnabled ? 'Mute' : 'Unmute'}
          >
            {callHook.isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
          </button>

          {/* Video Toggle */}
          <button
            onClick={handleToggleVideo}
            className={`p-3 rounded-full transition-all hover:scale-105 ${
              callHook.isVideoEnabled
                ? 'bg-gradient-brand text-white shadow-glow'
                : 'bg-secondary/80 hover:bg-secondary text-foreground hover:shadow-glow'
            }`}
            title={callHook.isVideoEnabled ? 'Stop Video' : 'Start Video'}
          >
            {callHook.isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
          </button>

          {/* Minimize */}
          <button
            onClick={() => setIsMinimized(true)}
            className="p-3 rounded-full bg-secondary/80 hover:bg-secondary text-foreground transition-all hover:scale-105 hover:shadow-glow"
            title="Minimize"
          >
            <Maximize2 size={20} />
          </button>

          {/* End Call */}
          <button
            onClick={handleEndCall}
            className="p-3 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all hover:scale-110 shadow-lg shadow-red-500/40 ml-4"
            title="End Call"
          >
            <PhoneOff size={20} />
          </button>
        </div>
      </div>

      {/* Error Message */}
      {callHook.error && (
        <div className="bg-red-500/90 backdrop-blur-sm text-white px-6 py-3 text-sm">
          {callHook.error}
        </div>
      )}
    </div>
  );
};

export default VideoCall;
