import React, { createContext, useContext, useReducer, useCallback } from 'react';

// Types for the App State
export interface UserStatus {
  userId: string;
  username: string;
  status: 'online' | 'offline' | 'away' | 'dnd';
  lastSeen?: Date;
}

export interface VoiceCallState {
  isActive: boolean;
  channelId?: string;
  userId?: string;
  participants: string[];
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
}

export interface DirectCallState {
  incomingCall?: {
    from: string;
    callId: string;
    timestamp: Date;
  };
  activeCall?: {
    with: string;
    callId: string;
    startTime: Date;
  };
}

export interface AppState {
  currentUser?: UserStatus;
  users: Map<string, UserStatus>;
  voiceCall: VoiceCallState;
  directCall: DirectCallState;
  wsConnected: boolean;
  wsError?: string;
  currentPage: 'dashboard' | 'channels' | 'direct-messages' | 'settings';
  notifications: Array<{ id: string; message: string; type: 'info' | 'error' | 'success' }>;
}

type AppAction = 
  | { type: 'SET_CURRENT_USER'; payload: UserStatus }
  | { type: 'UPDATE_USER'; payload: UserStatus }
  | { type: 'UPDATE_USER_STATUS'; payload: { userId: string; status: UserStatus['status'] } }
  | { type: 'START_VOICE_CALL'; payload: { channelId: string; participants: string[] } }
  | { type: 'END_VOICE_CALL' }
  | { type: 'UPDATE_VOICE_CALL_STATUS'; payload: VoiceCallState['connectionStatus'] }
  | { type: 'SET_INCOMING_CALL'; payload: DirectCallState['incomingCall'] }
  | { type: 'CLEAR_INCOMING_CALL' }
  | { type: 'START_DIRECT_CALL'; payload: DirectCallState['activeCall'] }
  | { type: 'END_DIRECT_CALL' }
  | { type: 'SET_WS_CONNECTED'; payload: boolean }
  | { type: 'SET_WS_ERROR'; payload: string | undefined }
  | { type: 'SET_CURRENT_PAGE'; payload: AppState['currentPage'] }
  | { type: 'ADD_NOTIFICATION'; payload: { message: string; type: 'info' | 'error' | 'success' } }
  | { type: 'REMOVE_NOTIFICATION'; payload: string };

const initialState: AppState = {
  users: new Map(),
  voiceCall: {
    isActive: false,
    participants: [],
    connectionStatus: 'disconnected',
  },
  directCall: {},
  wsConnected: false,
  currentPage: 'dashboard',
  notifications: [],
};

function appStateReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_CURRENT_USER':
      return { ...state, currentUser: action.payload };

    case 'UPDATE_USER':
      return {
        ...state,
        users: new Map(state.users).set(action.payload.userId, action.payload),
      };

    case 'UPDATE_USER_STATUS':
      const user = state.users.get(action.payload.userId);
      if (user) {
        return {
          ...state,
          users: new Map(state.users).set(action.payload.userId, {
            ...user,
            status: action.payload.status,
          }),
        };
      }
      return state;

    case 'START_VOICE_CALL':
      return {
        ...state,
        voiceCall: {
          isActive: true,
          channelId: action.payload.channelId,
          participants: action.payload.participants,
          connectionStatus: 'connecting',
        },
      };

    case 'END_VOICE_CALL':
      return {
        ...state,
        voiceCall: {
          isActive: false,
          participants: [],
          connectionStatus: 'disconnected',
        },
      };

    case 'UPDATE_VOICE_CALL_STATUS':
      return {
        ...state,
        voiceCall: {
          ...state.voiceCall,
          connectionStatus: action.payload,
        },
      };

          case 'SET_INCOMING_CALL':
            return {
              ...state,
              directCall: {
                ...state.directCall,
                incomingCall: action.payload,
              },
            };

          case 'CLEAR_INCOMING_CALL':
            return {
              ...state,
              directCall: {
                ...state.directCall,
                incomingCall: undefined,
              },
            };

          case 'START_DIRECT_CALL':
            return {
              ...state,
              directCall: {
                ...state.directCall,
                activeCall: action.payload,
                incomingCall: undefined,
              },
            };

          case 'END_DIRECT_CALL':
            return {
              ...state,
              directCall: {
                ...state.directCall,
                activeCall: undefined,
              },
            };

          case 'SET_WS_CONNECTED':
            return { ...state, wsConnected: action.payload };

          case 'SET_WS_ERROR':
            return { ...state, wsError: action.payload };

          case 'SET_CURRENT_PAGE':
            return { ...state, currentPage: action.payload };

          case 'ADD_NOTIFICATION':
            return {
              ...state,
              notifications: [
                ...state.notifications,
                { id: Date.now().toString(), ...action.payload },
              ],
            };

          case 'REMOVE_NOTIFICATION':
            return {
              ...state,
              notifications: state.notifications.filter((n) => n.id !== action.payload),
            };

          default:
            return state;
        }
      }

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  updateUserStatus: (userId: string, status: UserStatus['status']) => void;
  startVoiceCall: (channelId: string, participants: string[]) => void;
  endVoiceCall: () => void;
  setIncomingCall: (from: string, callId: string) => void;
  acceptDirectCall: (callId: string) => void;
  rejectDirectCall: () => void;
  endDirectCall: () => void;
  setCurrentPage: (page: AppState['currentPage']) => void;
  addNotification: (message: string, type: 'info' | 'error' | 'success') => void;
}

const AppStateContext = createContext<AppContextType | undefined>(undefined);

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appStateReducer, initialState);

  const updateUserStatus = useCallback(
    (userId: string, status: UserStatus['status']) => {
      dispatch({ type: 'UPDATE_USER_STATUS', payload: { userId, status } });
    },
    []
  );

  const startVoiceCall = useCallback(
    (channelId: string, participants: string[]) => {
      dispatch({
        type: 'START_VOICE_CALL',
        payload: { channelId, participants },
      });
    },
    []
  );

  const endVoiceCall = useCallback(() => {
    dispatch({ type: 'END_VOICE_CALL' });
  }, []);

  const setIncomingCall = useCallback(
    (from: string, callId: string) => {
      dispatch({
        type: 'SET_INCOMING_CALL',
        payload: { from, callId, timestamp: new Date() },
      });
    },
    []
  );

  const acceptDirectCall = useCallback(
    (callId: string) => {
      const incomingCall = state.directCall.incomingCall;
      if (incomingCall) {
        dispatch({
          type: 'START_DIRECT_CALL',
          payload: {
            with: incomingCall.from,
            callId,
            startTime: new Date(),
          },
        });
      }
    },
    [state.directCall.incomingCall]
  );

  const rejectDirectCall = useCallback(() => {
    dispatch({ type: 'CLEAR_INCOMING_CALL' });
  }, []);

  const endDirectCall = useCallback(() => {
    dispatch({ type: 'END_DIRECT_CALL' });
  }, []);

  const setCurrentPage = useCallback(
    (page: AppState['currentPage']) => {
      dispatch({ type: 'SET_CURRENT_PAGE', payload: page });
    },
    []
  );

  const addNotification = useCallback(
    (message: string, type: 'info' | 'error' | 'success' = 'info') => {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message, type } });
    },
    []
  );

    return (
      <AppStateContext.Provider
        value={{
          state,
          dispatch,
          updateUserStatus,
          startVoiceCall,
          endVoiceCall,
          setIncomingCall,
          acceptDirectCall,
          rejectDirectCall,
          endDirectCall,
          setCurrentPage,
          addNotification,
        }}
      >
        {children}
      </AppStateContext.Provider>
    );
  };

  export const useAppState = () => {
    const context = useContext(AppStateContext);
    if (context === undefined) {
      throw new Error('useAppState must be used within AppStateProvider');
    }
    return context;
  };