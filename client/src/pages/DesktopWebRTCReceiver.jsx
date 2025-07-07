import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import Peer from "simple-peer";

const DesktopWebRTCReceiver = ({ onRemoteStream, hideVideo = false }) => {
  const videoRef = useRef(null);
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const [status, setStatus] = useState("Waiting for mobile connection...");
  const [error, setError] = useState(null);

  useEffect(() => {
    // Connect to signaling server
    const SIGNALING_SERVER_URL = "http://192.168.0.112:3001"; // Use your actual LAN IP
    const socket = io(SIGNALING_SERVER_URL, {
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => setStatus("Connected to signaling server"));
    socket.on("disconnect", () =>
      setStatus("Disconnected from signaling server"),
    );

    // Create WebRTC peer (not initiator)
    const peer = new Peer({
      initiator: false,
      trickle: false,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      },
    });
    peerRef.current = peer;

    // Signal exchange
    peer.on("signal", (data) => socket.emit("signal", data));
    socket.on("signal", (data) => {
      if (peerRef.current && !peerRef.current.destroyed) {
        try {
          peerRef.current.signal(data);
        } catch (err) {
          console.warn("Signal error:", err);
        }
      }
    });

    // When stream is received
    peer.on("stream", (stream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      if (onRemoteStream) onRemoteStream(stream);
      setStatus("Receiving video stream from mobile");
    });

    peer.on("error", (err) => {
      setError(err.message);
      setStatus("WebRTC error");
      peer.destroy();
    });

    peer.on("close", () => {
      setStatus("WebRTC connection closed");
      peerRef.current = null;
    });

    return () => {
      peer.destroy();
      socket.disconnect();
    };
  }, [onRemoteStream]);

  return (
    <div className="bg-black rounded-lg p-4 border border-purple-500/20">
      <video
        ref={videoRef}
        style={{ display: hideVideo ? "none" : "block" }}
        className={hideVideo ? "" : "w-full h-64 object-cover"}
        autoPlay
        playsInline
        muted
      />
      <div className="mt-2 text-xs text-white">Status: {status}</div>
      {error && <div className="text-red-400">Error: {error}</div>}
      <div className="mt-1 text-xs text-slate-400">
        {hideVideo ? "Stream active (displayed in camera feed)" : "Preview"}
      </div>
    </div>
  );
};

export default DesktopWebRTCReceiver;
