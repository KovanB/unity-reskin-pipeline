import { Suspense, useRef, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment } from "@react-three/drei";
import * as THREE from "three";

function Character({ textureUrl }) {
  const { scene } = useGLTF("/models/character.glb");
  const mixerRef = useRef(null);
  const [texture, setTexture] = useState(null);

  // Load and play idle animation
  const { animations } = useGLTF("/models/character.glb");
  useEffect(() => {
    if (animations.length > 0) {
      const mixer = new THREE.AnimationMixer(scene);
      // Use "Survey" (idle-like) animation if available, otherwise first
      const clip = animations.find(a => a.name === "Survey") || animations[0];
      const action = mixer.clipAction(clip);
      action.play();
      mixerRef.current = mixer;
      return () => mixer.stopAllAction();
    }
  }, [animations, scene]);

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
  });

  // Load texture when URL changes
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(textureUrl, (tex) => {
      tex.flipY = false; // GLTF textures are flipped
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      setTexture(tex);
    });
  }, [textureUrl]);

  // Apply texture to the model
  useEffect(() => {
    if (!texture) return;
    scene.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.map = texture;
        child.material.needsUpdate = true;
      }
    });
  }, [texture, scene]);

  return (
    <primitive
      object={scene}
      scale={1.2}
      position={[0, -1.1, 0]}
      rotation={[0, 0, 0]}
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

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
      <circleGeometry args={[3, 64]} />
      <meshStandardMaterial color="#111118" roughness={0.8} />
    </mesh>
  );
}

export default function CharacterViewer({ textureUrl }) {
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
          <Character textureUrl={textureUrl} />
        </Turntable>
        <Floor />
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
