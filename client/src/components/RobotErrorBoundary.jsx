// src/components/RobotErrorBoundary.jsx
import React from 'react';
import { Text } from '@react-three/drei';

class RobotErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[RobotErrorBoundary] Robot loading error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    resetError = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        if (this.props.onReset) {
            this.props.onReset();
        }
    };

    render() {
        if (this.state.hasError) {
            return (
                <group>
                    <Text
                        position={[0, 0.5, 0]}
                        fontSize={0.3}
                        color="red"
                        anchorX="center"
                        anchorY="middle"
                    >
                        Error loading robot
                    </Text>
                    <Text
                        position={[0, 0, 0]}
                        fontSize={0.2}
                        color="orange"
                        anchorX="center"
                        anchorY="middle"
                        maxWidth={3}
                        lineHeight={1}
                    >
                        {this.state.error?.message || 'Unknown error occurred'}
                    </Text>
                    <Text
                        position={[0, -0.5, 0]}
                        fontSize={0.15}
                        color="yellow"
                        anchorX="center"
                        anchorY="middle"
                        maxWidth={3}
                        lineHeight={1}
                    >
                        Try reloading the files or check console for details
                    </Text>
                    {/* Optional: Add a clickable reset button in 3D space */}
                    <mesh 
                        position={[0, -1, 0]} 
                        onClick={this.resetError}
                        onPointerOver={() => document.body.style.cursor = 'pointer'}
                        onPointerOut={() => document.body.style.cursor = 'default'}
                    >
                        <boxGeometry args={[1, 0.2, 0.1]} />
                        <meshStandardMaterial color="cyan" />
                    </mesh>
                    <Text
                        position={[0, -1, 0.06]}
                        fontSize={0.1}
                        color="black"
                        anchorX="center"
                        anchorY="middle"
                    >
                        Click to Retry
                    </Text>
                </group>
            );
        }

        return this.props.children;
    }
}

export default RobotErrorBoundary;