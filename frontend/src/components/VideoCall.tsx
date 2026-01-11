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
        console.log("Setting remote stream to video element", remoteStream.getAudioTracks().length, "audio tracks found");
        remoteVideoRef.current.srcObject = remoteStream;
        
        // Ensure volume is up and playing
        remoteVideoRef.current.volume = 1.0;
        remoteVideoRef.current.muted = false; // CRITICAL: Ensure NOT muted
        
        const playPromise = remoteVideoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            console.error("Error playing remote video:", e);
            // Fallback: try to play on user interaction if needed
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
        className="fixed bottom-4 right-4 w-24 h-24 bg-gray-900 rounded-lg border-2 border-blue-500 shadow-lg cursor-pointer hover:border-blue-400 transition"
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
    <div className="w-full h-full bg-black rounded-lg overflow-hidden flex flex-col relative">
      {/* Remote Video (Main) */}
      <div className="flex-1 relative bg-gray-900">
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
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center mb-4">
                <span className="text-2xl text-white font-bold">
                  {remoteParticipantName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <p className="text-white text-lg font-semibold">{remoteParticipantName}</p>
            {callHook.isCallActive && (
              <p className="text-gray-400 text-sm mt-2">{formatDuration(callHook.duration)}</p>
            )}
          </div>
        )}

        {/* Duration Badge */}
        <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg font-mono text-sm">
          {formatDuration(callHook.duration)}
        </div>

        {/* Local Video (Picture-in-Picture) */}
        {callHook.isVideoEnabled && (
          <div className="absolute bottom-4 right-4 w-32 h-32 bg-gray-900 rounded-lg border-2 border-blue-500 overflow-hidden">
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
      <div className="bg-gray-900 bg-opacity-90 px-6 py-4 flex items-center justify-between">
        <div className="text-white text-left">
          <p className="font-semibold">{remoteParticipantName}</p>
          <p className="text-sm text-gray-400">Video Call</p>
        </div>

        <div className="flex gap-4 items-center">
          {/* Audio Toggle */}
          <button
            onClick={handleToggleAudio}
            className={`p-3 rounded-full transition ${
              callHook.isAudioEnabled
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
            title={callHook.isAudioEnabled ? 'Mute' : 'Unmute'}
          >
            {callHook.isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
          </button>

          {/* Video Toggle */}
          <button
            onClick={handleToggleVideo}
            className={`p-3 rounded-full transition ${
              callHook.isVideoEnabled
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
            title={callHook.isVideoEnabled ? 'Stop Video' : 'Start Video'}
          >
            {callHook.isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
          </button>

          {/* Minimize */}
          <button
            onClick={() => setIsMinimized(true)}
            className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition"
            title="Minimize"
          >
            <Maximize2 size={20} />
          </button>

          {/* End Call */}
          <button
            onClick={handleEndCall}
            className="p-3 rounded-full bg-red-500 hover:bg-red-600 text-white transition ml-4"
            title="End Call"
          >
            <PhoneOff size={20} />
          </button>
        </div>
      </div>

      {/* Error Message */}
      {callHook.error && (
        <div className="bg-red-500 bg-opacity-90 text-white px-6 py-3 text-sm">
          {callHook.error}
        </div>
      )}
    </div>
  );
};

export default VideoCall;
