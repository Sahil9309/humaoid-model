// src/components/controls/BodyController.jsx
import { useCallback, useEffect } from "react";
import HeadController from "./HeadController";
import ArmController from "./ArmController";
import LegController from "./LegController";

const BodyController = ({
  poseLandmarks,
  leftHandLandmarks,
  rightHandLandmarks,
  loadedRobotInstanceRef,
  robotJointStatesRef,
  controlSource = "camera",
}) => {
  const mapRange = useCallback((value, inMin, inMax, outMin, outMax) => {
    const clampedValue = Math.max(inMin, Math.min(value, inMax));
    return (
      ((clampedValue - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin
    );
  }, []);

  // Directly update the ref, no forceUpdate
  const updateRobotJointStates = useCallback(
    (newJointStates) => {
      if (!robotJointStatesRef || !robotJointStatesRef.current) return;
      if (typeof newJointStates === "function") {
        const currentState = robotJointStatesRef.current || {};
        const updatedState = newJointStates(currentState);
        robotJointStatesRef.current = { ...currentState, ...updatedState };
      } else {
        robotJointStatesRef.current = {
          ...robotJointStatesRef.current,
          ...newJointStates,
        };
      }
    },
    [robotJointStatesRef],
  );

  // Enhanced error checking
  useEffect(() => {
    if (!robotJointStatesRef) {
      return;
    }

    if (!loadedRobotInstanceRef) {
      return;
    }

    // Initialize joint states if not already done
    if (!robotJointStatesRef.current) {
      robotJointStatesRef.current = {};
    }
  }, [robotJointStatesRef, loadedRobotInstanceRef]);

  if (!robotJointStatesRef) {
    return null;
  }

  // Only apply live camera control when controlSource is 'camera' or 'video'
  const shouldApplyLiveControl =
    controlSource === "camera" || controlSource === "video";

  return (
    <>
      {shouldApplyLiveControl && (
        <>
          <HeadController
            poseLandmarks={poseLandmarks}
            loadedRobotInstanceRef={loadedRobotInstanceRef}
            setRobotJointStates={updateRobotJointStates}
            mapRange={mapRange}
          />

          <ArmController
            poseLandmarks={poseLandmarks}
            leftHandLandmarks={leftHandLandmarks}
            rightHandLandmarks={rightHandLandmarks}
            loadedRobotInstanceRef={loadedRobotInstanceRef}
            setRobotJointStates={updateRobotJointStates}
            mapRange={mapRange}
          />

          <LegController
            poseLandmarks={poseLandmarks}
            loadedRobotInstanceRef={loadedRobotInstanceRef}
            setRobotJointStates={updateRobotJointStates}
            mapRange={mapRange}
          />
        </>
      )}
    </>
  );
};

// Add default props to prevent undefined errors
BodyController.defaultProps = {
  poseLandmarks: null,
  leftHandLandmarks: null,
  rightHandLandmarks: null,
  loadedRobotInstanceRef: null,
  robotJointStatesRef: null,
};

export default BodyController;
