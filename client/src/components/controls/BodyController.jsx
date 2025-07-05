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
  setRobotJointStates,
  controlSource = "camera",
}) => {
  const mapRange = useCallback((value, inMin, inMax, outMin, outMax) => {
    const clampedValue = Math.max(inMin, Math.min(value, inMax));
    return (
      ((clampedValue - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin
    );
  }, []);

  // Update the robot joint states using the state setter
  const updateRobotJointStates = useCallback(
    (newJointStates) => {
      if (!setRobotJointStates) return;
      if (typeof newJointStates === "function") {
        setRobotJointStates(newJointStates);
      } else {
        setRobotJointStates((prev) => ({ ...prev, ...newJointStates }));
      }
    },
    [setRobotJointStates],
  );

  // Enhanced error checking
  useEffect(() => {
    if (!setRobotJointStates) {
      return;
    }

    if (!loadedRobotInstanceRef) {
      return;
    }
  }, [setRobotJointStates, loadedRobotInstanceRef]);

  if (!setRobotJointStates) {
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
  setRobotJointStates: null,
};

export default BodyController;
