// src/pages/MediaPipeTracker.jsx
import React from "react";
import { useRef, useEffect, useCallback, useState } from "react";
import { Holistic } from "@mediapipe/holistic";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import {
  POSE_CONNECTIONS,
  HAND_CONNECTIONS,
  FACEMESH_TESSELATION,
} from "@mediapipe/holistic";

const MediaPipeTracker = React.forwardRef(
  (
    {
      onResults,
      isTracking,
      width = 320,
      height = 240,
      cameraStreamRef,
      remoteStream,
      isPrimary = true,
      onStreamReady,
    },
    ref,
  ) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const holisticRef = useRef(null);
    const cameraInstanceRef = useRef(null);
    const animationFrameRef = useRef(null);
    const isInitializedRef = useRef(false);
    const isMountedRef = useRef(true);
    const latestResultsRef = useRef(null);
    const isProcessingFrameRef = useRef(false);
    const lastFrameTimeRef = useRef(0);

    const [initializationError, setInitializationError] = useState(null);
    const [cameraReady, setCameraReady] = useState(false);
    const [currentStreamType, setCurrentStreamType] = useState(null); // 'local' | 'remote'
    const [isStreaming, setIsStreaming] = useState(false);

    // Throttle frame processing to prevent overwhelming MediaPipe
    const FRAME_THROTTLE_MS = 33; // ~30 FPS max

    // Function to draw landmarks on canvas
    const drawLandmarksOnCanvas = useCallback((results) => {
      const canvas = canvasRef.current;
      if (!canvas || !results || !isMountedRef.current) return;

      try {
        const ctx = canvas.getContext("2d");
        ctx.save();

        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Set canvas size to match video
        const video = videoRef.current;
        if (video && video.videoWidth && video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        // Mirror the canvas horizontally to match the flipped video
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);

        // Draw pose landmarks and connections
        if (results.poseLandmarks) {
          drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
            color: "#00FF00",
            lineWidth: 2,
          });
          drawLandmarks(ctx, results.poseLandmarks, {
            color: "#FF0000",
            lineWidth: 2,
            radius: 6, // Make dots bigger for debugging
          });
        }

        // Draw left hand landmarks
        if (results.leftHandLandmarks) {
          drawConnectors(ctx, results.leftHandLandmarks, HAND_CONNECTIONS, {
            color: "#00FFFF",
            lineWidth: 2,
          });
          drawLandmarks(ctx, results.leftHandLandmarks, {
            color: "#0000FF",
            lineWidth: 1,
            radius: 2,
          });
        }

        // Draw right hand landmarks
        if (results.rightHandLandmarks) {
          drawConnectors(ctx, results.rightHandLandmarks, HAND_CONNECTIONS, {
            color: "#FFFF00",
            lineWidth: 2,
          });
          drawLandmarks(ctx, results.rightHandLandmarks, {
            color: "#FF00FF",
            lineWidth: 1,
            radius: 2,
          });
        }

        // Draw face landmarks (optional - can be overwhelming)
        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          drawConnectors(ctx, results.faceLandmarks, FACEMESH_TESSELATION, {
            color: "#C0C0C070",
            lineWidth: 1,
          });
        }

        ctx.restore();
      } catch (error) {
        console.error("[MediaPipeTracker] Error drawing landmarks:", error);
      }
    }, []);

    const stableOnResults = useCallback(
      (results) => {
        if (!isMountedRef.current) return;

        try {
          // Store the latest results for drawing
          latestResultsRef.current = results;

          // Draw landmarks on canvas
          drawLandmarksOnCanvas(results);

          // Call the parent callback
          if (onResults) {
            onResults(results);
          }
        } catch (error) {
          console.error(
            "[MediaPipeTracker] Error in onResults callback:",
            error,
          );
        } finally {
          // Reset processing flag
          isProcessingFrameRef.current = false;
        }
      },
      [onResults, drawLandmarksOnCanvas],
    );

    useEffect(() => {
      isMountedRef.current = true;

      const initializeMediaPipe = async () => {
        if (isInitializedRef.current || !isMountedRef.current) return;

        try {
          setInitializationError(null);

          holisticRef.current = new Holistic({
            locateFile: (file) => {
              return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
            },
          });

          holisticRef.current.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: false,
            refineFaceLandmarks: false, // Disable for better performance
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });

          holisticRef.current.onResults(stableOnResults);

          await initializeCamera();

          isInitializedRef.current = true;
        } catch (error) {
          console.error(
            "[MediaPipeTracker] MediaPipe initialization error:",
            error,
          );
          setInitializationError(error.message);
        }
      };

      const initializeCamera = async () => {
        try {
          if (!videoRef.current || !isMountedRef.current) return;

          // Clean up existing camera instance
          if (cameraInstanceRef.current) {
            try {
              cameraInstanceRef.current.stop();
            } catch (e) {
              console.warn(
                "[MediaPipeTracker] Error stopping existing camera:",
                e,
              );
            }
            cameraInstanceRef.current = null;
          }

          // Handle remote stream case
          if (remoteStream) {
            videoRef.current.srcObject = remoteStream;
            setCurrentStreamType("remote");
            setIsStreaming(true);
            setCameraReady(true);

            // Start processing frames from remote stream
            const processRemoteFrame = async () => {
              if (
                !holisticRef.current ||
                !videoRef.current ||
                !isMountedRef.current ||
                !remoteStream
              ) {
                return;
              }

              // Throttle frame processing
              const now = Date.now();
              if (now - lastFrameTimeRef.current < FRAME_THROTTLE_MS) {
                requestAnimationFrame(processRemoteFrame);
                return;
              }

              if (isProcessingFrameRef.current) {
                requestAnimationFrame(processRemoteFrame);
                return;
              }

              try {
                isProcessingFrameRef.current = true;
                lastFrameTimeRef.current = now;
                await holisticRef.current.send({ image: videoRef.current });
              } catch (error) {
                console.error(
                  "[MediaPipeTracker] Error sending remote frame:",
                  error,
                );
                isProcessingFrameRef.current = false;
              }

              if (isMountedRef.current && remoteStream) {
                requestAnimationFrame(processRemoteFrame);
              }
            };

            // Ensure video is playing before starting frame processing
            videoRef.current.onloadeddata = () => {
              requestAnimationFrame(processRemoteFrame);
              if (onStreamReady) onStreamReady();
            };

            return;
          }

          // Handle local camera case
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: "user",
            },
          });

          if (!isMountedRef.current) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }

          setCurrentStreamType("local");

          cameraInstanceRef.current = new Camera(videoRef.current, {
            onFrame: async () => {
              if (
                !holisticRef.current ||
                !videoRef.current ||
                !isMountedRef.current ||
                remoteStream // Don't process local frames if remote stream is active
              ) {
                return;
              }

              // Throttle frame processing
              const now = Date.now();
              if (now - lastFrameTimeRef.current < FRAME_THROTTLE_MS) {
                return;
              }

              // Skip if already processing a frame
              if (isProcessingFrameRef.current) {
                return;
              }

              try {
                isProcessingFrameRef.current = true;
                lastFrameTimeRef.current = now;

                await holisticRef.current.send({ image: videoRef.current });
              } catch (error) {
                console.error("[MediaPipeTracker] Error sending frame:", error);
                isProcessingFrameRef.current = false;
              }
            },
            width: 640,
            height: 480,
            facingMode: "user",
          });

          await cameraInstanceRef.current.start();
          setIsStreaming(true);
          setCameraReady(true);
          if (onStreamReady) onStreamReady();
        } catch (error) {
          console.error(
            "[MediaPipeTracker] Camera initialization error:",
            error,
          );
          setInitializationError(`Camera error: ${error.message}`);
          setIsStreaming(false);
        }
      };

      const timer = setTimeout(initializeMediaPipe, 100);

      return () => {
        clearTimeout(timer);
        isMountedRef.current = false;

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }

        // Stop camera first
        if (cameraInstanceRef.current) {
          try {
            cameraInstanceRef.current.stop();
          } catch (error) {
            console.warn("[MediaPipeTracker] Error stopping camera:", error);
          }
          cameraInstanceRef.current = null;
        }

        // Close holistic after a small delay to ensure no frames are being processed
        setTimeout(() => {
          if (holisticRef.current) {
            try {
              holisticRef.current.close();
            } catch (error) {
              console.warn("[MediaPipeTracker] Error closing holistic:", error);
            }
            holisticRef.current = null;
          }
        }, 100);

        isInitializedRef.current = false;
      };
    }, [stableOnResults]);

    // Simplified animation frame - only redraw when needed
    useEffect(() => {
      if (!cameraReady) return;

      const draw = () => {
        if (!isMountedRef.current) return;

        // Only redraw if we have new results
        if (latestResultsRef.current) {
          drawLandmarksOnCanvas(latestResultsRef.current);
        }

        if (isMountedRef.current) {
          animationFrameRef.current = requestAnimationFrame(draw);
        }
      };

      animationFrameRef.current = requestAnimationFrame(draw);

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }, [cameraReady, drawLandmarksOnCanvas]);

    const handleRetryInitialization = useCallback(() => {
      setInitializationError(null);
      isInitializedRef.current = false;
      setCameraReady(false);
      isProcessingFrameRef.current = false;
      window.location.reload();
    }, []);

    // Expose videoRef and canvasRef to parent
    React.useImperativeHandle(ref, () => ({
      getVideoElement: () => videoRef.current,
      getCanvasElement: () => canvasRef.current,
    }));

    // Handle remote stream changes
    useEffect(() => {
      let isEffectMounted = true;

      const handleStreamChange = async () => {
        if (!isMountedRef.current || !isEffectMounted) return;

        try {
          // Reset states
          setCameraReady(false);
          setIsStreaming(false);
          setInitializationError(null);

          // Reinitialize camera based on stream type
          if (holisticRef.current) {
            if (remoteStream) {
              console.log("[MediaPipeTracker] Switching to remote stream");
              videoRef.current.srcObject = remoteStream;
              setCurrentStreamType("remote");
              setIsStreaming(true);
              setCameraReady(true);

              // Set up frame processing for remote stream
              const processRemoteFrame = async () => {
                if (
                  !holisticRef.current ||
                  !videoRef.current ||
                  !isMountedRef.current ||
                  !remoteStream
                ) {
                  return;
                }

                const now = Date.now();
                if (
                  now - lastFrameTimeRef.current < FRAME_THROTTLE_MS ||
                  isProcessingFrameRef.current
                ) {
                  requestAnimationFrame(processRemoteFrame);
                  return;
                }

                try {
                  isProcessingFrameRef.current = true;
                  lastFrameTimeRef.current = now;
                  await holisticRef.current.send({ image: videoRef.current });
                } catch (error) {
                  console.error(
                    "[MediaPipeTracker] Error processing remote frame:",
                    error,
                  );
                } finally {
                  isProcessingFrameRef.current = false;
                }

                if (isMountedRef.current && remoteStream) {
                  requestAnimationFrame(processRemoteFrame);
                }
              };

              videoRef.current.onloadeddata = () => {
                requestAnimationFrame(processRemoteFrame);
                if (onStreamReady) onStreamReady();
              };
            } else {
              // Initialize local camera
              console.log("[MediaPipeTracker] Switching to local camera");
              // This will be handled by the regular initialization effect
              window.location.reload(); // Temporary solution to ensure clean state
            }
          }
        } catch (error) {
          console.error("[MediaPipeTracker] Stream change error:", error);
          setInitializationError(`Stream switch error: ${error.message}`);
        }
      };

      // Debounce stream changes to avoid rapid switching
      const timeoutId = setTimeout(handleStreamChange, 100);

      return () => {
        isEffectMounted = false;
        clearTimeout(timeoutId);
      };
    }, [remoteStream, onStreamReady]);

    // Dynamic positioning and sizing based on isPrimary
    const containerClasses = isPrimary
      ? "absolute top-4 right-4 z-50 bg-black rounded-lg overflow-hidden shadow-2xl border-2 border-purple-500"
      : "absolute bottom-4 right-4 z-40 bg-black rounded-lg overflow-hidden shadow-lg border-2 border-gray-600 opacity-80";

    const containerSize = isPrimary
      ? { width: `${width}px`, height: `${height}px` }
      : { width: `${width * 0.75}px`, height: `${height * 0.75}px` };

    return (
      <div className={containerClasses} style={containerSize}>
        <video
          ref={videoRef}
          className="w-full h-full object-cover transform -scale-x-100"
          autoPlay
          muted
          playsInline
          style={{ position: "absolute", top: 0, left: 0 }}
        />

        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          style={{ zIndex: 10 }}
        />

        <div className="absolute top-1 left-1 bg-black bg-opacity-70 text-white px-1 py-0.5 rounded text-xs font-medium z-20">
          {currentStreamType === "remote" ? "Mobile Camera" : "Laptop Camera"}
        </div>

        <div className="absolute top-1 right-1 z-20">
          <div
            className={`w-2 h-2 rounded-full ${
              isTracking ? "bg-green-500" : "bg-red-500"
            } shadow-lg`}
          ></div>
        </div>

        {/* Landmark Legend */}
        <div className="absolute bottom-1 left-1 bg-black bg-opacity-80 text-white px-1 py-0.5 rounded text-xs z-20">
          <div className="flex items-center space-x-2">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
              <span>Pose</span>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-1"></div>
              <span>L Hand</span>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-purple-500 rounded-full mr-1"></div>
              <span>R Hand</span>
            </div>
          </div>
        </div>

        {cameraReady && (
          <div className="absolute bottom-1 right-1 bg-green-600 bg-opacity-80 text-white px-1 py-0.5 rounded text-xs font-medium z-20">
            Ready
          </div>
        )}

        {initializationError && (
          <div className="absolute inset-0 bg-red-900 bg-opacity-90 flex items-center justify-center z-30">
            <div className="text-center text-white p-2">
              <div className="mb-2">
                <svg
                  className="w-6 h-6 mx-auto mb-1 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h3 className="text-xs font-semibold">Error</h3>
              </div>
              <p className="text-xs mb-2">{initializationError}</p>
              <button
                onClick={handleRetryInitialization}
                className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs font-medium transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {!cameraReady && !initializationError && (
          <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-30">
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto mb-2"></div>
              <p className="text-xs">Loading...</p>
            </div>
          </div>
        )}
      </div>
    );
  },
);

export default MediaPipeTracker;
