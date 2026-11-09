// BoxWorld: a minimal collision world for sm64-controller made of a ground plane and axis-aligned solid boxes.
// It answers the three queries the controller needs (floor below, ceiling above, wall push-out) with the same
// conventions the movement spec assumes: floors are found up to 78 units above the query point, walls are thin
// faces that push a vertical cylinder sample out along the face normal.

export class BoxWorld {
  /** @param opts { groundY: number|null (null = no ground plane), boxes: [{x0,x1,y0,y1,z0,z1}] } */
  constructor(opts = {}) {
    this.groundY = opts.groundY === undefined ? 0 : opts.groundY;
    this.boxes = [];
    for (const b of opts.boxes || []) this.addBox(b);
  }
  addBox(b) {
    const box = {
      x0: Math.min(b.x0, b.x1), x1: Math.max(b.x0, b.x1),
      y0: Math.min(b.y0, b.y1), y1: Math.max(b.y0, b.y1),
      z0: Math.min(b.z0, b.z1), z1: Math.max(b.z0, b.z1),
    };
    this.boxes.push(box);
    return box;
  }

  findFloor(x, y, z) {
    let best = this.groundY === null || this.groundY > y + 78 ? -Infinity : this.groundY;
    for (const b of this.boxes) {
      if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue;
      if (b.y1 > y + 78) continue;
      if (b.y1 > best) best = b.y1;
    }
    return best === -Infinity ? null : { height: best, nx: 0, ny: 1, nz: 0 };
  }

  findCeil(x, y, z) {
    let best = Infinity;
    for (const b of this.boxes) {
      if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue;
      if (b.y0 < y - 78 || b.y0 <= this.groundY) continue; // boxes resting on the ground have no underside
      if (b.y0 < best) best = b.y0;
    }
    return best;
  }

  /** Push pos ([x,y,z], mutated) out of any box face within `radius` of the point at height y + offsetY. */
  resolveWalls(pos, offsetY, radius) {
    let hit = null;
    const y = pos[1] + offsetY;
    for (const b of this.boxes) {
      if (y < b.y0 || y > b.y1) continue;
      // faces in a fixed order: -Z, +Z, -X, +X
      if (pos[0] >= b.x0 && pos[0] <= b.x1) {
        let d = b.z0 - pos[2];
        if (d >= -radius && d <= radius) { pos[2] = b.z0 - radius; hit = NEG_Z; }
        d = pos[2] - b.z1;
        if (d >= -radius && d <= radius) { pos[2] = b.z1 + radius; hit = POS_Z; }
      }
      if (pos[2] >= b.z0 && pos[2] <= b.z1) {
        let d = b.x0 - pos[0];
        if (d >= -radius && d <= radius) { pos[0] = b.x0 - radius; hit = NEG_X; }
        d = pos[0] - b.x1;
        if (d >= -radius && d <= radius) { pos[0] = b.x1 + radius; hit = POS_X; }
      }
    }
    return hit;
  }
}

const NEG_Z = { nx: 0, nz: -1 }, POS_Z = { nx: 0, nz: 1 }, NEG_X = { nx: -1, nz: 0 }, POS_X = { nx: 1, nz: 0 };
