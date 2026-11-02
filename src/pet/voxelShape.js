import * as THREE from 'three';

// Build only the visible cubes of an ellipsoid. Instancing keeps the rounded
// voxel silhouette dimensional without hundreds of individual draw calls.
export function createVoxelEllipsoid(radii, size, materialForVoxel, materials) {
  const [rx, ry, rz] = radii;
  const nx = Math.ceil(rx / size);
  const ny = Math.ceil(ry / size);
  const nz = Math.ceil(rz / size);
  const inside = (x, y, z) =>
    (x * size / rx) ** 2 + (y * size / ry) ** 2 + (z * size / rz) ** 2 <= 1;
  const positions = new Map();

  for (let x = -nx; x <= nx; x++) {
    for (let y = -ny; y <= ny; y++) {
      for (let z = -nz; z <= nz; z++) {
        if (!inside(x, y, z)) continue;
        const exposed = [
          [1, 0, 0], [-1, 0, 0], [0, 1, 0],
          [0, -1, 0], [0, 0, 1], [0, 0, -1]
        ].some(([dx, dy, dz]) => !inside(x + dx, y + dy, z + dz));
        if (!exposed) continue;
        const key = materialForVoxel(x * size, y * size, z * size, radii);
        if (!positions.has(key)) positions.set(key, []);
        positions.get(key).push([x * size, y * size, z * size]);
      }
    }
  }

  const group = new THREE.Group();
  const geometry = new THREE.BoxGeometry(size * 1.015, size * 1.015, size * 1.015);
  const dummy = new THREE.Object3D();
  for (const [key, points] of positions) {
    const mesh = new THREE.InstancedMesh(geometry, materials[key], points.length);
    points.forEach((point, index) => {
      dummy.position.set(...point);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  }
  return group;
}
