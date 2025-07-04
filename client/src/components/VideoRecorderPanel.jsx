import React, { useRef, useState, useCallback, useEffect } from 'react';

const VideoRecorderPanel = ({
    // Recording source (canvas or video element)
    recordingSourceRef,
    // Robot and tracking state
    isRobotLoaded,
    recordedJointStatesData = [],
    // Video playback
    isPlayingRecordedVideo,
    setIsPlayingRecordedVideo,
    recordedVideoPlayerRef,
    // Recording callbacks
    onRecordingStatusChange,
    onVideoAvailable,
    onPlayRecordedData,
    // Additional props for enhanced functionality
    onRecordedVideoResults,
    recordedLandmarks = [],
    onSetRecordedLandmarks,
    mediaPipeTrackerRef,
    onControlSourceChange,
    // Style customization
    className = ""
}) => {
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);

    const [isRecording, setIsRecording] = useState(false);
    const [localRecordedVideoBlob, setLocalRecordedVideoBlob] = useState(null);
    const [recordingStatus, setRecordingStatus] = useState('');

    // Internal recording status handler
    const handleRecordingStatusChange = useCallback((status, recording) => {
        setRecordingStatus(status);
        setIsRecording(recording);
        if (onRecordingStatusChange) {
            onRecordingStatusChange(status, recording);
        }
    }, [onRecordingStatusChange]);

    // Internal video available handler
    const handleVideoAvailable = useCallback((videoBlob) => {
        setLocalRecordedVideoBlob(videoBlob);
        if (onVideoAvailable) {
            onVideoAvailable(videoBlob);
        }
    }, [onVideoAvailable]);

    const startRecording = useCallback(() => {
        console.log("[VideoRecorderPanel] startRecording called.");
        if (!recordingSourceRef?.current) {
            console.warn("[VideoRecorderPanel] Recording source ref is not available for recording.");
            handleRecordingStatusChange("Error: Recording source not ready.", false);
            return;
        }

        recordedChunksRef.current = [];
        setLocalRecordedVideoBlob(null);
        if (recordedVideoPlayerRef?.current) {
            recordedVideoPlayerRef.current.src = '';
            recordedVideoPlayerRef.current.load();
        }
        if (setIsPlayingRecordedVideo) {
            setIsPlayingRecordedVideo(false);
        }

        let stream;
        try {
            // Get stream from the recording source (canvas or video)
            stream = recordingSourceRef.current.captureStream ? 
                recordingSourceRef.current.captureStream(30) : 
                recordingSourceRef.current.srcObject;
            
            if (!stream) {
                throw new Error("Failed to capture stream from recording source.");
            }
        } catch (error) {
            console.error("[VideoRecorderPanel] Error capturing stream:", error);
            handleRecordingStatusChange("Error capturing video stream. Check browser permissions.", false);
            return;
        }

        try {
            const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp8') 
                             ? 'video/webm; codecs=vp8' 
                             : (MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '');
            
            if (!mimeType) {
                console.error("[VideoRecorderPanel] No supported video mimeType found for MediaRecorder.");
                handleRecordingStatusChange("Error: No supported video format for recording in your browser.", false);
                return;
            }

            mediaRecorderRef.current = new MediaRecorder(stream, {
                mimeType: mimeType
            });

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                console.log("[VideoRecorderPanel] MediaRecorder onstop event fired. Final chunks count:", recordedChunksRef.current.length);
                const currentBlob = new Blob(recordedChunksRef.current, { type: mediaRecorderRef.current.mimeType });
                
                if (localRecordedVideoBlob) {
                    URL.revokeObjectURL(localRecordedVideoBlob);
                    console.log("[VideoRecorderPanel] Revoked previous local recorded video Blob URL.");
                }
                
                handleVideoAvailable(currentBlob);
                handleRecordingStatusChange("Recording stopped. Video is ready to play.", false);
                console.log("[VideoRecorderPanel] Blob created with size:", currentBlob.size, "bytes. Type:", currentBlob.type);
            };

            mediaRecorderRef.current.onerror = (event) => {
                console.error("[VideoRecorderPanel] MediaRecorder error:", event.error);
                handleRecordingStatusChange(`Recording error: ${event.error.name} - ${event.error.message}`, false);
            };

            mediaRecorderRef.current.start();
            handleRecordingStatusChange("Recording started...", true);
            
            // Switch to camera control source during recording
            if (onControlSourceChange) {
                onControlSourceChange('camera');
            }
            
            console.log("[VideoRecorderPanel] Recording started with mimeType:", mimeType);
        } catch (error) {
            console.error("[VideoRecorderPanel] Error initializing MediaRecorder:", error);
            handleRecordingStatusChange(`Error starting recording: ${error.message}`, false);
        }
    }, [recordingSourceRef, handleRecordingStatusChange, handleVideoAvailable, localRecordedVideoBlob, recordedVideoPlayerRef, setIsPlayingRecordedVideo, onControlSourceChange]);

    const stopRecording = useCallback(() => {
        console.log("[VideoRecorderPanel] stopRecording called. Current isRecording:", isRecording);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        } else {
            console.warn("[VideoRecorderPanel] MediaRecorder is not in 'recording' state. State:", mediaRecorderRef.current?.state);
            handleRecordingStatusChange("Recording not active.", false);
        }
    }, [isRecording, handleRecordingStatusChange]);

    const playRecordedVideo = useCallback(() => {
        const playerElement = recordedVideoPlayerRef?.current;
        console.log("[VideoRecorderPanel] Attempting to play recorded video.");
        console.log("  localRecordedVideoBlob:", localRecordedVideoBlob);
        console.log("  playerElement:", playerElement);
        console.log("  recordedJointStatesData length:", recordedJointStatesData.length);
        console.log("  isPlayingRecordedVideo:", isPlayingRecordedVideo, "isRecording:", isRecording);

        if (!localRecordedVideoBlob || localRecordedVideoBlob.size === 0 || !playerElement) { 
            console.warn("[VideoRecorderPanel] Playback conditions not met (video or player missing).");
            handleRecordingStatusChange("Cannot play: Video not recorded or player unavailable.", false);
            return;
        }

        const videoUrl = URL.createObjectURL(localRecordedVideoBlob);
        playerElement.src = videoUrl;
        playerElement.loop = false;
        playerElement.controls = true; 
        
        if (setIsPlayingRecordedVideo) {
            setIsPlayingRecordedVideo(true);
        }

        // Switch to recorded video control source
        if (onControlSourceChange) {
            onControlSourceChange('recorded');
        }

        // Trigger joint data playback if available
        if (onPlayRecordedData && recordedJointStatesData.length > 0) {
            onPlayRecordedData(recordedJointStatesData);
            console.log("[VideoRecorderPanel] Triggered onPlayRecordedData with", recordedJointStatesData.length, "frames.");
        } else {
            console.warn("[VideoRecorderPanel] No joint data available for robot animation during playback.");
            if (onPlayRecordedData) {
                onPlayRecordedData([]);
            }
        }

        playerElement.onended = () => {
            console.log("[VideoRecorderPanel] Recorded video playback ended.");
            if (setIsPlayingRecordedVideo) {
                setIsPlayingRecordedVideo(false);
            }
            // Switch back to camera control
            if (onControlSourceChange) {
                onControlSourceChange('camera');
            }
            URL.revokeObjectURL(videoUrl);
            playerElement.src = '';
            playerElement.controls = false;
        };

        playerElement.play().then(() => {
            console.log("[VideoRecorderPanel] Playback successfully initiated.");
        }).catch(e => {
            console.error("[VideoRecorderPanel] Error playing recorded video:", e);
            handleRecordingStatusChange(`Error playing video: ${e.name} - ${e.message}. Check browser console for details.`, false);
            if (setIsPlayingRecordedVideo) {
                setIsPlayingRecordedVideo(false);
            }
            if (onControlSourceChange) {
                onControlSourceChange('camera');
            }
            try { URL.revokeObjectURL(videoUrl); } catch (revokeErr) { console.warn("Error revoking URL after playback error:", revokeErr); }
        });
        console.log("[VideoRecorderPanel] Attempted to play video from blob URL:", videoUrl);
    }, [localRecordedVideoBlob, setIsPlayingRecordedVideo, onPlayRecordedData, recordedJointStatesData, recordedVideoPlayerRef, handleRecordingStatusChange, isRecording, isPlayingRecordedVideo, onControlSourceChange]);

    // Cleanup effect
    useEffect(() => {
        return () => {
            if (localRecordedVideoBlob) {
                try {
                    URL.revokeObjectURL(localRecordedVideoBlob);
                    console.log("[VideoRecorderPanel] Revoked recorded video Blob URL on cleanup.");
                } catch (e) {
                    console.warn("[VideoRecorderPanel] Error revoking recorded video Blob URL on cleanup:", e);
                }
            }
            if (recordedVideoPlayerRef?.current) {
                if (!recordedVideoPlayerRef.current.paused) {
                    recordedVideoPlayerRef.current.pause();
                    console.log("[VideoRecorderPanel] Paused playing video on component unmount.");
                }
                recordedVideoPlayerRef.current.currentTime = 0;
                recordedVideoPlayerRef.current.src = '';
                recordedVideoPlayerRef.current.controls = false;
            }
        };
    }, [localRecordedVideoBlob, recordedVideoPlayerRef]);

    return (
        <div className={`bg-gradient-to-br from-purple-800/20 to-cyan-800/20 backdrop-blur-sm rounded-xl p-4 border border-purple-500/20 ${className}`}>
            <h3 className="text-lg font-semibold mb-3 text-purple-300">Video Recording</h3>
            <div className="flex flex-col space-y-3">
                <button
                    onClick={startRecording}
                    disabled={isRecording || !isRobotLoaded || isPlayingRecordedVideo}
                    className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100 shadow-lg hover:shadow-green-500/25"
                >
                    {isRecording ? 'Recording...' : 'Start Recording'}
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
                    disabled={!localRecordedVideoBlob || localRecordedVideoBlob.size === 0 || isPlayingRecordedVideo || isRecording || recordedJointStatesData.length === 0}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100 shadow-lg hover:shadow-blue-500/25"
                >
                    Play Recorded Video
                </button>
            </div>
            
            {/* Status Display */}
            {recordingStatus && (
                <div className="mt-3 text-sm text-cyan-400 bg-cyan-900/20 p-2 rounded-lg">
                    {recordingStatus}
                </div>
            )}
            
            {/* Video Info */}
            {localRecordedVideoBlob && (
                <div className="mt-3 text-sm text-emerald-400 bg-emerald-900/20 p-2 rounded-lg">
                    ✓ Recorded video available. Size: {(localRecordedVideoBlob.size / 1024).toFixed(2)} KB.
                    {recordedJointStatesData.length > 0 ? ` Joint frames: ${recordedJointStatesData.length}` : ' No joint data recorded.'}
                </div>
            )}
            
            {/* Video Player */}
            <video
                ref={recordedVideoPlayerRef}
                className="w-full mt-3 rounded-lg bg-black"
                style={{ display: localRecordedVideoBlob ? "block" : "none" }}
                controls={false}
            />
        </div>
    );
};

export default VideoRecorderPanel;