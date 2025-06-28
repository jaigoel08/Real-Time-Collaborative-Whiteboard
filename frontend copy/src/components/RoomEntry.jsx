import React, { useState } from 'react';

const API_URL = 'http://localhost:3000/api/boards';
const GOOGLE_AUTH_URL = "http://localhost:3000/auth/google";

const RoomEntry = ({ onJoin, jwt, user, handleLogin, handleLogout }) => {
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!jwt) return setError('You must be logged in to create a room.');
    const userName = user ? user.name : name;
    if (!userName) return setError('Please enter your name.');
    setLoading(true);
    setError('');
    setCopied(false);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`
        },
        body: JSON.stringify({ name: userName, data: {} })
      });
      const board = await res.json();
      if (board._id) {
        try {
          await navigator.clipboard.writeText(board._id);
          setCopied(true);
        } catch (e) {
          setCopied(false);
        }
        onJoin({ name: userName, roomId: board._id });
      } else {
        setError(board.error || 'Failed to create room.');
      }
    } catch (e) {
      setError(e.message || 'Failed to create room.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!jwt) return setError('You must be logged in to join a room.');
    if (!roomId) return setError('Enter the room ID.');
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/${roomId}`);
      if (res.ok) {
        onJoin({ name: '', roomId });
      } else {
        const data = await res.json();
        setError(data.message || 'Room not found.');
      }
    } catch (e) {
      setError(e.message || 'Failed to join room.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header with user info and logout button */}
      {user && (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: 'white',
            flex: '1',
            minWidth: '0'
          }}>
            <img 
              src={user.avatar} 
              alt="avatar" 
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                flexShrink: '0'
              }}
            />
            <div style={{ minWidth: '0' }}>
              <div style={{
                fontSize: 'clamp(14px, 3vw, 16px)',
                fontWeight: '600',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                Welcome back, {user.name}!
              </div>
              <div style={{
                fontSize: 'clamp(12px, 2.5vw, 14px)',
                opacity: '0.8',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                Ready to create or join a room?
              </div>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 16px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: 'clamp(12px, 2.5vw, 14px)',
              fontWeight: '500',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: '0',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.5)';
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            }}
          >
            <span>🚪</span>
            <span style={{ display: window.innerWidth < 480 ? 'none' : 'inline' }}>Logout</span>
          </button>
        </div>
      )}

      {/* Main Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(10px, 3vw, 20px)'
      }}>
        <div style={{
          maxWidth: '1200px',
          width: '100%',
          display: 'grid',
          gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1fr',
          gap: 'clamp(30px, 5vw, 60px)',
          alignItems: 'center'
        }}>
          {/* Left Side - Hero Content */}
          <div style={{
            color: 'white',
            textAlign: window.innerWidth < 768 ? 'center' : 'left',
            order: window.innerWidth < 768 ? 2 : 1
          }}>
            <div style={{
              fontSize: 'clamp(32px, 8vw, 48px)',
              fontWeight: '800',
              lineHeight: '1.1',
              marginBottom: 'clamp(15px, 3vw, 20px)',
              background: 'linear-gradient(45deg, #fff, #f0f0f0)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              CoFlow
            </div>
            
            <div style={{
              fontSize: 'clamp(16px, 4vw, 20px)',
              fontWeight: '400',
              marginBottom: 'clamp(20px, 4vw, 30px)',
              opacity: '0.9',
              lineHeight: '1.6'
            }}>
              Unleash your creativity in a collaborative environment. 
              Draw, design, and brainstorm together in real-time with 
              your team, students, or friends from anywhere in the world.
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'clamp(12px, 2.5vw, 16px)',
              marginBottom: 'clamp(25px, 5vw, 40px)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: 'clamp(14px, 3vw, 16px)',
                justifyContent: window.innerWidth < 768 ? 'center' : 'flex-start'
              }}>
                <span style={{ fontSize: 'clamp(16px, 4vw, 20px)' }}>🎨</span>
                <span>Rich drawing tools and shapes</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: 'clamp(14px, 3vw, 16px)',
                justifyContent: window.innerWidth < 768 ? 'center' : 'flex-start'
              }}>
                <span style={{ fontSize: 'clamp(16px, 4vw, 20px)' }}>👥</span>
                <span>Real-time collaboration</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: 'clamp(14px, 3vw, 16px)',
                justifyContent: window.innerWidth < 768 ? 'center' : 'flex-start'
              }}>
                <span style={{ fontSize: 'clamp(16px, 4vw, 20px)' }}>💾</span>
                <span>Save and share your work</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: 'clamp(14px, 3vw, 16px)',
                justifyContent: window.innerWidth < 768 ? 'center' : 'flex-start'
              }}>
                <span style={{ fontSize: 'clamp(16px, 4vw, 20px)' }}>📱</span>
                <span>Works on all devices</span>
              </div>
            </div>

            {/* Google Sign In Button */}
            {!user && (
              <button
                onClick={handleLogin}
                style={{
                  backgroundColor: 'white',
                  color: '#333',
                  border: 'none',
                  borderRadius: '12px',
                  padding: 'clamp(12px, 3vw, 16px) clamp(20px, 5vw, 32px)',
                  fontSize: 'clamp(14px, 3vw, 16px)',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
                  transition: 'all 0.3s ease',
                  marginBottom: '20px',
                  margin: window.innerWidth < 768 ? '0 auto 20px' : '0 0 20px 0'
                }}
                onMouseOver={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 12px 35px rgba(0,0,0,0.2)';
                }}
                onMouseOut={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </button>
            )}
          </div>

          {/* Right Side - Room Actions */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '20px',
            padding: 'clamp(20px, 5vw, 40px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
            maxWidth: '500px',
            width: '100%',
            order: window.innerWidth < 768 ? 1 : 2,
            margin: window.innerWidth < 768 ? '0 auto' : '0'
          }}>
            {user ? (
              <>
                {/* Create Room Section */}
                <div style={{ marginBottom: 'clamp(20px, 4vw, 30px)' }}>
                  <h3 style={{
                    fontSize: 'clamp(16px, 3.5vw, 18px)',
                    fontWeight: '600',
                    color: '#1f2937',
                    marginBottom: 'clamp(12px, 2.5vw, 16px)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    🚀 Create New Room
                  </h3>
                  {/* Only show name input if user is not authenticated */}
                  {!user && (
                    <div style={{ marginBottom: 'clamp(12px, 2.5vw, 16px)' }}>
                      <input
                        style={{
                          width: '100%',
                          padding: 'clamp(10px, 2.5vw, 12px) clamp(12px, 3vw, 16px)',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: 'clamp(13px, 2.5vw, 14px)',
                          outline: 'none',
                          transition: 'border-color 0.2s'
                        }}
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Enter your name"
                      />
                    </div>
                  )}
                  {/* Show user info if authenticated */}
                  {user && (
                    <div style={{
                      marginBottom: 'clamp(12px, 2.5vw, 16px)',
                      padding: 'clamp(10px, 2.5vw, 12px) clamp(12px, 3vw, 16px)',
                      backgroundColor: '#f0f9ff',
                      border: '1px solid #bae6fd',
                      borderRadius: '8px',
                      fontSize: 'clamp(13px, 2.5vw, 14px)',
                      color: '#0369a1'
                    }}>
                      <strong>Creating room as:</strong> {user.name}
                    </div>
                  )}
                  <button
                    style={{
                      width: '100%',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: 'clamp(10px, 2.5vw, 12px) clamp(12px, 3vw, 16px)',
                      fontSize: 'clamp(13px, 2.5vw, 14px)',
                      fontWeight: '600',
                      cursor: loading || (!user && !name) ? 'not-allowed' : 'pointer',
                      opacity: loading || (!user && !name) ? 0.6 : 1,
                      transition: 'background-color 0.2s'
                    }}
                    onClick={handleCreate}
                    disabled={loading || (!user && !name)}
                    onMouseOver={(e) => {
                      if (!loading && (user || name)) e.target.style.backgroundColor = '#2563eb';
                    }}
                    onMouseOut={(e) => {
                      if (!loading && (user || name)) e.target.style.backgroundColor = '#3b82f6';
                    }}
                  >
                    {loading ? 'Creating...' : 'Create New Room'}
                  </button>
                  {copied && (
                    <div style={{
                      marginTop: 'clamp(8px, 2vw, 12px)',
                      padding: 'clamp(6px, 1.5vw, 8px) clamp(8px, 2vw, 12px)',
                      backgroundColor: '#dcfce7',
                      color: '#166534',
                      borderRadius: '6px',
                      fontSize: 'clamp(11px, 2vw, 12px)',
                      textAlign: 'center'
                    }}>
                      ✅ Room ID copied to clipboard!
                    </div>
                  )}
                </div>

                {/* Join Room Section */}
                <div>
                  <h3 style={{
                    fontSize: 'clamp(16px, 3.5vw, 18px)',
                    fontWeight: '600',
                    color: '#1f2937',
                    marginBottom: 'clamp(12px, 2.5vw, 16px)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    🔗 Join Existing Room
                  </h3>
                  <div style={{ marginBottom: 'clamp(12px, 2.5vw, 16px)' }}>
                    <input
                      style={{
                        width: '100%',
                        padding: 'clamp(10px, 2.5vw, 12px) clamp(12px, 3vw, 16px)',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: 'clamp(13px, 2.5vw, 14px)',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                      value={roomId}
                      onChange={e => setRoomId(e.target.value)}
                      placeholder="Enter room ID to join"
                    />
                  </div>
                  <button
                    style={{
                      width: '100%',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: 'clamp(10px, 2.5vw, 12px) clamp(12px, 3vw, 16px)',
                      fontSize: 'clamp(13px, 2.5vw, 14px)',
                      fontWeight: '600',
                      cursor: loading || !roomId ? 'not-allowed' : 'pointer',
                      opacity: loading || !roomId ? 0.6 : 1,
                      transition: 'background-color 0.2s'
                    }}
                    onClick={handleJoin}
                    disabled={loading || !roomId}
                    onMouseOver={(e) => {
                      if (!loading && roomId) e.target.style.backgroundColor = '#059669';
                    }}
                    onMouseOut={(e) => {
                      if (!loading && roomId) e.target.style.backgroundColor = '#10b981';
                    }}
                  >
                    {loading ? 'Joining...' : 'Join Room'}
                  </button>
                </div>
              </>
            ) : (
              /* Not Signed In State */
              <div style={{
                textAlign: 'center',
                padding: '40px 20px'
              }}>
                <div style={{
                  fontSize: '24px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '16px'
                }}>
                  Get Started
                </div>
                <div style={{
                  fontSize: '16px',
                  color: '#6b7280',
                  marginBottom: '30px',
                  lineHeight: '1.6'
                }}>
                  Sign in with Google to create or join collaborative whiteboard rooms
                </div>
                <button
                  onClick={handleLogin}
                  style={{
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '16px 32px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    margin: '0 auto',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#2563eb'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#3b82f6'}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="white" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="white" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="white" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="white" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Sign in with Google
                </button>
              </div>
            )}

            {error && (
              <div style={{
                marginTop: '20px',
                padding: '12px 16px',
                backgroundColor: '#fef2f2',
                color: '#dc2626',
                borderRadius: '8px',
                fontSize: '14px',
                textAlign: 'center',
                border: '1px solid #fecaca'
              }}>
                {error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Responsive Design for Mobile */}
      <style>{`
        @media (max-width: 768px) {
          .container {
            grid-template-columns: 1fr !important;
            gap: 40px !important;
            text-align: center !important;
          }
          
          .hero-title {
            font-size: 32px !important;
          }
          
          .hero-subtitle {
            font-size: 16px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default RoomEntry; 