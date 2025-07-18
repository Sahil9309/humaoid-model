// src/components/VideoRecorder.jsx
import React, { useRef, useState, useCallback, useEffect } from "react";

const VideoRecorder = ({
  recordingSourceRef, // This will be drawingCanvasRef from UrdfUploader
  onRecordingStatusChange,
  onVideoAvailable,
  isRobotLoaded,
  isPlayingRecordedVideo,
  setIsPlayingRecordedVideo,
  recordedVideoPlayerRef, // Ref to the playback video element in UrdfUploader
  onPlayRecordedVideo, // New callback to handle recorded video playback
}) => {
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const [isRecording, setIsRecording] = useState(false);
  const [localRecordedVideoBlob, setLocalRecordedVideoBlob] = useState(null);

  const startRecording = useCallback(() => {
    console.log("[VideoRecorder] startRecording called.");
    if (!recordingSourceRef.current) {
      console.warn(
        "[VideoRecorder] Recording source ref is not available for recording.",
      );
      onRecordingStatusChange(
        "Error: Recording source (camera feed) not ready.",
        false,
      );
      return;
    }

    recordedChunksRef.current = [];
    setLocalRecordedVideoBlob(null); // Clear any previous blob
    if (recordedVideoPlayerRef.current) {
      recordedVideoPlayerRef.current.src = ""; // Clear previous video src
      recordedVideoPlayerRef.current.load(); // Ensure video element updates
    }
    setIsPlayingRecordedVideo(false); // Ensure playback state is off when starting new recording

    let stream;
    try {
      // Get canvas from MediaPipe tracker (with landmark overlay)
      const canvasElement = recordingSourceRef.current.getCanvasElement
        ? recordingSourceRef.current.getCanvasElement()
        : recordingSourceRef.current;

      if (!canvasElement) {
        throw new Error("Canvas element not available from MediaPipe tracker.");
      }

      // Get stream from the MediaPipe canvas (showing video + landmarks)
      stream = canvasElement.captureStream(30); // 30 FPS
      if (!stream) {
        throw new Error("Failed to capture stream from recording source.");
      }
      console.log(
        "[VideoRecorder] Successfully captured stream from MediaPipe canvas",
      );
    } catch (error) {
      console.error("[VideoRecorder] Error capturing stream:", error);
      onRecordingStatusChange(
        "Error capturing video stream from camera feed. Check browser permissions.",
        false,
      );
      return;
    }

    try {
      const mimeType = MediaRecorder.isTypeSupported("video/webm; codecs=vp8")
        ? "video/webm; codecs=vp8"
        : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "";

      if (!mimeType) {
        console.error(
          "[VideoRecorder] No supported video mimeType found for MediaRecorder.",
        );
        onRecordingStatusChange(
          "Error: No supported video format for recording in your browser.",
          false,
        );
        return;
      }

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: mimeType,
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        console.log(
          "[VideoRecorder] MediaRecorder onstop event fired. Final chunks count:",
          recordedChunksRef.current.length,
        );
        const currentBlob = new Blob(recordedChunksRef.current, {
          type: mediaRecorderRef.current.mimeType,
        });

        if (localRecordedVideoBlob) {
          URL.revokeObjectURL(localRecordedVideoBlob);
          console.log(
            "[VideoRecorder] Revoked previous local recorded video Blob URL.",
          );
        }

        setLocalRecordedVideoBlob(currentBlob);
        onVideoAvailable(currentBlob);
        onRecordingStatusChange(
          "Recording stopped. Video is ready to play.",
          false,
        );
        setIsRecording(false);
        console.log(
          "[VideoRecorder] Blob created with size:",
          currentBlob.size,
          "bytes. Type:",
          currentBlob.type,
        );
      };

      mediaRecorderRef.current.onerror = (event) => {
        console.error("[VideoRecorder] MediaRecorder error:", event.error);
        onRecordingStatusChange(
          `Recording error: ${event.error.name} - ${event.error.message}`,
          false,
        );
        setIsRecording(false);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      onRecordingStatusChange("Recording started...", true);
      console.log("[VideoRecorder] Recording started with mimeType:", mimeType);
    } catch (error) {
      console.error("[VideoRecorder] Error initializing MediaRecorder:", error);
      onRecordingStatusChange(
        `Error starting recording: ${error.message}`,
        false,
      );
      setIsRecording(false);
    }
  }, [
    recordingSourceRef,
    onRecordingStatusChange,
    onVideoAvailable,
    localRecordedVideoBlob,
    recordedVideoPlayerRef,
    setIsPlayingRecordedVideo,
  ]);

  const stopRecording = useCallback(() => {
    console.log(
      "[VideoRecorder] stopRecording called. Current isRecording:",
      isRecording,
    );
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    } else {
      console.warn(
        "[VideoRecorder] MediaRecorder is not in 'recording' state. State:",
        mediaRecorderRef.current?.state,
      );
      setIsRecording(false);
      onRecordingStatusChange("Recording not active.", false);
    }
  }, [isRecording]);

  const playRecordedVideo = useCallback(() => {
    const playerElement = recordedVideoPlayerRef.current;
    console.log("[VideoRecorder] Attempting to play recorded video.");
    console.log("  localRecordedVideoBlob:", localRecordedVideoBlob);
    console.log("  playerElement:", playerElement);

    if (
      !localRecordedVideoBlob ||
      localRecordedVideoBlob.size === 0 ||
      !playerElement
    ) {
      console.warn(
        "[VideoRecorder] Playback conditions not met (video or player missing).",
      );
      onRecordingStatusChange(
        "Cannot play: Video not recorded or player unavailable.",
        false,
      );
      return;
    }

    const videoUrl = URL.createObjectURL(localRecordedVideoBlob);
    playerElement.src = videoUrl;
    playerElement.loop = false;
    playerElement.controls = true;

    setIsPlayingRecordedVideo(true);

    // Call the parent component's playback handler
    // This will set up MediaPipe to analyze the video stream
    if (onPlayRecordedVideo) {
      onPlayRecordedVideo(playerElement);
    }

    playerElement.onended = () => {
      console.log("[VideoRecorder] Recorded video playback ended.");
      setIsPlayingRecordedVideo(false);
      URL.revokeObjectURL(videoUrl);
      playerElement.src = "";
      playerElement.controls = false;
      
      // Notify parent that playback ended
      if (onPlayRecordedVideo) {
        onPlayRecordedVideo(null); // null indicates playback ended
      }
    };

    playerElement
      .play()
      .then(() => {
        console.log("[VideoRecorder] Playback successfully initiated.");
      })
      .catch((e) => {
        console.error(
          "[VideoRecorder] Error playing recorded video:",
          e,
        );
        onRecordingStatusChange(
          `Error playing video: ${e.name} - ${e.message}`,
          false,
        );
        setIsPlayingRecordedVideo(false);
        try {
          URL.revokeObjectURL(videoUrl);
        } catch (revokeErr) {
          console.warn("Error revoking URL after playback error:", revokeErr);
        }
      });
  }, [
    localRecordedVideoBlob,
    setIsPlayingRecordedVideo,
    recordedVideoPlayerRef,
    onRecordingStatusChange,
    onPlayRecordedVideo,
  ]);

  useEffect(() => {
    return () => {
      if (localRecordedVideoBlob) {
        try {
          URL.revokeObjectURL(localRecordedVideoBlob);
          console.log(
            "[VideoRecorder] Revoked recorded video Blob URL on cleanup.",
          );
        } catch (e) {
          console.warn(
            "[VideoRecorder] Error revoking recorded video Blob URL:",
            e,
          );
        }
      }
      if (recordedVideoPlayerRef.current) {
        if (!recordedVideoPlayerRef.current.paused) {
          recordedVideoPlayerRef.current.pause();
        }
        recordedVideoPlayerRef.current.currentTime = 0;
        recordedVideoPlayerRef.current.src = "";
        recordedVideoPlayerRef.current.controls = false;
      }
    };
  }, [localRecordedVideoBlob, recordedVideoPlayerRef]);

  return (
    <div className="bg-gradient-to-br from-purple-800/20 to-cyan-800/20 backdrop-blur-sm rounded-xl p-4 border border-purple-500/20 mb-6">
      <h3 className="text-lg font-semibold mb-3 text-purple-300">
        Video Recording
      </h3>
      <div className="flex flex-col space-y-3">
        <button
          onClick={startRecording}
          disabled={isRecording || !isRobotLoaded || isPlayingRecordedVideo}
          className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100 shadow-lg hover:shadow-green-500/25"
        >
          {isRecording ? "Recording..." : "Start Recording"}
        </button>
        <button
          onClick={stopRecording}
          disabled={!isRecording}
          className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100 shadow-lg hover:shadow-orange-500/25"
        >
          Stop Recording
        </button>
        <button
          onClick={playRecordedVideo}
          disabled={
            !localRecordedVideoBlob ||
            localRecordedVideoBlob.size === 0 ||
            isPlayingRecordedVideo ||
            isRecording
          }
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100 shadow-lg hover:shadow-blue-500/25"
        >
          Play Recorded Video
        </button>
      </div>
      {localRecordedVideoBlob && (
        <p className="mt-3 text-sm text-emerald-400 bg-emerald-900/20 p-2 rounded-lg">
          ✓ Recorded video available. Size:{" "}
          {(localRecordedVideoBlob.size / 1024).toFixed(2)} KB.
        </p>
      )}
    </div>
  );
};

export default VideoRecorder;