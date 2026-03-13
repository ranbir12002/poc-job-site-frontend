import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowLeft, Layers, Box, Grid3X3, Maximize2, RotateCcw, Ruler, Settings2, Sliders } from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { LidarScan } from '../types';

interface ScanViewerProps {
  scan: LidarScan;
  onClose: () => void;
}

type ViewMode = 'pointcloud' | 'mesh' | 'wireframe';

export function ScanViewer({ scan, onClose }: ScanViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const meshRef = useRef<THREE.Object3D | null>(null);
  
  const [viewMode, setViewMode] = useState<ViewMode>('pointcloud');
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [clickDepth, setClickDepth] = useState<{ x: number; y: number; depth: number; pos: THREE.Vector3 } | null>(null);
  const [stats, setStats] = useState({ vertices: 0, faces: 0, surfaceArea: 0, volume: 0 });
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<THREE.Vector3[]>([]);
  const [measureDistance, setMeasureDistance] = useState<number | null>(null);
  const [measureUnit, setMeasureUnit] = useState<'m' | 'cm' | 'mm'>('m');
  const [fileUnit, setFileUnit] = useState<'m' | 'cm' | 'mm'>('m');
  const [calibrationMultiplier, setCalibrationMultiplier] = useState(1.0);
  const [showCalibration, setShowCalibration] = useState(false);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);
    scene.fog = new THREE.FogExp2(0x0a0a0f, 0.002);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 1000);
    camera.position.set(5, 5, 5);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    controls.minDistance = 0.1;
    controls.maxDistance = 200;
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404060, 1.5);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);
    
    const fillLight = new THREE.DirectionalLight(0x6366f1, 0.5);
    fillLight.position.set(-10, 5, -10);
    scene.add(fillLight);

    // Grid helper
    const gridHelper = new THREE.GridHelper(50, 50, 0x1a1a2e, 0x1a1a2e);
    scene.add(gridHelper);

    // Axes helper
    const axesHelper = new THREE.AxesHelper(3);
    scene.add(axesHelper);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Load the 3D scan
  useEffect(() => {
    if (!sceneRef.current || !cameraRef.current || !controlsRef.current) return;

    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    setLoading(true);
    setLoadProgress(0);

    // Remove previous mesh
    if (meshRef.current) {
      scene.remove(meshRef.current);
      meshRef.current = null;
    }

    const onProgress = (event: ProgressEvent) => {
      if (event.lengthComputable) {
        setLoadProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    const calculateSurfaceArea = (geometry: THREE.BufferGeometry) => {
      let area = 0;
      const pos = geometry.attributes.position;
      const index = geometry.index;
      const vA = new THREE.Vector3();
      const vB = new THREE.Vector3();
      const vC = new THREE.Vector3();

      if (index) {
        for (let i = 0; i < index.count; i += 3) {
          vA.fromBufferAttribute(pos, index.getX(i));
          vB.fromBufferAttribute(pos, index.getX(i + 1));
          vC.fromBufferAttribute(pos, index.getX(i + 2));
          area += new THREE.Triangle(vA, vB, vC).getArea();
        }
      } else {
        for (let i = 0; i < pos.count; i += 3) {
          vA.fromBufferAttribute(pos, i);
          vB.fromBufferAttribute(pos, i + 1);
          vC.fromBufferAttribute(pos, i + 2);
          area += new THREE.Triangle(vA, vB, vC).getArea();
        }
      }
      return area;
    };

    const calculateVolume = (geometry: THREE.BufferGeometry) => {
      let volume = 0;
      const pos = geometry.attributes.position;
      const index = geometry.index;
      const vA = new THREE.Vector3();
      const vB = new THREE.Vector3();
      const vC = new THREE.Vector3();

      const signedVolumeOfTetrahedron = (p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3) => {
        return p1.dot(p2.cross(p3)) / 6.0;
      };

      if (index) {
        for (let i = 0; i < index.count; i += 3) {
          vA.fromBufferAttribute(pos, index.getX(i));
          vB.fromBufferAttribute(pos, index.getX(i + 1));
          vC.fromBufferAttribute(pos, index.getX(i + 2));
          volume += signedVolumeOfTetrahedron(vA, vB, vC);
        }
      } else {
        for (let i = 0; i < pos.count; i += 3) {
          vA.fromBufferAttribute(pos, i);
          vB.fromBufferAttribute(pos, i + 1);
          vC.fromBufferAttribute(pos, i + 2);
          volume += signedVolumeOfTetrahedron(vA, vB, vC);
        }
      }
      return Math.abs(volume);
    };

    const setupObject = (geometry: THREE.BufferGeometry | null, object: THREE.Object3D | null) => {
      let target: THREE.Object3D;

      if (geometry) {
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
        geometry.computeBoundingBox();

        const vertexCount = geometry.attributes.position?.count || 0;
        const faceCount = geometry.index ? geometry.index.count / 3 : 0;
        const hasColors = !!geometry.attributes.color;

        const surfaceArea = calculateSurfaceArea(geometry);
        const volume = calculateVolume(geometry);

        setStats({ vertices: vertexCount, faces: faceCount, surfaceArea, volume });

        if (viewMode === 'pointcloud') {
          const material = new THREE.PointsMaterial({
            size: 0.02,
            vertexColors: hasColors,
            sizeAttenuation: true,
            color: hasColors ? undefined : 0x6366f1,
          });
          target = new THREE.Points(geometry, material);
        } else {
          const material = new THREE.MeshStandardMaterial({
            vertexColors: hasColors,
            color: hasColors ? undefined : 0x6366f1,
            roughness: 0.6,
            metalness: 0.1,
            wireframe: viewMode === 'wireframe',
            side: THREE.DoubleSide,
          });
          target = new THREE.Mesh(geometry, material);
        }
      } else if (object) {
        target = object;
        let vCount = 0;
        let fCount = 0;
        let totalArea = 0;
        let totalVol = 0;
        object.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const g = child.geometry as THREE.BufferGeometry;
            vCount += g.attributes.position?.count || 0;
            const fc = g.index ? g.index.count / 3 : 0;
            fCount += fc;
            totalArea += calculateSurfaceArea(g);
            totalVol += calculateVolume(g);
            if (viewMode === 'wireframe') {
              (child.material as THREE.MeshStandardMaterial).wireframe = true;
            }
          }
        });
        setStats({ vertices: vCount, faces: fCount, surfaceArea: totalArea, volume: totalVol });
      } else {
        return;
      }

      // Center and scale
      const box = new THREE.Box3().setFromObject(target);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      
      // Scale to fit nicely in view
      const scale = 10 / maxDim;
      target.scale.setScalar(scale);
      target.position.sub(center.multiplyScalar(scale));

      scene.add(target);
      meshRef.current = target;

      // Point camera at the object
      const scaledBox = new THREE.Box3().setFromObject(target);
      const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
      const scaledSize = scaledBox.getSize(new THREE.Vector3());
      const maxScaledDim = Math.max(scaledSize.x, scaledSize.y, scaledSize.z);

      camera.position.set(
        scaledCenter.x + maxScaledDim,
        scaledCenter.y + maxScaledDim * 0.8,
        scaledCenter.z + maxScaledDim
      );
      controls.target.copy(scaledCenter);
      controls.update();

      setLoading(false);
    };

    const ext = scan.format || scan.filename.split('.').pop()?.toLowerCase();

    if (ext === 'ply') {
      const loader = new PLYLoader();
      loader.load(scan.fileUrl, (geometry) => {
        setupObject(geometry, null);
      }, onProgress, (error) => {
        console.error('PLY load error:', error);
        setLoading(false);
      });
    } else if (ext === 'obj') {
      const loader = new OBJLoader();
      loader.load(scan.fileUrl, (object) => {
        setupObject(null, object);
      }, onProgress, (error) => {
        console.error('OBJ load error:', error);
        setLoading(false);
      });
    } else {
      console.error('Unsupported format:', ext);
      setLoading(false);
    }
  }, [scan, viewMode]);

  // Click handler for depth measurement
  const handleClick = useCallback((event: React.MouseEvent) => {
    if (!containerRef.current || !cameraRef.current || !sceneRef.current || !meshRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);

    const intersects = raycasterRef.current.intersectObject(meshRef.current, true);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const point = hit.point;

      if (measureMode) {
        const newPoints = [...measurePoints, point.clone()];
        setMeasurePoints(newPoints);
        
        if (newPoints.length === 2) {
          const dist = newPoints[0].distanceTo(newPoints[1]);
          
          // 1. Calculate base distance in scene units
          const normalizationScale = meshRef.current.scale.x;
          let distanceInMeters = dist / normalizationScale;
          
          // 2. Adjust based on Source Units (File Units)
          // If file was in mm, 1 unit = 0.001m. If file was in cm, 1 unit = 0.01m.
          if (fileUnit === 'cm') distanceInMeters *= 0.01;
          if (fileUnit === 'mm') distanceInMeters *= 0.001;
          
          // 3. Apply Manual Calibration Multiplier
          let finalDistance = distanceInMeters * calibrationMultiplier;
          
          // 4. Convert to Display Units
          if (measureUnit === 'cm') finalDistance *= 100;
          if (measureUnit === 'mm') finalDistance *= 1000;
          
          setMeasureDistance(finalDistance);
          // Auto-reset after a short delay
          setTimeout(() => {
            setMeasurePoints([]);
            setMeasureDistance(null);
          }, 8000);
        }
        return;
      }

      // Calculate real-world depth (Z coordinate mapped to metric)
      const depthRange = scan.depthRange;
      const bbox = scan.boundingBox;
      const realDepthRange = depthRange.max - depthRange.min;
      
      // Map the Y coordinate (usually up in most scan exports) to real depth
      const objectBox = new THREE.Box3().setFromObject(meshRef.current);
      const normalizedY = (point.y - objectBox.min.y) / (objectBox.max.y - objectBox.min.y);
      const estimatedDepth = depthRange.min + normalizedY * realDepthRange;

      setClickDepth({
        x: event.clientX,
        y: event.clientY,
        depth: Math.abs(estimatedDepth),
        pos: point,
      });

      // Auto-hide after 3 seconds
      setTimeout(() => setClickDepth(null), 3000);
    }
  }, [scan, measureMode, measurePoints]);

  const resetView = () => {
    if (cameraRef.current && controlsRef.current && meshRef.current) {
      const box = new THREE.Box3().setFromObject(meshRef.current);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      cameraRef.current.position.set(
        center.x + maxDim, center.y + maxDim * 0.8, center.z + maxDim
      );
      controlsRef.current.target.copy(center);
      controlsRef.current.update();
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-[#0a0a0f] animate-in fade-in duration-500 rounded-[inherit] overflow-hidden">
      {/* Three.js Canvas */}
      <div
        ref={containerRef}
        className="w-full h-full"
        onClick={handleClick}
        style={{ cursor: measureMode ? 'crosshair' : 'grab' }}
      />

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-30">
          <div className="w-20 h-20 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin mb-6" />
          <p className="text-white font-medium text-lg">Loading 3D Scan...</p>
          <div className="w-48 h-2 bg-white/10 rounded-full mt-4 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300" 
              style={{ width: `${loadProgress}%` }}
            />
          </div>
          <p className="text-white/40 text-sm mt-2">{loadProgress}%</p>
        </div>
      )}

      {/* Back Button */}
      <button
        onClick={onClose}
        className="absolute top-6 left-6 p-3 bg-black/40 hover:bg-black/60 text-white rounded-2xl backdrop-blur-xl border border-white/10 transition-all shadow-2xl z-20"
      >
        <ArrowLeft size={20} />
      </button>

      {/* View Mode Toggle */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
        <div
          className="flex items-center rounded-2xl p-1 gap-0.5"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
            backdropFilter: 'blur(40px) saturate(1.6)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
          }}
        >
          {([
            { mode: 'pointcloud' as ViewMode, icon: Layers, label: 'Points' },
            { mode: 'mesh' as ViewMode, icon: Box, label: 'Mesh' },
            { mode: 'wireframe' as ViewMode, icon: Grid3X3, label: 'Wire' },
          ]).map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                viewMode === mode
                  ? 'bg-indigo-500/30 text-indigo-200 shadow-lg border border-indigo-500/20'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Top Right Toolbar */}
      <div className="absolute top-6 right-6 z-20 flex gap-2">
        <button
          onClick={() => { setMeasureMode(!measureMode); setMeasurePoints([]); setMeasureDistance(null); }}
          className={`p-3 rounded-2xl backdrop-blur-xl border transition-all shadow-2xl ${
            measureMode 
              ? 'bg-indigo-500/30 border-indigo-500/30 text-indigo-300' 
              : 'bg-black/40 hover:bg-black/60 border-white/10 text-white'
          }`}
          title="Measure Distance"
        >
          <Ruler size={20} />
        </button>
        <button
          onClick={resetView}
          className="p-3 bg-black/40 hover:bg-black/60 text-white rounded-2xl backdrop-blur-xl border border-white/10 transition-all shadow-2xl"
          title="Reset View"
        >
          <RotateCcw size={20} />
        </button>
        <button
          onClick={() => setShowCalibration(!showCalibration)}
          className={`p-3 rounded-2xl backdrop-blur-xl border transition-all shadow-2xl ${
            showCalibration 
              ? 'bg-indigo-500/30 border-indigo-500/30 text-indigo-300' 
              : 'bg-black/40 hover:bg-black/60 border-white/10 text-white'
          }`}
          title="Calibration Settings"
        >
          <Settings2 size={20} />
        </button>
        <button
          onClick={() => {
            if (containerRef.current) {
              containerRef.current.requestFullscreen?.();
            }
          }}
          className="p-3 bg-black/40 hover:bg-black/60 text-white rounded-2xl backdrop-blur-xl border border-white/10 transition-all shadow-2xl"
          title="Fullscreen"
        >
          <Maximize2 size={20} />
        </button>
      </div>

      {/* Calibration Panel */}
      {showCalibration && (
        <div className="absolute top-20 right-6 z-20 w-64">
          <div className="rounded-2xl backdrop-blur-3xl border border-white/10 shadow-2xl p-5 bg-black/60">
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              Calibration
            </h3>
            
            <div className="space-y-4">
              {/* Source Unit Selection */}
              <div className="space-y-2">
                <label className="text-[10px] text-white/40 uppercase font-bold">File Units (Source)</label>
                <div className="flex bg-white/5 rounded-xl p-1 gap-1">
                  {(['m', 'cm', 'mm'] as const).map((unit) => (
                    <button
                      key={`file-${unit}`}
                      onClick={() => setFileUnit(unit)}
                      className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-bold transition-all ${
                        fileUnit === unit 
                          ? 'bg-amber-500/80 text-white' 
                          : 'text-white/40 hover:text-white/60'
                      }`}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-white/30 italic">What unit was the model exported in?</p>
              </div>

              {/* Display Unit Selection */}
              <div className="space-y-2 pt-2 border-t border-white/5">
                <label className="text-[10px] text-white/40 uppercase font-bold">Display Units</label>
                <div className="flex bg-white/5 rounded-xl p-1 gap-1">
                  {(['m', 'cm', 'mm'] as const).map((unit) => (
                    <button
                      key={`display-${unit}`}
                      onClick={() => setMeasureUnit(unit)}
                      className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-bold transition-all ${
                        measureUnit === unit 
                          ? 'bg-indigo-500 text-white' 
                          : 'text-white/40 hover:text-white/60'
                      }`}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
              </div>

              {/* Multiplier Slider */}
              <div className="space-y-2 pt-2 border-t border-white/5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-white/40 uppercase font-bold">Scale Adjust</label>
                  <span className="text-xs font-mono text-indigo-400">{calibrationMultiplier.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="5.0"
                  step="0.05"
                  value={calibrationMultiplier}
                  onChange={(e) => setCalibrationMultiplier(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-indigo-500"
                />
                <div className="flex justify-between text-[10px] text-white/20 font-bold">
                  <span>0.1x</span>
                  <span onClick={() => setCalibrationMultiplier(1.0)} className="hover:text-white/40 cursor-pointer">Reset (1x)</span>
                  <span>5.0x</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Panel */}
      <div className="absolute bottom-6 left-6 z-20">
        <div
          className="rounded-2xl overflow-hidden backdrop-blur-3xl border border-white/10 shadow-2xl p-5"
          style={{
            background: 'linear-gradient(135deg, rgba(20,20,30,0.7) 0%, rgba(10,10,15,0.8) 100%)',
          }}
        >
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            Scan Info
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between gap-8">
              <span className="text-xs text-white/40">Vertices</span>
              <span className="text-sm font-semibold text-white tabular-nums">{stats.vertices.toLocaleString()}</span>
            </div>
            {stats.faces > 0 && (
              <div className="flex justify-between gap-8">
                <span className="text-xs text-white/40">Faces</span>
                <span className="text-sm font-semibold text-white tabular-nums">{stats.faces.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between gap-8">
              <span className="text-xs text-white/40">Format</span>
              <span className="text-sm font-semibold text-white uppercase">{scan.format}</span>
            </div>
            <div className="h-px bg-white/5 my-1" />
            {stats.surfaceArea > 0 && (
              <div className="flex justify-between gap-8">
                <span className="text-xs text-white/40">Surface Area</span>
                <span className="text-sm font-semibold text-white tabular-nums">{stats.surfaceArea.toFixed(2)} m²</span>
              </div>
            )}
            {stats.volume > 0 && (
              <div className="flex justify-between gap-8">
                <span className="text-xs text-white/40">Volume</span>
                <span className="text-sm font-semibold text-white tabular-nums">{stats.volume.toFixed(2)} m³</span>
              </div>
            )}
            <div className="h-px bg-white/5 my-1" />
            <div className="flex justify-between gap-8">
              <span className="text-xs text-white/40">Depth Range</span>
              <span className="text-sm font-semibold text-white tabular-nums">
                {scan.depthRange.min.toFixed(1)}m – {scan.depthRange.max.toFixed(1)}m
              </span>
            </div>
            <div className="flex justify-between gap-8">
              <span className="text-xs text-white/40">Dimensions</span>
              <span className="text-xs font-medium text-white/70 tabular-nums">
                {(scan.boundingBox.maxX - scan.boundingBox.minX).toFixed(1)} × {(scan.boundingBox.maxY - scan.boundingBox.minY).toFixed(1)} × {(scan.boundingBox.maxZ - scan.boundingBox.minZ).toFixed(1)}m
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Measure Mode Indicator */}
      {measureMode && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-indigo-500/20 backdrop-blur-xl border border-indigo-500/30 text-indigo-200 px-5 py-2.5 rounded-2xl text-sm font-medium flex items-center gap-2">
            <Ruler size={16} />
            {measurePoints.length === 0 
              ? 'Click first point' 
              : measurePoints.length === 1 
                ? 'Click second point'
                : `Distance: ${measureDistance?.toFixed(measureUnit === 'm' ? 3 : 1)}${measureUnit}`}
          </div>
        </div>
      )}

      {/* Depth Click Tooltip */}
      {clickDepth && !measureMode && (
        <div
          className="absolute z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full pb-4"
          style={{ left: clickDepth.x, top: clickDepth.y }}
        >
          <div className="bg-black/80 backdrop-blur-xl border border-white/20 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 animate-in zoom-in-95 duration-200">
            <Layers size={16} className="text-indigo-400" />
            <div className="flex flex-col">
              <span className="text-[10px] text-white/50 leading-none uppercase tracking-wider">LiDAR Depth</span>
              <span className="text-lg font-bold leading-tight tabular-nums">{clickDepth.depth.toFixed(3)}m</span>
            </div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-black/80" />
          </div>
        </div>
      )}
    </div>
  );
}
