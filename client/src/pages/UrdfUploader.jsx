// src/pages/UrdfUploader.jsx
import React, {
  useRef,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Text } from "@react-three/drei";
import { UrdfRobotModel, CameraUpdater } from "../components/UrdfRobotModel";
import BodyController from "../components/controls/BodyController";
import MediaPipeTracker from "./MediaPipeTracker";
import FileUploadPanel from "../components/FileUploadPanel";
import RobotErrorBoundary from "../components/RobotErrorBoundary";
import VideoRecorder from "../components/VideoRecorder";
import DesktopWebRTCReceiver from "./DesktopWebRTCReceiver";

const UrdfUploader = () => {
  // File states
  const [urdfFile, setUrdfFile] = useState(null);
  const [meshFiles, setMeshFiles] = useState(new Map());
  const [status, setStatus] = useState("Upload your URDF and mesh files.");
  const [robotLoadRequested, setRobotLoadRequested] = useState(false);
  const [canvasError, setCanvasError] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Tracking states
  const [isTracking, setIsTracking] = useState(false);
  const [poseLandmarks, setPoseLandmarks] = useState(null);
  const [leftHandLandmarks, setLeftHandLandmarks] = useState(null);
  const [rightHandLandmarks, setRightHandLandmarks] = useState(null);

  // Video recording states
  const [recordingStatus, setRecordingStatus] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideoBlob, setRecordedVideoBlob] = useState(null);
  const [isPlayingRecordedVideo, setIsPlayingRecordedVideo] = useState(false);

  // Control source state
  const [controlSource, setControlSource] = useState("camera"); // 'camera' or 'video'

  // Refs
  const loadedRobotInstanceRef = useRef(null);
  const robotJointStatesRef = useRef({}); // This will store the joint states
  const blobUrlsRef = useRef([]);
  const robotLoadedRef = useRef(false);
  const [cameraUpdateTrigger, setCameraUpdateTrigger] = useState(0);

  // Robot joint states for rendering (triggers re-renders)
  const [robotJointStates, setRobotJointStates] = useState({});

  // Video recording refs
  const drawingCanvasRef = useRef(null);
  const recordedVideoPlayerRef = useRef(null);
  const mediaPipeTrackerRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const recordedVideoMediaPipeRef = useRef(null); // MediaPipe for recorded video

  // New states
  const [cameraSource, setCameraSource] = useState("laptop"); // 'laptop' | 'mobile'
  const [remoteStream, setRemoteStream] = useState(null);

  // Process URDF file
  const processedUrdfData = useMemo(() => {
    if (!urdfFile) return null;

    try {
      const blobUrl = URL.createObjectURL(urdfFile);
      blobUrlsRef.current.push(blobUrl);

      return {
        file: urdfFile,
        blobUrl: blobUrl,
        name: urdfFile.name,
      };
    } catch (error) {
      console.error("Error creating URDF blob URL:", error);
      setStatus("Error processing URDF file.");
      return null;
    }
  }, [urdfFile]);

  // Process mesh files
  const processedMeshData = useMemo(() => {
    if (!meshFiles || meshFiles.size === 0) {
      return { fileMap: {} };
    }

    const fileMap = {};

    try {
      meshFiles.forEach((arrayBuffer, filename) => {
        const blob = new Blob([arrayBuffer]);
        const blobUrl = URL.createObjectURL(blob);
        fileMap[filename] = blobUrl;
        blobUrlsRef.current.push(blobUrl);
      });

      return { fileMap };
    } catch (error) {
      console.error("Error creating mesh blob URLs:", error);
      setStatus("Error processing mesh files.");
      return { fileMap: {} };
    }
  }, [meshFiles]);

  // Cleanup blob URLs
  const cleanupBlobUrls = useCallback(() => {
    blobUrlsRef.current.forEach((blobUrl) => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch (e) {
        console.warn("Error revoking blob URL:", e);
      }
    });
    blobUrlsRef.current = [];
  }, []);

  // Handle robot loading
  const handleLoadRobot = useCallback(() => {
    if (!urdfFile) {
      setStatus("Please select a URDF file first.");
      return;
    }

    if (meshFiles.size === 0) {
      setStatus("Please select mesh files (.dae, .stl, .obj, etc.).");
      return;
    }

    if (!processedUrdfData || !processedMeshData.fileMap) {
      setStatus("Error processing files. Please try reselecting your files.");
      return;
    }

    try {
      if (!processedUrdfData.blobUrl)
        throw new Error("URDF blob URL is invalid");
      Object.values(processedMeshData.fileMap).forEach((url) => {
        if (!url) throw new Error("Mesh blob URL is invalid");
      });
    } catch (error) {
      console.error("Invalid blob URLs detected:", error);
      setStatus("File loading error. Please reselect your files.");
      return;
    }

    // Initialize joint states
    robotJointStatesRef.current = {};
    setRobotLoadRequested(true);
    robotLoadedRef.current = false;
    setCanvasError(null);
    setStatus("Loading robot model...");
  }, [urdfFile, meshFiles, processedUrdfData, processedMeshData]);

  const handleRobotLoaded = useCallback((robotInstance) => {
    if (robotLoadedRef.current) return;

    loadedRobotInstanceRef.current = robotInstance;
    robotLoadedRef.current = true;

    // Initialize joint states with robot's available joints
    if (robotInstance && robotInstance.joints) {
      const initialJointStates = {};
      Object.keys(robotInstance.joints).forEach((jointName) => {
        initialJointStates[jointName] = 0;
      });
      robotJointStatesRef.current = initialJointStates;
      setRobotJointStates(initialJointStates);
      console.log(
        "Robot loaded with joints:",
        Object.keys(robotInstance.joints),
      );
    }

    setCameraUpdateTrigger((prev) => prev + 1);
    setStatus(`Robot loaded successfully! Use your body to control the robot.`);
  }, []);

  const handleRobotError = useCallback((error) => {
    console.error("Robot loading error:", error);
    setStatus(`Error loading robot: ${error.message || "Unknown error"}`);
    setCanvasError(error.message || "Failed to load robot model");
    setRobotLoadRequested(false);
    robotLoadedRef.current = false;
    robotJointStatesRef.current = {};
  }, []);

  const handleClearFiles = useCallback(() => {
    setUrdfFile(null);
    setMeshFiles(new Map());
    setRobotLoadRequested(false);
    loadedRobotInstanceRef.current = null;
    robotLoadedRef.current = false;
    robotJointStatesRef.current = {};
    setRobotJointStates({});
    setCanvasError(null);
    setStatus("Files cleared. Upload new URDF and mesh files.");

    // Clear video recording states
    setRecordedVideoBlob(null);
    setIsPlayingRecordedVideo(false);
    setRecordingStatus("");
    setControlSource("camera");

    cleanupBlobUrls();
  }, [cleanupBlobUrls]);

  const handleCanvasError = useCallback((error) => {
    console.error("Canvas error:", error);
    setCanvasError("WebGL rendering error. Please try refreshing the page.");
    setStatus("Rendering error occurred. Please refresh and try again.");
  }, []);

  // MediaPipe results handler - unified for both live and recorded video
  const handleMediaPipeResults = useCallback(
    (results) => {
      // Accept results from both live camera and recorded video
      if (controlSource === "camera" || controlSource === "video") {
        const hasTracking = !!results.poseLandmarks;
        setIsTracking(hasTracking);
        setPoseLandmarks(results.poseLandmarks || null);
        setLeftHandLandmarks(results.leftHandLandmarks || null);
        setRightHandLandmarks(results.rightHandLandmarks || null);
      }
    },
    [controlSource],
  );

  // Video recording handlers
  const handleRecordingStatusChange = useCallback((status, recording) => {
    setRecordingStatus(status);
    setIsRecording(recording);
  }, []);

  const handleVideoAvailable = useCallback((videoBlob) => {
    setRecordedVideoBlob(videoBlob);
    setRecordingStatus("Video recording completed and ready for playback.");
  }, []);

  // Handle recorded video playback with MediaPipe analysis
  const handlePlayRecordedVideo = useCallback((videoElement) => {
    if (!videoElement) {
      // Playback ended, switch back to camera
      setControlSource("camera");
      setIsPlayingRecordedVideo(false);
      console.log("Playback ended, switching back to camera control");
      return;
    }

    console.log("Starting recorded video playback with MediaPipe analysis");
    setControlSource("video");
    setIsPlayingRecordedVideo(true);

    // Set up MediaPipe to analyze the recorded video
    if (recordedVideoMediaPipeRef.current) {
      recordedVideoMediaPipeRef.current.setVideoSource(videoElement);
    }
  }, []);

  const resetErrorBoundary = useCallback(() => {
    setRobotLoadRequested(false);
    robotLoadedRef.current = false;
    robotJointStatesRef.current = {};
    setCanvasError(null);
    setStatus("Try loading the robot again.");
  }, []);

  // Generate stable key for robot component
  const robotKey = useMemo(() => {
    if (!processedUrdfData || !meshFiles.size) return null;
    return `robot-${processedUrdfData.name}-${meshFiles.size}`;
  }, [processedUrdfData?.name, meshFiles.size]);

  // Sync ref with state
  useEffect(() => {
    robotJointStatesRef.current = robotJointStates;
  }, [robotJointStates]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupBlobUrls();
    };
  }, [cleanupBlobUrls]);

  // Cleanup when switching camera source
  useEffect(() => {
    let isEffectMounted = true;

    const handleCameraSourceChange = async () => {
      if (!isEffectMounted) return;

      console.log(`Switching camera source to: ${cameraSource}`);

      // Reset tracking states during switch
      setIsTracking(false);
      setPoseLandmarks(null);
      setLeftHandLandmarks(null);
      setRightHandLandmarks(null);

      if (cameraSource === "laptop") {
        // Clear remote stream when switching to laptop
        setRemoteStream(null);
      }

      // Add a small delay to allow MediaPipe to reinitialize properly
      await new Promise((resolve) => setTimeout(resolve, 200));
    };

    handleCameraSourceChange();

    return () => {
      isEffectMounted = false;
    };
  }, [cameraSource]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white">
      <div className="max-w-full mx-auto h-screen grid lg:grid-cols-4 grid-cols-1 gap-0">
        {/* Left Column - Controls */}
        <div className="bg-slate-900/80 backdrop-blur-sm lg:border-r lg:border-b-0 border-b border-purple-500/20 p-4 overflow-y-auto flex flex-col gap-6">
          {/* File Upload Panel */}
          <div>
            <FileUploadPanel
              urdfFile={urdfFile}
              meshFiles={meshFiles}
              status={status}
              canvasError={canvasError}
              loadingProgress={loadingProgress}
              robotLoadRequested={robotLoadRequested}
              onUrdfFileChange={setUrdfFile}
              onMeshFilesChange={setMeshFiles}
              onLoadRobot={handleLoadRobot}
              onClearFiles={handleClearFiles}
              onStatusChange={setStatus}
              onLoadingProgressChange={setLoadingProgress}
            />
          </div>

          {/* Video Recording Panel */}
          <VideoRecorder
            recordingSourceRef={mediaPipeTrackerRef}
            onRecordingStatusChange={handleRecordingStatusChange}
            onVideoAvailable={handleVideoAvailable}
            isRobotLoaded={robotLoadedRef.current}
            isPlayingRecordedVideo={isPlayingRecordedVideo}
            setIsPlayingRecordedVideo={setIsPlayingRecordedVideo}
            recordedVideoPlayerRef={recordedVideoPlayerRef}
            onPlayRecordedVideo={handlePlayRecordedVideo}
          />

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-slate-700">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Camera Source:
            </label>
            <select
              value={cameraSource}
              onChange={(e) => setCameraSource(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="laptop">Laptop Camera</option>
              <option value="mobile">Mobile Camera (WebRTC)</option>
            </select>
            <div className="mt-2 text-xs text-slate-400">
              Active:{" "}
              {cameraSource === "mobile" && remoteStream
                ? "Mobile Camera"
                : "Laptop Camera"}
            </div>
          </div>

          {cameraSource === "mobile" && (
            <DesktopWebRTCReceiver
              onRemoteStream={setRemoteStream}
              hideVideo={!!remoteStream} // Hide when stream is active and being used by MediaPipe
            />
          )}
        </div>

        {/* Right Column - 3D Model and Camera */}
        <div className="relative flex flex-col lg:col-span-3">
          {/* Body Controller */}
          <BodyController
            poseLandmarks={poseLandmarks}
            leftHandLandmarks={leftHandLandmarks}
            rightHandLandmarks={rightHandLandmarks}
            loadedRobotInstanceRef={loadedRobotInstanceRef}
            setRobotJointStates={setRobotJointStates}
            controlSource={controlSource}
          />

          {/* Camera Feeds */}
          <div className="absolute top-0 right-0 z-30 w-full h-full pointer-events-none">
            {/* Primary Camera Feed - Always active */}
            {!isPlayingRecordedVideo && (
              <MediaPipeTracker
                ref={mediaPipeTrackerRef}
                onResults={handleMediaPipeResults}
                isTracking={isTracking}
                width={320}
                height={240}
                cameraStreamRef={cameraVideoRef}
                remoteStream={
                  cameraSource === "mobile" ? remoteStream : undefined
                }
                isPrimary={true}
              />
            )}

            {/* Secondary Camera Feed - Show inactive source for quick switching */}
            {!isPlayingRecordedVideo &&
              cameraSource === "mobile" &&
              !remoteStream && (
                <MediaPipeTracker
                  onResults={() => {}} // Don't use results from secondary feed
                  isTracking={false}
                  width={240}
                  height={180}
                  isPrimary={false}
                />
              )}

            {/* Recorded Video Player with MediaPipe Analysis */}
            {recordedVideoBlob && (
              <div className="bg-black/80 rounded-lg p-2 backdrop-blur-sm border border-purple-500/20">
                <video
                  ref={recordedVideoPlayerRef}
                  className="w-80 h-60 rounded-lg bg-black"
                  playsInline
                  muted
                  style={{ display: isPlayingRecordedVideo ? "block" : "none" }}
                />
                {/* MediaPipe tracker for recorded video - processes video stream in real-time */}
                {isPlayingRecordedVideo && (
                  <div className="absolute top-2 left-2 w-80 h-60 pointer-events-none">
                    <MediaPipeTracker
                      ref={recordedVideoMediaPipeRef}
                      onResults={handleMediaPipeResults}
                      isTracking={isTracking}
                      width={320}
                      height={240}
                      videoSource={recordedVideoPlayerRef.current}
                      showVideo={false} // Hide the video element, just process landmarks
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Debug Info Panel */}
          {robotLoadedRef.current && (
            <div className="absolute bottom-4 right-4 z-30 bg-black/75 text-white p-3 rounded-lg text-sm backdrop-blur-sm border border-gray-700 max-w-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isTracking ? "bg-green-500" : "bg-red-500"
                    }`}
                  ></div>
                  <span>Tracking: {isTracking ? "Active" : "Inactive"}</span>
                </div>
                <div className="text-gray-300">
                  Joints:{" "}
                  {Object.keys(robotJointStatesRef.current || {}).length}
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isRecording ? "bg-red-500" : "bg-gray-500"
                    }`}
                  ></div>
                  <span>Recording: {isRecording ? "Active" : "Inactive"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      controlSource === "camera"
                        ? "bg-blue-500"
                        : controlSource === "video"
                        ? "bg-purple-500"
                        : "bg-gray-500"
                    }`}
                  ></div>
                  <span>Control: {controlSource}</span>
                </div>
                {poseLandmarks && (
                  <div className="text-green-400">
                    Pose detected: {poseLandmarks.length} landmarks
                  </div>
                )}
                {recordingStatus && (
                  <div className="text-cyan-400 text-xs mt-1">
                    {recordingStatus}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3D Canvas */}
          {robotLoadRequested && processedUrdfData && !canvasError ? (
            <div className="w-full h-full bg-gradient-to-br from-slate-900/50 to-purple-900/30">
              <Canvas
                camera={{ position: [2, 2, 2], fov: 50 }}
                className="w-full h-full"
                gl={{
                  preserveDrawingBuffer: true,
                  antialias: true,
                  alpha: false,
                  powerPreference: "high-performance",
                }}
                onError={handleCanvasError}
                onCreated={({ gl }) => {
                  gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
                }}
              >
                <ambientLight intensity={0.6} />
                <directionalLight position={[5, 5, 5]} intensity={0.8} />
                <pointLight position={[-5, 5, 5]} intensity={0.4} />

                <React.Suspense
                  fallback={
                    <group>
                      <Text
                        position={[0, 0.5, 0]}
                        fontSize={0.5}
                        color="cyan"
                        anchorX="center"
                        anchorY="middle"
                      >
                        Loading Robot...
                      </Text>
                      <Text
                        position={[0, -0.5, 0]}
                        fontSize={0.2}
                        color="cyan"
                        anchorX="center"
                        anchorY="middle"
                      >
                        {loadingProgress > 0
                          ? `${Math.round(loadingProgress)}% loaded`
                          : "Starting..."}
                      </Text>
                    </group>
                  }
                >
                  <RobotErrorBoundary onReset={resetErrorBoundary}>
                    {robotKey && (
                      <UrdfRobotModel
                        key={robotKey}
                        urdfContent={processedUrdfData.blobUrl}
                        fileMap={processedMeshData.fileMap}
                        jointStates={robotJointStates}
                        selectedRobotName="uploaded_robot"
                        onRobotLoaded={handleRobotLoaded}
                        onRobotError={handleRobotError}
                        initialPosition={[0, 0, 0]}
                        scale={1.0}
                      />
                    )}
                  </RobotErrorBoundary>
                </React.Suspense>

                <CameraUpdater
                  loadedRobotInstanceRef={loadedRobotInstanceRef}
                  triggerUpdate={cameraUpdateTrigger}
                />

                <Environment preset="warehouse" />

                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
                  <planeGeometry args={[10, 10]} />
                  <meshStandardMaterial color="#1a1a2e" />
                </mesh>
              </Canvas>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900/50 to-purple-900/30">
              <div className="text-center">
                {canvasError ? (
                  <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-red-600 to-pink-600 rounded-full flex items-center justify-center">
                    <svg
                      className="w-12 h-12 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                  </div>
                ) : (
                  <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-purple-600 to-cyan-600 rounded-full flex items-center justify-center">
                    <svg
                      className="w-12 h-12 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </div>
                )}
                <h3 className="text-2xl font-semibold text-white mb-2">
                  {canvasError ? "Rendering Error" : "Upload Robot Files"}
                </h3>
                <p className="text-slate-400">
                  {canvasError
                    ? "Please refresh the page and try again"
                    : "Select URDF and mesh files to load your robot"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UrdfUploader;
