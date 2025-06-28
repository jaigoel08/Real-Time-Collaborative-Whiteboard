import React, { useState, useEffect, useRef } from "react";
import RoomEntry from "./components/RoomEntry";
import Whiteboard from "./components/Whiteboard";
import ErrorBoundary from "./components/ErrorBoundary";

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

const GOOGLE_AUTH_URL = "https://coflow-backend.onrender.com/auth/google";
const LOGOUT_URL = "https://coflow-backend.onrender.com/auth/logout";

function App() {
  const [session, setSession] = useState(null); // { name, roomId, isCreator }
  const [ended, setEnded] = useState(false);
  const [jwt, setJwt] = useState(() => localStorage.getItem('jwt') || null);
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('jwt');
    return token ? parseJwt(token) : null;
  });
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setJwt(token);
      localStorage.setItem('jwt', token);
      setUser(parseJwt(token));
      setShowWhiteboard(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    import('socket.io-client').then(({ default: io }) => {
      socketRef.current = io('https://coflow-backend.onrender.com');
      socketRef.current.emit('join-board', session.roomId);
      socketRef.current.on('room-ended', () => {
        setEnded(true);
        setSession(null);
      });
    });
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [session]);

  const handleLogin = () => {
    window.location.href = GOOGLE_AUTH_URL;
  };

  const handleLogout = () => {
    setJwt(null);
    setUser(null);
    setShowWhiteboard(false);
    setSession(null);
    localStorage.removeItem('jwt');
    window.location.href = LOGOUT_URL;
  };

  const handleJoinRoom = (roomData) => {
    setSession({ ...roomData, isCreator: !roomData.roomId });
    setShowWhiteboard(true);
  };

  const handleBackToHome = () => {
    setShowWhiteboard(false);
    setSession(null);
  };

  if (user && showWhiteboard) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
      }}>
        {/* Header with user info and navigation */}
        <div style={{
          backgroundColor: 'white',
          borderBottom: '1px solid #e2e8f0',
          padding: 'clamp(8px, 2vw, 12px) clamp(12px, 3vw, 20px)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          flexWrap: 'wrap',
          gap: 'clamp(8px, 2vw, 12px)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'clamp(8px, 2vw, 20px)',
            flex: '1',
            minWidth: '0',
            flexWrap: 'wrap'
          }}>
            {/* CoFlow Logo */}
            <div style={{
              fontSize: 'clamp(18px, 4vw, 24px)',
              fontWeight: '800',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              gap: 'clamp(4px, 1vw, 8px)',
              flexShrink: '0'
            }}>
              <span style={{ fontSize: 'clamp(20px, 5vw, 28px)' }}>🎨</span>
              <span style={{ display: window.innerWidth < 480 ? 'none' : 'inline' }}>CoFlow</span>
            </div>
            
            <button
              onClick={handleBackToHome}
              style={{
                padding: 'clamp(6px, 1.5vw, 8px) clamp(10px, 2.5vw, 16px)',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: 'clamp(11px, 2.5vw, 14px)',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: 'clamp(4px, 1vw, 6px)',
                transition: 'background-color 0.2s',
                minHeight: 'clamp(32px, 8vw, 40px)',
                whiteSpace: 'nowrap'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#4b5563'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#6b7280'}
            >
              <span>←</span>
              <span style={{ display: window.innerWidth < 480 ? 'none' : 'inline' }}>Back to Home</span>
            </button>
            {session && (
              <div style={{
                fontSize: 'clamp(11px, 2.5vw, 14px)',
                color: '#6b7280',
                display: 'flex',
                alignItems: 'center',
                gap: 'clamp(4px, 1vw, 8px)',
                flexWrap: 'wrap'
              }}>
                <span style={{ display: window.innerWidth < 480 ? 'none' : 'inline' }}>Room:</span>
                <span style={{
                  fontFamily: 'monospace',
                  backgroundColor: '#f3f4f6',
                  padding: 'clamp(2px, 1vw, 4px) clamp(4px, 1.5vw, 8px)',
                  borderRadius: '4px',
                  color: '#374151',
                  fontWeight: '500',
                  fontSize: 'clamp(10px, 2.5vw, 12px)',
                  wordBreak: 'break-all'
                }}>
                  {session.roomId}
                </span>
              </div>
            )}
          </div>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'clamp(6px, 1.5vw, 12px)',
            flexShrink: '0'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'clamp(4px, 1vw, 8px)',
              fontSize: 'clamp(11px, 2.5vw, 14px)',
              color: '#374151'
            }}>
              <img 
                src={user.avatar} 
                alt="avatar" 
                style={{
                  width: 'clamp(28px, 6vw, 32px)',
                  height: 'clamp(28px, 6vw, 32px)',
                  borderRadius: '50%',
                  border: '2px solid #e2e8f0',
                  flexShrink: '0'
                }}
              />
              <span style={{ 
                fontWeight: '500',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 'clamp(80px, 20vw, 150px)',
                display: window.innerWidth < 480 ? 'none' : 'inline'
              }}>
                {user.name}
              </span>
            </div>
            <button
              onClick={handleLogout}
              style={{
                padding: 'clamp(4px, 1.5vw, 6px) clamp(8px, 2vw, 12px)',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: 'clamp(10px, 2.5vw, 12px)',
                fontWeight: '500',
                transition: 'background-color 0.2s',
                minHeight: 'clamp(28px, 6vw, 32px)',
                whiteSpace: 'nowrap'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#dc2626'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#ef4444'}
            >
              <span style={{ display: window.innerWidth < 480 ? 'none' : 'inline' }}>Logout</span>
              <span style={{ display: window.innerWidth < 480 ? 'inline' : 'none' }}>🚪</span>
            </button>
          </div>
        </div>

        {/* Whiteboard Component */}
        <ErrorBoundary>
          <Whiteboard 
            boardId={session?.roomId || "default"} 
            jwt={jwt} 
          />
        </ErrorBoundary>
      </div>
    );
  }

  // Show RoomEntry as home page (whether authenticated or not)
  return (
    <RoomEntry 
      onJoin={handleJoinRoom} 
      jwt={jwt} 
      user={user}
      handleLogin={handleLogin}
      handleLogout={handleLogout}
    />
  );
}

export default App;
