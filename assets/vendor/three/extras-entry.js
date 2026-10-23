// add-ons for the showroom and the cinematic profile, attached to the page's window.THREE (three.js r170)
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { HorizontalBlurShader } from 'three/examples/jsm/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/examples/jsm/shaders/VerticalBlurShader.js';
Object.assign(window.THREE.X || (window.THREE.X = {}), { GLTFLoader, MeshoptDecoder, BokehPass, HorizontalBlurShader, VerticalBlurShader });
