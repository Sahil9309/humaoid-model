// src/components/controls/ArmController.jsx
import { useCallback, useEffect, useRef } from 'react';

// Utility for angle calculation (from your reference)
const calculateAngle = (a, b, c) => {
    if (!a || !b || !c) return 0;
    const rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(rad);
    if (angle > Math.PI) {
        angle = 2 * Math.PI - angle;
    }
    return angle;
};

const ArmController = ({
    poseLandmarks,
    leftHandLandmarks,
    rightHandLandmarks,
    loadedRobotInstanceRef,
    setRobotJointStates,
    mapRange
}) => {
    // Use refs to store last values for smoothing if needed
    const lastLeftValuesRef = useRef({ shoulderRoll: null, shoulderPitch: null, elbow: null });
    const lastRightValuesRef = useRef({ shoulderRoll: null, shoulderPitch: null, elbow: null });

    const updateArmControls = useCallback(() => {
        if (!loadedRobotInstanceRef?.current || typeof setRobotJointStates !== 'function') {
            return;
        }
        try {
            const threshold = 0.01;
            const newState = {};

            // --- Left arm control (shoulder, elbow) ---
            if (leftHandLandmarks && poseLandmarks?.[11] && poseLandmarks?.[13]) {
                const wrist = leftHandLandmarks[0];
                const elbow = poseLandmarks[13];
                const shoulder = poseLandmarks[11];

                // Shoulder pitch/roll (use MediaPipe coordinates)
                const shoulderPitch = mapRange(wrist.y, 0, 0.75, Math.PI, -Math.PI / 6);
                const shoulderRoll = mapRange(wrist.x, 0, 1, Math.PI / 4, -Math.PI / 4);

                // Elbow angle (use angle between shoulder, elbow, wrist)
                const leftElbowAngleRad = calculateAngle(shoulder, elbow, wrist);
                const elbowJointAngle = mapRange(leftElbowAngleRad, 0.1, Math.PI - 0.1, Math.PI / 2, 0);

                // Only update if changed
                if (
                    Math.abs(lastLeftValuesRef.current.shoulderRoll - shoulderRoll) > threshold ||
                    Math.abs(lastLeftValuesRef.current.shoulderPitch - shoulderPitch) > threshold ||
                    Math.abs(lastLeftValuesRef.current.elbow - elbowJointAngle) > threshold
                ) {
                    lastLeftValuesRef.current.shoulderRoll = shoulderRoll;
                    lastLeftValuesRef.current.shoulderPitch = shoulderPitch;
                    lastLeftValuesRef.current.elbow = elbowJointAngle;

                    newState['LARM_JOINT0'] = -shoulderRoll;
                    newState['LARM_JOINT1'] = -shoulderPitch;
                    newState['LARM_JOINT4'] = -elbowJointAngle;
                }
            }

            // --- Right arm control (shoulder, elbow) ---
            if (rightHandLandmarks && poseLandmarks?.[12] && poseLandmarks?.[14]) {
                const wrist = rightHandLandmarks[0];
                const elbow = poseLandmarks[14];
                const shoulder = poseLandmarks[12];

                const shoulderPitch = mapRange(wrist.y, 0, 0.75, Math.PI, -Math.PI / 6);
                const shoulderRoll = mapRange(wrist.x, 0, 1, Math.PI / 4, -Math.PI / 4);

                const rightElbowAngleRad = calculateAngle(shoulder, elbow, wrist);
                const elbowJointAngle = mapRange(rightElbowAngleRad, 0.1, Math.PI - 0.1, Math.PI / 2, 0);

                if (
                    Math.abs(lastRightValuesRef.current.shoulderRoll - shoulderRoll) > threshold ||
                    Math.abs(lastRightValuesRef.current.shoulderPitch - shoulderPitch) > threshold ||
                    Math.abs(lastRightValuesRef.current.elbow - elbowJointAngle) > threshold
                ) {
                    lastRightValuesRef.current.shoulderRoll = shoulderRoll;
                    lastRightValuesRef.current.shoulderPitch = shoulderPitch;
                    lastRightValuesRef.current.elbow = elbowJointAngle;

                    newState['RARM_JOINT0'] = -shoulderRoll;
                    newState['RARM_JOINT1'] = -shoulderPitch;
                    newState['RARM_JOINT4'] = -elbowJointAngle;
                }
            }

            // Only update if there are changes
            if (Object.keys(newState).length > 0) {
                setRobotJointStates(prev => ({
                    ...prev,
                    ...newState
                }));
            }
        } catch (error) {
            console.error('Error in ArmController:', error);
        }
    }, [leftHandLandmarks, rightHandLandmarks, poseLandmarks, loadedRobotInstanceRef, setRobotJointStates, mapRange]);

    useEffect(() => {
        updateArmControls();
    }, [leftHandLandmarks, rightHandLandmarks, poseLandmarks]); // Only depend on landmarks

    return null;
};

export default ArmController;