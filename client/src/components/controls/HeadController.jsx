// src/components/controls/HeadController.jsx
import { useCallback, useEffect, useRef } from 'react';

const HeadController = ({ 
    poseLandmarks, 
    loadedRobotInstanceRef, 
    setRobotJointStates,
    mapRange 
}) => {
    const lastValuesRef = useRef({ headYaw: null, headPitch: null });

    const updateHeadControl = useCallback(() => {
        // Add proper error checking
        if (!poseLandmarks || !loadedRobotInstanceRef?.current || typeof setRobotJointStates !== 'function') {
            return;
        }

        try {
            const noseLandmark = poseLandmarks[0];
            if (noseLandmark) {
                const headYaw = mapRange(noseLandmark.x, 0, 1, Math.PI/2, -Math.PI/2);
                const headPitch = mapRange(noseLandmark.y, 0, 1, -Math.PI/2, Math.PI/2);
                
                // Only update if values have changed significantly
                const threshold = 0.01;
                if (Math.abs(lastValuesRef.current.headYaw - headYaw) > threshold ||
                    Math.abs(lastValuesRef.current.headPitch - headPitch) > threshold) {
                    
                    lastValuesRef.current.headYaw = headYaw;
                    lastValuesRef.current.headPitch = headPitch;
                    
                    setRobotJointStates(prev => ({
                        ...prev,
                        'HEAD_JOINT0': headYaw,
                        'HEAD_JOINT1': headPitch,
                    }));
                }
            }
        } catch (error) {
            console.error('Error in HeadController:', error);
        }
    }, [poseLandmarks, loadedRobotInstanceRef, setRobotJointStates, mapRange]);

    useEffect(() => {
        updateHeadControl();
    }, [poseLandmarks]); // Only depend on poseLandmarks, not the callback

    return null;
};

export default HeadController;