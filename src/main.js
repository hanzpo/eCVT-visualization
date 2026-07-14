import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildMachine } from './machine.js';
import { Sim } from './sim.js';
import { buildUI } from './ui.js';
import './style.css';

const container = document.getElementById('scene');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
container.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.id = 'labels';
container.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0c0e);
scene.fog = new THREE.Fog(0x0a0c0e, 34, 85);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 300);
const CAM_END = new THREE.Vector3(-7.0, 5.0, 23.5);
const CAM_START = new THREE.Vector3(-16, 15, 42);
camera.position.copy(CAM_START);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(-0.4, -1.7, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxDistance = 70;
controls.minDistance = 6;
controls.maxPolarAngle = Math.PI * 0.55;

// lights
scene.add(new THREE.HemisphereLight(0x9db4cc, 0x1a1512, 0.5));
const key = new THREE.DirectionalLight(0xfff1dd, 2.2);
key.position.set(10, 16, 9);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -16; key.shadow.camera.right = 16;
key.shadow.camera.top = 14; key.shadow.camera.bottom = -12;
key.shadow.camera.far = 60;
key.shadow.bias = -0.0004;
scene.add(key);
const rim = new THREE.DirectionalLight(0x4fd6e3, 0.55);
rim.position.set(-14, 6, -12);
scene.add(rim);

const machine = buildMachine(scene);
const sim = new Sim();
const ui = buildUI((mode) => sim.setMode(mode));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
let intro = 0;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (intro < 1) {
    intro = Math.min(1, intro + dt / 2.4);
    camera.position.lerpVectors(CAM_START, CAM_END, easeOut(intro));
  }

  sim.step(dt);
  machine.update(sim, dt, t);
  ui.update(sim);

  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
});
