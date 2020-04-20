import * as STEREO from './autostereogram.js';
import * as THREE from 'https://threejsfundamentals.org/threejs/resources/threejs/r115/build/three.module.js';

import {GLTFLoader} from 'https://threejsfundamentals.org/threejs/resources/threejs/r115/examples/jsm/loaders/GLTFLoader.js';

import {SkeletonUtils} from 'https://threejsfundamentals.org/threejs/resources/threejs/r115/examples/jsm/utils/SkeletonUtils.js';

var renderer, scene, camera;
var clock = new THREE.Clock();

var aStereo, textures;
var player, gui;


var gltfLoader, mixer;

var animalFiles = ["Horse.glb","Flamingo.glb", "Parrot.glb"];
var animalPos = [[0, -100, -300],[0, 0, -250], [0, 0, -200]];
var animalModel;

var guiSettings = {model : "", autoRotate : true};

function setupScene() {
  renderer = new THREE.WebGLRenderer();
  
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 50, 500);

  window.addEventListener('resize', onWindowResize, false);
  
  gltfLoader = new GLTFLoader();
  loadAnimal(animalFiles[0]);
  
  aStereo = new STEREO.AnimatedStereogram(renderer, camera);
  
  let p = STEREO.createRandomPalette(3);
  p.push([0,0,0], [255,255,255]);
  
  textures = STEREO.createTexturesFromPalette(50, 32, p);
  camera.rotation.x = -0.4;
  camera.position.y = 100;
  setupGUI();
}

function loadAnimal(a) {
  let posIndex;
  for(let i = 0; i < animalFiles.length; i++) {
    if(animalFiles[i] == a) posIndex = i;
  }
  if(posIndex == undefined) return;
  guiSettings.model = a;
  
  if(animalModel) scene.remove(animalModel);
  
  gltfLoader.load(a, function (model) {
    mixer = new THREE.AnimationMixer(model.scene);
    model.animations.forEach((clip) => { mixer.clipAction(clip).play(); });
    model.scene.position.x = animalPos[posIndex][0];
    model.scene.position.y = animalPos[posIndex][1];
    model.scene.position.z = animalPos[posIndex][2];
    scene.add(model.scene);
    
    animalModel = model.scene;
  });
}

function setupGUI() {
  gui = new dat.GUI();
  gui.add(aStereo.postMaterial.uniforms.tileSize, 'value').min(10).max(500).name("tileSize");
  gui.add(aStereo.postMaterial.uniforms.u_maxStep, 'value').min(0.01).max(0.9).name("maxStep");
  gui.add(aStereo, 'showDepth');
  gui.add(aStereo, 'showStereo');
  gui.add(guiSettings, 'model', animalFiles).onChange(v => loadAnimal(v));
  gui.add(guiSettings, 'autoRotate');
}


function onWindowResize(){
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  
  renderer.setSize(window.innerWidth, window.innerHeight);
  aStereo.changeSize(window.innerWidth, window.innerHeight);
}

function animate(now) {
  requestAnimationFrame(animate);
  
  var delta = clock.getDelta();
  if(mixer) mixer.update(delta);
  if(animalModel && guiSettings.autoRotate) animalModel.rotation.y += delta;
  aStereo.renderScene(renderer, scene, camera, aStereo.randomTileTexture(textures));
  
}

setupScene();
animate();