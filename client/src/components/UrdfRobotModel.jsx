// src/components/UrdfRobotModel.jsx
import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { useLoader, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import URDFLoader from 'urdf-loader';
import * as THREE from 'three';
import { LoadingManager, FileLoader } from 'three';

const CameraUpdater = ({ loadedRobotInstanceRef, triggerUpdate }) => {
    const { camera } = useThree();
    const orbitControlsRef = useRef();

    useEffect(() => {
        const robot = loadedRobotInstanceRef.current;
        if (robot && orbitControlsRef.current) {
            const box = new THREE.Box3().setFromObject(robot);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());

            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = camera.fov * (Math.PI / 180);
            let cameraDistance = maxDim / (2 * Math.tan(fov / 2));
            cameraDistance *= 2.2;

            camera.position.set(
                center.x + cameraDistance * 0.7,
                center.y + size.y * 0.8,
                center.z + cameraDistance * 0.8
            );
            camera.lookAt(center);

            orbitControlsRef.current.target.copy(center);
            orbitControlsRef.current.update();

            camera.far = cameraDistance * 4;
            camera.near = 0.01;
            camera.updateProjectionMatrix();
        }
    }, [triggerUpdate, camera, loadedRobotInstanceRef]);

    return (
        <OrbitControls
            ref={orbitControlsRef}
            enableDamping={true}
            dampingFactor={0.05}
            minDistance={0.5}
            maxDistance={20}
        />
    );
};

const fixMaterialIssues = (object) => {
    object.traverse((child) => {
        if (child.isMesh) {
            if (child.geometry) {
                if (!child.geometry.attributes.normal) {
                    child.geometry.computeVertexNormals();
                }
                
                if (child.geometry.index) {
                    const indices = child.geometry.index;
                    for (let i = 0; i < indices.count; i += 3) {
                        const a = indices.getX(i);
                        const b = indices.getX(i + 1);
                        const c = indices.getX(i + 2);
                        
                        if (a === b || b === c || a === c) {
                            indices.setX(i, 0);
                            indices.setX(i + 1, 1);
                            indices.setX(i + 2, 2);
                        }
                    }
                }
            }
            
            if (child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                
                materials.forEach((material) => {
                    material.transparent = material.opacity < 1.0;
                    material.depthTest = true;
                    material.depthWrite = !material.transparent;
                    
                    if (material.opacity === undefined || material.opacity === null || material.opacity === 0) {
                        material.opacity = 1.0;
                        material.transparent = false;
                    }
                    
                    if (material.side === undefined) {
                        material.side = THREE.FrontSide;
                    }
                    
                    material.alphaTest = material.transparent ? 0.1 : 0;
                    
                    if (material.map) {
                        material.map.colorSpace = THREE.SRGBColorSpace;
                    }
                });
            }
        }
    });
};

const applyRobotOrientation = (robot, selectedRobotName, scale, initialPosition) => {    
    robot.rotation.set(0, 0, 0);
    robot.position.set(0, 0, 0);
    robot.scale.set(1, 1, 1);

    const initialBox = new THREE.Box3().setFromObject(robot);
    const initialSize = initialBox.getSize(new THREE.Vector3());
    const initialCenter = initialBox.getCenter(new THREE.Vector3());

    if (selectedRobotName === 'jaxon_jvrc') {
        robot.scale.set(scale * 0.001, scale * 0.001, scale * 0.001);
    } else if (selectedRobotName === 'hexapod_robot' || selectedRobotName === 'trial') {
        robot.scale.set(scale, scale, scale);
    } else {
        const maxSize = Math.max(initialSize.x, initialSize.y, initialSize.z);
        
        if (initialSize.z > initialSize.y && initialSize.z === maxSize) {
            robot.rotation.x = -Math.PI / 2;
        } else if (initialSize.x > initialSize.y && initialSize.x === maxSize) {
            robot.rotation.z = Math.PI / 2;
        }
        
        robot.scale.set(scale, scale, scale);
    }

    const finalBox = new THREE.Box3().setFromObject(robot);
    const groundOffset = -finalBox.min.y;
    robot.position.set(
        initialPosition[0],
        initialPosition[1] + groundOffset,
        initialPosition[2]
    );
};

const UrdfRobotModel = ({
    urdfContent,
    fileMap,
    jointStates = {},
    selectedRobotName = 'hexapod_robot',
    onRobotLoaded,
    onRobotError,
    initialPosition = [0, 0, 0],
    scale = 1.0
}) => {
    const robotRef = useRef(null);
    const hasLoadedRef = useRef(false);
    const [robotReady, setRobotReady] = useState(false);

    const loaderConfig = useCallback((loader) => {
        const customLoadingManager = new LoadingManager();
        const customFileLoader = new FileLoader(customLoadingManager);
        customFileLoader.setResponseType('arraybuffer');
        customLoadingManager.addHandler('file', customFileLoader);
        loader.manager = customLoadingManager;

        loader.manager.setURLModifier((url) => {
            const getFilename = (url) => {
                try {
                    return url.split('/').pop().split('\\').pop();
                } catch (e) {
                    return url;
                }
            };

            const filename = getFilename(url);
            const normalizedFilename = filename.toLowerCase();

            if (fileMap) {
                if (fileMap[filename]) {
                    return fileMap[filename];
                }

                for (const key in fileMap) {
                    if (key.toLowerCase() === normalizedFilename) {
                        return fileMap[key];
                    }
                }

                const baseFilename = filename.split('.')[0];
                if (baseFilename && fileMap[baseFilename]) {
                    return fileMap[baseFilename];
                }
            }

            return url;
        });

        loader.parseVisual = true;
        loader.parseCollision = false;
        loader.workingPath = "/";
    }, [fileMap]);

    const robotLoadedInstance = useLoader(URDFLoader, urdfContent, loaderConfig);

    const handleRobotSetup = useCallback((robot) => {
        if (hasLoadedRef.current) return;
        hasLoadedRef.current = true;

        robotRef.current = robot;

        try {
            fixMaterialIssues(robot);
            applyRobotOrientation(robot, selectedRobotName, scale, initialPosition);
            setRobotReady(true);

            if (onRobotLoaded) {
                onRobotLoaded(robot);
            }
        } catch (error) {
            console.error("[UrdfRobotModel] Error setting up robot:", error);
            if (onRobotError) {
                onRobotError(error);
            }
        }
    }, [selectedRobotName, scale, initialPosition, onRobotLoaded, onRobotError]);

    useEffect(() => {
        if (robotLoadedInstance && !hasLoadedRef.current) {
            handleRobotSetup(robotLoadedInstance);
        }
    }, [robotLoadedInstance, handleRobotSetup]);

    useEffect(() => {
        const robot = robotRef.current;
        if (!robot || !robotReady || !jointStates || Object.keys(jointStates).length === 0) {
            return;
        }

        for (const jointName in jointStates) {
            if (jointName !== 'cmd' && jointName !== 'timestamp') {
                const targetAngle = jointStates[jointName];
                const urdfJoint = robot.joints[jointName];
                if (urdfJoint && typeof targetAngle === 'number' && !isNaN(targetAngle)) {
                    if (Math.abs(urdfJoint.angle - targetAngle) > 0.001) {
                        urdfJoint.setJointValue(targetAngle);
                    }
                }
            }
        }
    }, [jointStates, robotReady]);

    useEffect(() => {
        return () => {
            hasLoadedRef.current = false;
            setRobotReady(false);
        };
    }, []);

    if (!robotLoadedInstance) {
        return null;
    }

    return <primitive object={robotLoadedInstance} />;
};

export { UrdfRobotModel, CameraUpdater };