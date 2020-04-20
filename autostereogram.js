import * as THREE from 'https://threejsfundamentals.org/threejs/resources/threejs/r115/build/three.module.js';

const postVertShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const postFragShader = `
#include <packing>

varying vec2 vUv;

uniform sampler2D tOriginal;
uniform sampler2D tDepth;
uniform sampler2D tTile;

uniform float u_camnear;
uniform float u_camfar;

uniform float u_showorig;
uniform float u_showdepth;

uniform vec2 u_res;

uniform float tileSize;
uniform float u_maxStep;

float readDepth(sampler2D depthSampler, vec2 coord) {
  float fragCoordZ = texture2D(depthSampler, coord).x;
  float viewZ = perspectiveDepthToViewZ(fragCoordZ, u_camnear, u_camfar);
  return 1.0 - viewZToOrthographicDepth(viewZ, u_camnear, u_camfar);
}
void main() {
  float depth = readDepth(tDepth, vUv);
  
  float maxStep = tileSize * u_maxStep;
  float d = 0.;

  vec2 uv = vUv * u_res;
  for(int count = 0; count < 100; count++) {
    if(uv.x < tileSize) break;

    float d = readDepth(tDepth, uv / u_res);
    uv.x -= tileSize - (d * maxStep);
  }
  float x = mod(uv.x, tileSize) / tileSize;
  float y = mod(uv.y, tileSize) / tileSize;
  
  vec3 stereogram_color = texture2D(tTile, vec2(x,y)).rgb;
  vec3 depth_color = vec3(readDepth(tDepth, vUv));
  vec3 orig_color = texture2D(tOriginal, vUv).rgb;

  gl_FragColor = vec4(mix(stereogram_color, mix(depth_color, orig_color, u_showorig), u_showdepth), 1.0);
}
`;

export function createBWTextures(num, texSize) {
  let textures = [];
  for(let j = 0; j < num; j++) {
    var data = new Uint8Array(3 * texSize * texSize);

    for (var i = 0; i < 3 * texSize * texSize; i+=3) {
      var lum = Math.random() * 256;
      data[i] = lum;
      data[i + 1] = lum;
      data[i + 2] = lum;
    }
    var tileTexture = new THREE.DataTexture(data, texSize, texSize, THREE.RGBFormat );
    tileTexture.wrapS = THREE.RepeatWrapping;
    tileTexture.wrapT = THREE.RepeatWrapping;
    
    textures.push(tileTexture);
  }
  return textures;
}
export function createTexturesFromPalette(num, texSize, palette) {
  let textures = [];
  for(let j = 0; j < num; j++) {
    var data = new Uint8Array(3 * texSize * texSize);

    for (var i = 0; i < 3 * texSize * texSize; i+=3) {
      var ci = Math.floor(Math.random() * palette.length);
      let c = palette[ci];
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
    }
    var tileTexture = new THREE.DataTexture(data, texSize, texSize, THREE.RGBFormat);
    tileTexture.wrapS = THREE.RepeatWrapping;
    tileTexture.wrapT = THREE.RepeatWrapping;
    
    textures.push(tileTexture);
  }
  return textures;
}
export function createRandomPalette(num) {
  let palette = [];
  for(let i = 0; i < num; i++) {
    var data = new Uint8Array(3);
    data[0] = Math.random() * 256;
    data[1] = Math.random() * 256;
    data[2] = Math.random() * 256;
    palette.push(data);
  }
  return palette;
}

export class AnimatedStereogram {
  constructor(renderer, camera) {
    if(!renderer.extensions.get('WEBGL_depth_texture')) {
      console.log("depth_texture extension not available!");
      return;
    }
    this.setupRenderTarget();
    this.setupPost(camera);
  }
  
  renderScene(renderer, scene, camera, tex) {
    renderer.setRenderTarget(this.target);
    renderer.render(scene, camera);
  
    this.postMaterial.uniforms.tDepth.value = this.target.depthTexture;
    this.postMaterial.uniforms.tOriginal.value = this.target.texture;
    this.postMaterial.uniforms.tTile.value = tex;
    
    renderer.setRenderTarget(null);
    renderer.render(this.postScene, this.postCamera);
  }
  
  randomTileTexture(textures) {
    return textures[Math.floor(Math.random() * textures.length)];
  }
  
  changeSize(w, h) {
    this.postMaterial.uniforms.u_res.values = [w, h];
    this.target.setSize(w, h);
    console.log("changes size");
  }
  
  setupRenderTarget() {
    if(this.target) this.target.dispose();

    this.target = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
    this.target.texture.format = THREE.RGBFormat;
    this.target.texture.minFilter = THREE.NearestFilter;
    this.target.texture.magFilter = THREE.NearestFilter;
    this.target.texture.generateMipmaps = false;
    this.target.stencilBuffer = false;
    this.target.depthBuffer = true;
    this.target.depthTexture = new THREE.DepthTexture();
    this.target.depthTexture.format = THREE.DepthFormat;
    this.target.depthTexture.type = THREE.UnsignedShortType;
  }
  
  showDepth() {
    this.postMaterial.uniforms.u_showdepth.value = 1.0;
    this.postMaterial.uniforms.u_showorig.value = 0.0;
  }
  showStereo() {
    this.postMaterial.uniforms.u_showdepth.value = 0.0;
    this.postMaterial.uniforms.u_showorig.value = 0.0;
  }
  
  showOrig() {
    this.postMaterial.uniforms.u_showdepth.value = 1.0;
    this.postMaterial.uniforms.u_showorig.value = 1.0;
  }
  
  setupPost(camera) {
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postMaterial = new THREE.ShaderMaterial({
        vertexShader: postVertShader.trim(),
        fragmentShader: postFragShader.trim(),
        uniforms: {
            u_camnear: {value: camera.near},
            u_camfar: {value: camera.far},
            u_res: {value: [window.innerWidth, window.innerHeight]},
            u_showorig: {value: 0},
            u_showdepth: {value: 0},
            u_maxStep: {value: 0.25},
            tileSize: {value: 100.},
            tTile: {value: null},
            tDepth: {value: null},
            tOriginal: {value: null}
        }
    });
    var postPlane = new THREE.PlaneBufferGeometry(2, 2);
    var postQuad = new THREE.Mesh(postPlane, this.postMaterial);
    this.postScene = new THREE.Scene();
    this.postScene.add(postQuad);
  }
}