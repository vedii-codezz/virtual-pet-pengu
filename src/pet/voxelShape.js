
import * as THREE from 'three';

// Build a 3D shape from a grid of voxel cubes
export function createVoxelShape(
    pattern,
    colors,
    cubeSize = 0.2,
    depth = 0.8
) {
    const group = new THREE.Group();

    const rows = pattern.length;
    const cols = pattern[0].length;

    const geometry = new THREE.BoxGeometry(
        cubeSize,
        cubeSize,
        depth
    );

    const materials = {};

    for (const [key, color] of Object.entries(colors)) {
        materials[key] = new THREE.MeshStandardMaterial({
            color,
            roughness: 0.85,
            flatShading: true
        });
    }

    pattern.forEach((row, y) => {
        [...row].forEach((pixel, x) => {
            if (pixel === '.') return;

            const material = materials[pixel];
            if (!material) return;

            const cube = new THREE.Mesh(geometry, material);

            cube.position.set(
                (x - (cols - 1) / 2) * cubeSize,
                ((rows - 1) / 2 - y) * cubeSize,
                0
            );

            group.add(cube);
        });
    });

    return group;
}
