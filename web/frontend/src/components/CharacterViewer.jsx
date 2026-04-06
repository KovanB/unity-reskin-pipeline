import { Suspense, useRef, useEffect, useState, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

function Character({ url }) {
  const { scene, animations } = useGLTF(url);
  const mixerRef = useRef(null);

  // Clone the scene so React Three Fiber doesn't complain about reuse
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  // Play idle animation if available
  useEffect(() => {
    if (animations.length > 0) {
      const mixer = new THREE.AnimationMixer(clonedScene);
      const clip = animations.find(a => a.name === "Survey") || animations[0];
      const action = mixer.clipAction(clip);
      action.play();
      mixerRef.current = mixer;
      return () => mixer.stopAllAction();
    }
  }, [animations, clonedScene]);

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
  });

  return (
    <primitive
      object={clonedScene}
      scale={1.2}
      position={[0, -1.1, 0]}
    />
  );
}

function Turntable({ children }) {
  const groupRef = useRef();
  const [autoRotate, setAutoRotate] = useState(true);

  useFrame((_, delta) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <group ref={groupRef} onPointerDown={() => setAutoRotate(false)}>
      {children}
    </group>
  );
}

export default function CharacterViewer({ modelUrl }) {
  // Force re-mount when model URL changes by using it as a key
  const [currentUrl, setCurrentUrl] = useState(modelUrl);

  useEffect(() => {
    // Clear cache for old model and load new one
    if (modelUrl !== currentUrl) {
      useGLTF.preload(modelUrl);
      setCurrentUrl(modelUrl);
    }
  }, [modelUrl]);

  return (
    <Canvas
      camera={{ position: [0, 0.5, 3], fov: 45 }}
      shadows
      style={{ background: "linear-gradient(180deg, #12121a 0%, #08080d 100%)" }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
      <directionalLight position={[-3, 3, -3]} intensity={0.3} color="#7c5cfc" />
      <pointLight position={[0, 3, 0]} intensity={0.5} color="#00d4aa" />

      <Suspense fallback={null}>
        <Turntable>
          <Character key={currentUrl} url={currentUrl} />
        </Turntable>

        {/* Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.1, 0]} receiveShadow>
          <circleGeometry args={[3, 64]} />
          <meshStandardMaterial color="#111118" roughness={0.8} />
        </mesh>
      </Suspense>

      <OrbitControls
        enablePan={false}
        minDistance={1.5}
        maxDistance={6}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2}
        target={[0, 0, 0]}
      />

      <fog attach="fog" args={["#08080d", 5, 12]} />
    </Canvas>
  );
}
