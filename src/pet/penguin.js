import { createVoxelShape } from './voxelShape.js';
import * as THREE from 'three';

// Create a single voxel cube
function createCube(width, height, depth, color, x, y, z) {
    const geometry = new THREE.BoxGeometry(width, height, depth);

    const material = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.85,
        flatShading: true
    });

    const cube = new THREE.Mesh(geometry, material);

    cube.position.set(x, y, z);

    return cube;
}

// Build our penguin
export function createPenguin() {
    const penguin = new THREE.Group();

    // Colors
    const blue = '#355C85';
    const darkBlue = '#1B304B';
    const white = '#FFF8F0';
    const yellow = '#FFCC26';
    const orange = '#FF941C';


    // ROUNDED VOXEL BODY
    const bodyPattern = [
        "...BBBBBB...",
        "..BBBBBBBB..",
        ".BBBBBBBBBB.",
        "BBBBBBBBBBBB",
        "BBBBBBBBBBBB",
        "BBBBBBBBBBBB",
        ".BBBBBBBBBB.",
        ".BBBBBBBBBB.",
        "..BBBBBBBB..",
        "...BBBBBB..."
    ];

    const voxelBody = createVoxelShape(
        bodyPattern,
        { B: blue },
        0.18,
        1.3
    );

    voxelBody.position.set(0, 1.15, 0);
    penguin.add(voxelBody);

    // WHITE VOXEL BELLY
    const bellyPattern = [
        "...WWWWWW...",
        "..WWWWWWWW..",
        ".WWWWWWWWWW.",
        "WWWWWWWWWWWW",
        "WWWWWWWWWWWW",
        "WWWWWWWWWWWW",
        "WWWWWWWWWWWW",
        ".WWWWWWWWWW.",
        "..WWWWWWWW..",
        "...WWWWWW..."
    ];

    const voxelBelly = createVoxelShape(
        bellyPattern,
        { W: white },
        0.145,
        0.12
    );

    voxelBelly.position.set(0, 1.15, 0.72);
    penguin.add(voxelBelly);



    // ROUNDED VOXEL HEAD
    const headPattern = [
        "....DDDDDD....",
        "...BBBBBBBB...",
        "..BBBBBBBBBB..",
        ".BBBBBBBBBBBB.",
        "BBBBBBBBBBBBBB",
        "BBBBBBBBBBBBBB",
        "BBBBBBBBBBBBBB",
        "BBBBBBBBBBBBBB",
        ".BBBBBBBBBBBB.",
        "..BBBBBBBBBB..",
        "...BBBBBBBB...",
        "....DDDDDD...."
    ];

    const voxelHead = createVoxelShape(
        headPattern,
        {
            B: blue,
            D: darkBlue
        },
        0.18,
        1.65
    );

    voxelHead.position.set(0, 2.7, 0);

    penguin.add(voxelHead);


    // LEFT FOOT
    const leftFoot = createCube(
        0.65, 0.3, 0.75,
        yellow,
        -0.55, 0.15, 0.35
    );
    leftFoot.name = 'leftFoot';

    penguin.add(leftFoot);

    // RIGHT FOOT
    const rightFoot = createCube(
        0.65, 0.3, 0.75,
        yellow,
        0.55, 0.15, 0.35
    );
    rightFoot.name = 'rightFoot';

    penguin.add(rightFoot);

    // ORANGE FOOT TIPS
    const leftFootTip = createCube(0.65, 0.13, 0.3, orange, -0.55, 0.07, 0.65);
    leftFootTip.name = 'leftFootTip';
    penguin.add(leftFootTip);

    const rightFootTip = createCube(0.65, 0.13, 0.3, orange, 0.55, 0.07, 0.65);
    rightFootTip.name = 'rightFootTip';
    penguin.add(rightFootTip);


    // FACE DETAILS

    // White patches around the eyes
    const whiteFace = '#FFF8F0';
    const brown = '#43251F';
    const pink = '#FFB5BA';


    // PIXEL-SHAPED WHITE FACE
    const facePattern = [
        "..............",
        "..............",
        "..WWW....WWW..",
        ".WWWWW..WWWWW.",
        ".WWWWWWWWWWWW.",
        "WWWWWWWWWWWWWW",
        "WWWWWWWWWWWWWW",
        "WWWWWWWWWWWWWW",
        ".WWWWWWWWWWWW.",
        "..WWWWWWWWWW..",
        "...WWWWWWWW...",
        ".............."
    ];

    const voxelFace = createVoxelShape(
        facePattern,
        {
            W: '#FFF8F0'
        },
        0.18,
        0.08
    );

    // Position slightly in front of the blue head
    voxelFace.position.set(0, 2.7, 0.87);

    penguin.add(voxelFace);


    // Each eye has its own pivot for blinking and future expressions.
    function createEye(name, x) {
        const eye = new THREE.Group();
        eye.name = name;
        eye.position.set(x, 2.7, 1.06);
        eye.add(createCube(0.43, 0.48, 0.08, brown, 0, 0, 0));
        eye.add(createCube(0.12, 0.12, 0.04, '#FFFFFF', -0.1, 0.12, 0.06));
        penguin.add(eye);
    }

    createEye('leftEye', -0.55);
    createEye('rightEye', 0.55);

    // Pink cheeks
    penguin.add(
        createCube(0.3, 0.18, 0.07, pink, -0.87, 2.35, 1.05)
    );

    penguin.add(
        createCube(0.3, 0.18, 0.07, pink, 0.87, 2.35, 1.05)
    );

    // Yellow upper beak
    penguin.add(
        createCube(0.52, 0.2, 0.35, yellow, 0, 2.45, 1.12)
    );

    // Orange lower beak
    penguin.add(
        createCube(0.38, 0.14, 0.27, orange, 0, 2.29, 1.15)
    );

    // LEFT FLIPPER
    const leftFlipper = createCube(
        0.42, 1.05, 0.75,
        blue,
        -1.08, 1.25, 0
    );

    leftFlipper.rotation.z = -0.18;
    leftFlipper.name = 'leftFlipper';
    penguin.add(leftFlipper);

    // RIGHT FLIPPER
    const rightFlipper = createCube(
        0.42, 1.05, 0.75,
        blue,
        1.08, 1.25, 0
    );

    rightFlipper.rotation.z = 0.18;
    rightFlipper.name = 'rightFlipper';
    penguin.add(rightFlipper);

    // Keep idle transforms on the root independent of petting reactions.
    const reaction = new THREE.Group();
    reaction.name = 'reaction';
    reaction.add(...penguin.children);
    const sleep = new THREE.Group();
    sleep.name = 'sleep';
    sleep.add(reaction);
    penguin.add(sleep);

    return penguin;
}
