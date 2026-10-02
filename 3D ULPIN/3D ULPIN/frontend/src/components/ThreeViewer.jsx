import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Centroid for coordinate projection to 3D scene meters
const CENTER_LAT = 18.5204;
const CENTER_LNG = 73.8567;
const BASE_MSL = 500.0;

function lngLatToMeters(lng, lat) {
  const x = (lng - CENTER_LNG) * 111320.0 * Math.cos((CENTER_LAT * Math.PI) / 180.0);
  const z = -(lat - CENTER_LAT) * 111320.0;  // Invert Z for Three.js coordinate space
  return { x, z };
}

const UNIT_COLORS = {
  apartment: 0x0284c7,         // Sky Blue
  basement: 0xd97706,          // Amber/Brown
  transit_corridor: 0xe11d48,  // Crimson Red
  utility_corridor: 0xf59e0b,  // Amber Yellow
  air_rights: 0x10b981,        // Transparent Emerald
  surface_parcel: 0x64748b,    // Slate
  parking_slot: 0x8b5cf6       // Purple
};

export default function ThreeViewer({
  units = [],
  selectedUnit = null,
  onSelectUnit = () => {},
  topologyErrors = [],
  filterBuilding = 'ALL',
  isolatedFloor = 'ALL',
  showUnderground = true
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const meshesRef = useRef([]);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hoveredUnit, setHoveredUnit] = useState(null);

  // Setup Three.js scene, camera, lights, orbit controls
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d16);
    scene.fog = new THREE.FogExp2(0x090d16, 0.003);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(60, 45, 75);
    camera.lookAt(0, 5, 0);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(80, 120, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x38bdf8, 1.5, 100);
    pointLight.position.set(0, 30, 0);
    scene.add(pointLight);

    // 5. Ground Plane & MSL Datum Grid
    const gridHelper = new THREE.GridHelper(200, 40, 0x38bdf8, 0x1e293b);
    gridHelper.position.y = 0; // Ground Level Z=500 MSL
    scene.add(gridHelper);

    // 6. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 5, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 10;
    controls.maxDistance = 300;
    controls.maxPolarAngle = Math.PI / 2 - 0.01;
    controls.listenToKeyEvents(window); // Enable arrow key movement
    controls.keyPanSpeed = 15.0; // Set a comfortable move speed

    // Disable default UP/DOWN panning to use them for forward/back movement
    controls.keys = {
      LEFT: 'ArrowLeft',
      RIGHT: 'ArrowRight',
      UP: '',
      BOTTOM: ''
    };

    const onKeyDown = (e) => {
      const moveSpeed = 3.0;
      if (e.key === 'ArrowUp') {
        const dir = new THREE.Vector3().subVectors(controls.target, camera.position);
        dir.y = 0; // Keep movement horizontal
        dir.normalize().multiplyScalar(moveSpeed);
        camera.position.add(dir);
        controls.target.add(dir);
      } else if (e.key === 'ArrowDown') {
        const dir = new THREE.Vector3().subVectors(controls.target, camera.position);
        dir.y = 0; // Keep movement horizontal
        dir.normalize().multiplyScalar(-moveSpeed);
        camera.position.add(dir);
        controls.target.add(dir);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    // We still need mouse tracking for hover/click raycasting
    const onMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
      const mouseY = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;
      setMousePos({ x: mouseX, y: mouseY });
    };
    window.addEventListener('mousemove', onMouseMove);

    // 7. Animation Loop
    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update(); // required if damping enabled
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown);
      controls.dispose();
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update Volumetric Meshes when units, filters, or selections change
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clear old meshes
    meshesRef.current.forEach((m) => scene.remove(m));
    meshesRef.current = [];

    // Filter units
    const filteredUnits = units.filter((u) => {
      if (filterBuilding !== 'ALL' && u.building_id.toUpperCase() !== filterBuilding.toUpperCase()) return false;
      if (isolatedFloor !== 'ALL' && u.floor_number !== parseInt(isolatedFloor)) return false;
      if (!showUnderground && u.z_max <= BASE_MSL) return false;
      return true;
    });

    const conflictingUnitIds = new Set();
    topologyErrors.forEach((err) => {
      if (err.target_unit_id) conflictingUnitIds.add(err.target_unit_id);
      if (err.conflicting_unit_id) conflictingUnitIds.add(err.conflicting_unit_id);
    });

    filteredUnits.forEach((unit) => {
      const coords = unit.footprint.coordinates[0];
      const shape = new THREE.Shape();

      coords.forEach((pt, idx) => {
        const { x, z } = lngLatToMeters(pt[0], pt[1]);
        if (idx === 0) shape.moveTo(x, z);
        else shape.lineTo(x, z);
      });

      const zMinRel = unit.z_min - BASE_MSL;
      const zMaxRel = unit.z_max - BASE_MSL;
      const depth = zMaxRel - zMinRel;

      const extrudeSettings = {
        depth: depth,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.1,
        bevelThickness: 0.1
      };

      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      geometry.rotateX(-Math.PI / 2);
      geometry.translate(0, zMinRel, 0);

      const isSelected = selectedUnit && selectedUnit.id === unit.id;
      const isConflict = conflictingUnitIds.has(unit.id);
      const isAirRights = unit.unit_type === 'air_rights';

      let baseColor = UNIT_COLORS[unit.unit_type] || 0x0284c7;
      if (isConflict) baseColor = 0xf43f5e; // Crimson highlight for 3D conflict

      const material = new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: 0.3,
        metalness: 0.2,
        transparent: true,
        opacity: isAirRights ? 0.35 : (unit.floor_number < 0 ? 0.75 : 0.85),
        wireframe: false,
        emissive: isSelected ? 0x38bdf8 : (isConflict ? 0xe11d48 : 0x000000),
        emissiveIntensity: isSelected ? 0.6 : (isConflict ? 0.4 : 0.0)
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData = { unit: unit };
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Add edge outline wireframe for clean cadastre visualization
      const edges = new THREE.EdgesGeometry(geometry);
      const lineMat = new THREE.LineBasicMaterial({
        color: isSelected ? 0x38bdf8 : (isConflict ? 0xff0055 : 0xffffff),
        linewidth: isSelected ? 2 : 1,
        transparent: true,
        opacity: isSelected ? 1.0 : 0.3
      });
      const line = new THREE.LineSegments(edges, lineMat);
      mesh.add(line);

      scene.add(mesh);
      meshesRef.current.push(mesh);
    });
  }, [units, selectedUnit, topologyErrors, filterBuilding, isolatedFloor, showUnderground]);

  // Click raycasting handler
  const handleClick = (e) => {
    if (!cameraRef.current || meshesRef.current.length === 0) return;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(mousePos.x, mousePos.y);
    raycaster.setFromCamera(mouse, cameraRef.current);

    const intersects = raycaster.intersectObjects(meshesRef.current);
    if (intersects.length > 0) {
      const clickedUnit = intersects[0].object.userData.unit;
      if (clickedUnit) {
        onSelectUnit(clickedUnit);
      }
    }
  };

  return (
    <div
      ref={mountRef}
      onClick={handleClick}
      style={{ width: '100%', height: '100%', position: 'relative', cursor: 'pointer' }}
    >
      {/* 3D Viewport Controls Overlay */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          zIndex: 10,
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap'
        }}
      >
        <div className="glass-panel" style={{ padding: '8px 12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>BUILDING:</span>
          <select
            value={filterBuilding}
            onChange={(e) => filterBuilding !== e.target.value && onSelectUnit(null)}
            style={{
              background: 'rgba(0,0,0,0.5)',
              color: '#fff',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '0.8rem'
            }}
          >
            <option value="ALL">All Buildings</option>
            <option value="B01">B01 (Shree Ram Heights)</option>
            <option value="B02">B02 (Cyber Tech Hub)</option>
            <option value="B99">B99 (Transit & Metro Corridor)</option>
          </select>
        </div>

        <div className="glass-panel" style={{ padding: '8px 12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className={`btn btn-sm ${showUnderground ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => showUnderground ? showUnderground : true}
          >
            {showUnderground ? '🌐 Underground View Active' : '🏢 Above-Ground Only'}
          </button>
        </div>
      </div>

      {/* View Legend */}
      <div
        className="glass-panel"
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          zIndex: 10,
          padding: '10px 14px',
          fontSize: '0.75rem',
          display: 'flex',
          gap: '16px',
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#0284c7' }}></div>
          <span>Apartment</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#d97706' }}></div>
          <span>Basement</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#e11d48' }}></div>
          <span>Metro Tunnel (3D Overlap)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#10b981' }}></div>
          <span>Air Rights</span>
        </div>
      </div>
    </div>
  );
}
