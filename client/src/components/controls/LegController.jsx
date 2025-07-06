// src/components/controls/LegController.jsx
import { useCallback, useEffect, useRef } from 'react';

// Utility for angle calculation (same as ArmController)
const calculateAngle = (a, b, c) => {
    if (!a || !b || !c) return 0;
    const rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(rad);
    if (angle > Math.PI) {
        angle = 2 * Math.PI - angle;
    }
    return angle;
};

const LegController = ({ 
    poseLandmarks, 
    loadedRobotInstanceRef, 
    setRobotJointStates,
    mapRange 
}) => {
    const lastValuesRef = useRef({});

    const updateLegControl = useCallback(() => {
        if (!poseLandmarks || !loadedRobotInstanceRef?.current || typeof setRobotJointStates !== 'function') {
            return;
        }

        try {
            // Left leg landmarks
            const leftHip = poseLandmarks[23];
            const leftKnee = poseLandmarks[25];
            const leftAnkle = poseLandmarks[27];

            // Right leg landmarks
            const rightHip = poseLandmarks[24];
            const rightKnee = poseLandmarks[26];
            const rightAnkle = poseLandmarks[28];

            const newState = {};
            const threshold = 0.01;

            // --- Left leg ---
            if (leftHip && leftKnee && leftAnkle) {
                // Hip pitch (thigh forward/back)
                const hipPitch = calculateAngle(leftKnee, leftHip, poseLandmarks[11]); // 11: left shoulder
                // Knee angle (bend)
                const kneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
                // Ankle pitch (foot up/down)
                const anklePitch = calculateAngle(leftKnee, leftAnkle, poseLandmarks[31]); // 31: left foot index

                // Map angles to robot joint ranges
                const lleg1 = mapRange(hipPitch, 0, Math.PI, -Math.PI/3, Math.PI/3); // Hip pitch
                const lleg3 = mapRange(kneeAngle, 0, Math.PI, 0, Math.PI/2);         // Knee
                const lleg4 = mapRange(anklePitch, 0, Math.PI, -Math.PI/6, Math.PI/6); // Ankle

                if (
                    Math.abs(lastValuesRef.current.lleg1 - lleg1) > threshold ||
                    Math.abs(lastValuesRef.current.lleg3 - lleg3) > threshold ||
                    Math.abs(lastValuesRef.current.lleg4 - lleg4) > threshold
                ) {
                    lastValuesRef.current.lleg1 = lleg1;
                    lastValuesRef.current.lleg3 = lleg3;
                    lastValuesRef.current.lleg4 = lleg4;

                    newState['lleg_joint0'] = 0;
                    newState['lleg_joint1'] = lleg1;
                    newState['lleg_joint2'] = 0;
                    newState['lleg_joint3'] = lleg3;
                    newState['lleg_joint4'] = lleg4;
                    newState['lleg_joint5'] = 0;
                }
            }

            // --- Right leg ---
            if (rightHip && rightKnee && rightAnkle) {
                const hipPitch = calculateAngle(rightKnee, rightHip, poseLandmarks[12]); // 12: right shoulder
                const kneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
                const anklePitch = calculateAngle(rightKnee, rightAnkle, poseLandmarks[32]); // 32: right foot index

                const rleg1 = mapRange(hipPitch, 0, Math.PI, -Math.PI/3, Math.PI/3);
                const rleg3 = mapRange(kneeAngle, 0, Math.PI, 0, Math.PI/2);
                const rleg4 = mapRange(anklePitch, 0, Math.PI, -Math.PI/6, Math.PI/6);

                if (
                    Math.abs(lastValuesRef.current.rleg1 - rleg1) > threshold ||
                    Math.abs(lastValuesRef.current.rleg3 - rleg3) > threshold ||
                    Math.abs(lastValuesRef.current.rleg4 - rleg4) > threshold
                ) {
                    lastValuesRef.current.rleg1 = rleg1;
                    lastValuesRef.current.rleg3 = rleg3;
                    lastValuesRef.current.rleg4 = rleg4;

                    newState['rleg_joint0'] = 0;
                    newState['rleg_joint1'] = rleg1;
                    newState['rleg_joint2'] = 0;
                    newState['rleg_joint3'] = rleg3;
                    newState['rleg_joint4'] = rleg4;
                    newState['rleg_joint5'] = 0;
                }
            }

            if (Object.keys(newState).length > 0) {
                setRobotJointStates(prev => ({
                    ...prev,
                    ...newState
                }));
            }
        } catch (error) {
            console.error('Error in LegController:', error);
        }
    }, [poseLandmarks, loadedRobotInstanceRef, setRobotJointStates, mapRange]);

    useEffect(() => {
        updateLegControl();
    }, [poseLandmarks, updateLegControl]);

    return null;
};

export default LegController;