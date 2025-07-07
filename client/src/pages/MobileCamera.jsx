import React, { useRef, useEffect, useState, useCallback } from 'react';
import io from 'socket.io-client';
import Peer from 'simple-peer';

const SIGNALING_SERVER_URL = 'http://192.168.0.112:3001'; // Use your actual LAN IP

const MobileCamera = () => {
  const videoRef = useRef(null);
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);
  
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Initializing...');
  const [error, setError] = useState(null);

  // Initialize camera and WebRTC connection
  const initializeCamera = useCallback(async () => {
    try {
      setConnectionStatus('Accessing camera...');
      let stream = null;
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        // Get camera stream
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
          },
          audio: false,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } else {
        setError('Camera API not supported in this browser.');
        setConnectionStatus('Camera access failed');
        return;
      }

      setConnectionStatus('Camera ready, connecting to desktop...');

      // Connect to signaling server
      const socket = io(SIGNALING_SERVER_URL, { withCredentials: true });
      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('Connected to signaling server');
        setIsConnected(true);
        setConnectionStatus('Connected to desktop app');
      });

      socket.on('disconnect', () => {
        console.log('Disconnected from signaling server');
        setIsConnected(false);
        setConnectionStatus('Disconnected from desktop app');
      });

      socket.on('signal', (data) => {
        if (peerRef.current && !peerRef.current.destroyed) {
          try {
            peerRef.current.signal(data);
          } catch (err) {
            console.warn('Signal error:', err);
          }
        }
      });

      // Create WebRTC peer connection
      const peer = new Peer({
        initiator: true,
        trickle: false,
        stream: stream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      peerRef.current = peer;

      peer.on('signal', (data) => {
        socket.emit('signal', data);
      });

      peer.on('connect', () => {
        console.log('WebRTC connection established');
        setIsStreaming(true);
        setConnectionStatus('Streaming to desktop app');
      });

      peer.on('close', () => {
        console.log('WebRTC connection closed');
        setIsStreaming(false);
        setConnectionStatus('Connection closed');
        peerRef.current = null;
      });

      peer.on('error', (err) => {
        console.error('WebRTC error:', err);
        setError(`WebRTC Error: ${err.message}`);
        setConnectionStatus('Connection error');
        peer.destroy();
      });

    } catch (err) {
      console.error('Camera initialization error:', err);
      setError(`Camera Error: ${err.message}`);
      setConnectionStatus('Camera access failed');
    }
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    setIsConnected(false);
    setIsStreaming(false);
  }, []);

  useEffect(() => {
    initializeCamera();
    
    return () => {
      cleanup();
    };
  }, [initializeCamera, cleanup]);

  const handleRetry = () => {
    setError(null);
    cleanup();
    setTimeout(initializeCamera, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-sm border-b border-purple-500/20 p-4">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Mobile Camera</h1>
          <p className="text-slate-400 text-sm">
            Camera feed for robot control
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          {/* Video Container */}
          <div className="relative bg-black rounded-lg overflow-hidden shadow-2xl border-2 border-purple-500/20">
            <video
              ref={videoRef}
              className="w-full h-64 object-cover"
              autoPlay
              playsInline
              muted
            />
            
            {/* Status Overlay */}
            <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
              {connectionStatus}
            </div>
            
            {/* Connection Status Indicator */}
            <div className="absolute top-2 right-2">
              <div className={`w-3 h-3 rounded-full ${
                isStreaming ? 'bg-green-500' : 
                isConnected ? 'bg-yellow-500' : 'bg-red-500'
              } shadow-lg`}></div>
            </div>
          </div>

          {/* Status Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Camera</span>
                <div className={`w-2 h-2 rounded-full ${
                  streamRef.current ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {streamRef.current ? 'Active' : 'Inactive'}
              </p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Streaming</span>
                <div className={`w-2 h-2 rounded-full ${
                  isStreaming ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {isStreaming ? 'Active' : 'Inactive'}
              </p>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-900/20 backdrop-blur-sm rounded-lg p-4 border border-blue-500/20">
            <h3 className="text-sm font-semibold text-blue-300 mb-2">Instructions</h3>
            <ul className="text-xs text-blue-200 space-y-1">
              <li>• Keep this page open on your mobile device</li>
              <li>• Position yourself in front of the camera</li>
              <li>• Your movements will control the robot</li>
              <li>• Ensure good lighting for better tracking</li>
            </ul>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-900/20 backdrop-blur-sm rounded-lg p-4 border border-red-500/20">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-300 mb-1">Error</h3>
                  <p className="text-xs text-red-200 mb-3">{error}</p>
                  <button
                    onClick={handleRetry}
                    className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-xs font-medium transition-colors"
                  >
                    Retry Connection
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Connection Info */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Connection Info</h3>
            <div className="text-xs text-slate-400 space-y-1">
              <p>Desktop URL: <code className="bg-slate-700 px-1 rounded">{window.location.origin}</code></p>
              <p>Status: <span className={isStreaming ? 'text-green-400' : 'text-red-400'}>{connectionStatus}</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MobileCamera
