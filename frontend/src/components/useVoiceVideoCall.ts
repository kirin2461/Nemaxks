'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export interface CallParticipant {
  id: string;
  name: string;
  avatar?: string;
  streamId?: string;
}

export interface CallState {
  isCallActive: boolean;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  callType: 'voice' | 'video';
  callStartTime?: number;
  duration: number;
  remoteParticipants: CallParticipant[];
  localStream?: MediaStream;
  remoteStreams: Map<string, MediaStream>;
  error?: string;
}

export interface UseVoiceVideoCallReturn extends CallState {
  initCall: (type: 'voice' | 'video', targetUserId: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleAudio: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  addRemoteParticipant: (participant: CallParticipant, stream: MediaStream) => void;
  removeRemoteParticipant: (participantId: string) => void;
  getLocalStream: () => MediaStream | undefined;
  getRemoteStream: (participantId: string) => MediaStream | undefined;
}

const useVoiceVideoCall = (): UseVoiceVideoCallReturn => {
  const [callState, setCallState] = useState<CallState>({
    isCallActive: false,
    isAudioEnabled: true,
    isVideoEnabled: false,
    callType: 'voice',
    duration: 0,
    remoteParticipants: [],
    remoteStreams: new Map(),
  });

  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  // Initialize call with peer
  const initCall = useCallback(
    async (type: 'voice' | 'video', targetUserId: string) => {
      try {
        const constraints = {
          audio: true,
          video: type === 'video' ? { width: 640, height: 480 } : false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        setCallState((prev) => ({
          ...prev,
          isCallActive: true,
          callType: type,
          localStream: stream,
          isVideoEnabled: type === 'video',
          callStartTime: Date.now(),
        }));

        // Start duration counter
        if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = setInterval(() => {
          setCallState((prev) => ({
            ...prev,
            duration: prev.callStartTime ? Math.floor((Date.now() - prev.callStartTime) / 1000) : 0,
          }));
        }, 1000);
      } catch (error) {
        setCallState((prev) => ({
          ...prev,
          error: `Failed to start ${type} call: ${error}`,
        }));
      }
    },
    []
  );

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    try {
      const constraints = {
        audio: true,
        video: callState.callType === 'video' ? { width: 640, height: 480 } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCallState((prev) => ({
        ...prev,
        localStream: stream,
        callStartTime: Date.now(),
      }));

      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = setInterval(() => {
        setCallState((prev) => ({
          ...prev,
          duration: prev.callStartTime ? Math.floor((Date.now() - prev.callStartTime) / 1000) : 0,
        }));
      }, 1000);
    } catch (error) {
      setCallState((prev) => ({
        ...prev,
        error: `Failed to accept call: ${error}`,
      }));
    }
  }, [callState.callType]);

  // Reject incoming call
  const rejectCall = useCallback(() => {
    setCallState((prev) => ({
      ...prev,
      isCallActive: false,
    }));
  }, []);

  // End active call
  const endCall = useCallback(() => {
    if (callState.localStream) {
      callState.localStream.getTracks().forEach((track) => track.stop());
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }

    setCallState((prev) => ({
      ...prev,
      isCallActive: false,
      localStream: undefined,
      remoteParticipants: [],
      remoteStreams: new Map(),
      duration: 0,
      callStartTime: undefined,
    }));
  }, [callState.localStream]);

  // Toggle audio
  const toggleAudio = useCallback(async () => {
    if (!callState.localStream) return;

    callState.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });

    setCallState((prev) => ({
      ...prev,
      isAudioEnabled: !prev.isAudioEnabled,
    }));
  }, [callState.localStream]);

  // Toggle video
  const toggleVideo = useCallback(async () => {
    if (!callState.localStream) return;

    if (!callState.isVideoEnabled) {
      // Enable video
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        const videoTrack = stream.getVideoTracks()[0];
        callState.localStream.addTrack(videoTrack);
        setCallState((prev) => ({
          ...prev,
          isVideoEnabled: true,
        }));
      } catch (error) {
        console.error('Failed to enable video:', error);
      }
    } else {
      // Disable video
      callState.localStream.getVideoTracks().forEach((track) => {
        track.stop();
        callState.localStream?.removeTrack(track);
      });
      setCallState((prev) => ({
        ...prev,
        isVideoEnabled: false,
      }));
    }
  }, [callState.localStream, callState.isVideoEnabled]);

  // Add remote participant
  const addRemoteParticipant = useCallback(
    (participant: CallParticipant, stream: MediaStream) => {
      setCallState((prev) => {
        const newStreams = new Map(prev.remoteStreams);
        newStreams.set(participant.id, stream);
        return {
          ...prev,
          remoteParticipants: [
            ...prev.remoteParticipants.filter((p) => p.id !== participant.id),
            participant,
          ],
          remoteStreams: newStreams,
        };
      });
    },
    []
  );

  // Remove remote participant
  const removeRemoteParticipant = useCallback((participantId: string) => {
    setCallState((prev) => {
      const newStreams = new Map(prev.remoteStreams);
      const stream = newStreams.get(participantId);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        newStreams.delete(participantId);
      }
      return {
        ...prev,
        remoteParticipants: prev.remoteParticipants.filter((p) => p.id !== participantId),
        remoteStreams: newStreams,
      };
    });
  }, []);

  // Get local stream
  const getLocalStream = useCallback(() => {
    return callState.localStream;
  }, [callState.localStream]);

  // Get remote stream
  const getRemoteStream = useCallback(
    (participantId: string) => {
      return callState.remoteStreams.get(participantId);
    },
    [callState.remoteStreams]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callState.localStream) {
        callState.localStream.getTracks().forEach((track) => track.stop());
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [callState.localStream]);

  return {
    ...callState,
    initCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleAudio,
    toggleVideo,
    addRemoteParticipant,
    removeRemoteParticipant,
    getLocalStream,
    getRemoteStream,
  };
};

export default useVoiceVideoCall;
