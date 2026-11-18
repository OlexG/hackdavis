import type { Point } from "./types.js";

type Shape = [color: string, a: Point, b: Point, c: Point, ...rest: Point[]];

type Sprite = {
  scale: number;
  eye: Point;
  eyeColor?: string;
  shapes: Shape[];
};

// All sprites share a baseline at y = 0. Draw shapes from back to front.
const sprites = {
  cow: {
    scale: 1.1, eye: [9, -12.5],
    shapes: [
      ["#524039", [-10, -8], [6, -8], [7, 0], [3, 0], [2, -4], [-5, -4], [-6, 0], [-10, 0]],
      ["#fbefdb", [-12, -11], [-8, -15], [2, -15], [8, -12], [8, -6], [-7, -4], [-12, -7]],
      ["#5b4940", [-11, -13], [-5, -15], [-1, -12], [-2, -8], [-7, -7], [-11, -9]],
      ["#705747", [3, -15], [0, -18], [5, -18], [6, -16], [10, -17], [12, -18], [13, -15], [8, -12]],
      ["#fff4e3", [3, -14], [7, -17], [12, -16], [15, -11], [13, -7], [7, -7], [3, -10]],
      ["#dea69b", [9, -12], [15, -12], [16, -9], [14, -6], [9, -6], [7, -9]],
    ],
  },
  goat: {
    scale: 0.76, eye: [9.7, -13.9],
    shapes: [
      ["#8a6650", [-8, -8], [6, -9], [7, 0], [3, 0], [2, -5], [-4, -5], [-5, 0], [-9, 0]],
      ["#d4ae84", [-12, -14], [-8, -12], [-5, -14], [4, -13], [8, -10], [5, -5], [-6, -5], [-10, -8]],
      ["#8b6c54", [4, -15], [1, -22], [5, -21], [7, -17], [8, -22], [11, -20], [11, -15]],
      ["#f1d5ad", [1, -16], [5, -15], [8, -17], [12, -15], [15, -11], [10, -8], [5, -10]],
      ["#a98160", [8, -9], [12, -9], [9, -4]],
    ],
  },
  sheep: {
    scale: 0.8, eye: [10.8, -10.8], eyeColor: "#f8dfbc",
    shapes: [
      ["#645048", [-9, -7], [6, -7], [7, 0], [3, 0], [2, -4], [-4, -4], [-5, 0], [-9, 0]],
      ["#fff1d5", [-13, -9], [-12, -14], [-8, -16], [-5, -17], [-2, -15], [2, -17], [7, -16], [10, -12], [9, -7], [4, -4], [-8, -4]],
      ["#66504b", [3, -13], [7, -12], [10, -14], [13, -12], [15, -9], [12, -6], [8, -7], [7, -10]],
    ],
  },
  pig: {
    scale: 0.84, eye: [9.8, -11.8],
    shapes: [
      ["#c37f79", [-8, -8], [7, -8], [8, 0], [4, 0], [3, -4], [-4, -4], [-5, 0], [-9, 0]],
      ["#eda89e", [-9, -9], [-14, -9], [-15, -13], [-13, -15], [-11, -13], [-13, -12], [-12, -11], [-8, -12], [-6, -15], [4, -15], [9, -10], [7, -5], [-7, -4], [-11, -7]],
      ["#f6baad", [4, -11], [4, -18], [8, -15], [11, -16], [14, -12], [16, -9], [13, -6], [8, -6]],
      ["#cf817e", [12, -11], [16, -11], [17, -8], [15, -6], [12, -7]],
    ],
  },
  rabbit: {
    scale: 0.41, eye: [8.6, -13.3],
    shapes: [
      ["#fbefd7", [-8, -8], [-12, -8], [-13, -5], [-11, -2], [-7, -3]],
      ["#c59771", [-10, -6], [-7, -12], [0, -14], [6, -10], [6, -4], [9, 0], [-7, 0]],
      ["#e4b48b", [0, -15], [-2, -21], [-1, -25], [3, -23], [5, -17], [6, -24], [9, -25], [10, -21], [9, -16], [13, -13], [12, -9], [7, -7], [2, -9]],
    ],
  },
  chicken: {
    scale: 0.55, eye: [7.8, -14.5],
    shapes: [
      ["#dc9a4a", [-5, -5], [4, -5], [4, -2], [7, 0], [1, 0], [0, -3], [-2, 0], [-7, 0], [-4, -2]],
      ["#db9153", [-12, -15], [-5, -12], [1, -13], [4, -17], [8, -18], [11, -15], [10, -10], [6, -5], [-4, -4], [-10, -8]],
      ["#bf594a", [4, -16], [3, -21], [6, -20], [7, -23], [10, -22], [10, -18], [8, -16]],
      ["#f2c365", [10, -15], [15, -13], [10, -11]],
    ],
  },
  duck: {
    scale: 0.62, eye: [8.8, -17.6],
    shapes: [
      ["#db9b46", [-4, -6], [4, -6], [4, -3], [8, 0], [2, 0], [0, -3], [-2, 0], [-7, 0], [-4, -3]],
      ["#fff0d2", [-13, -11], [-6, -11], [1, -13], [3, -17], [8, -17], [10, -10], [7, -5], [-3, -4], [-10, -6]],
      ["#538763", [2, -16], [3, -20], [7, -22], [11, -20], [13, -16], [10, -13], [5, -13]],
      ["#eeb44f", [11, -18], [17, -17], [17, -14], [11, -14], [10, -16]],
    ],
  },
  quail: {
    scale: 0.37, eye: [8.2, -13.9],
    shapes: [
      ["#c78c5c", [-5, -5], [5, -5], [5, -2], [7, 0], [2, 0], [0, -3], [-2, 0], [-7, 0], [-4, -2]],
      ["#b88d6e", [-11, -11], [-7, -11], [-3, -14], [2, -14], [4, -17], [9, -17], [13, -13], [10, -10], [8, -5], [2, -3], [-6, -4], [-10, -7]],
      ["#f1c49a", [4, -13], [9, -14], [12, -12], [9, -8], [5, -6], [3, -8]],
      ["#61483c", [4, -16], [4, -21], [7, -23], [11, -21], [7, -20], [7, -16]],
    ],
  },
  generic: {
    scale: 0.72, eye: [9, -11],
    shapes: [
      ["#866653", [-8, -8], [6, -8], [7, 0], [3, 0], [1, -5], [-4, -5], [-5, 0], [-9, 0]],
      ["#cbac88", [-12, -10], [-7, -14], [3, -14], [7, -10], [5, -5], [-8, -5]],
      ["#e7c8a0", [3, -9], [4, -16], [8, -14], [12, -14], [15, -10], [12, -7], [7, -7]],
    ],
  },
} satisfies Record<string, Sprite>;

type Profile = keyof typeof sprites;
const spritePaths = new Map<Profile, Array<{ color: string; path: Path2D }>>();

export function livestockProfile(key?: string | null, name?: string): Profile {
  for (const value of [key, name]) {
    const species = value?.trim().toLowerCase().replace(/s$/, "");
    if (species && Object.prototype.hasOwnProperty.call(sprites, species)) return species as Profile;
  }
  return "generic";
}

export function livestockScale(species: Profile): number {
  return sprites[species].scale;
}

function toward([x, y]: Point, [nextX, nextY]: Point): Point {
  const distance = Math.hypot(nextX - x, nextY - y);
  const fraction = distance ? Math.min(1.8 / distance, 0.36) : 0;
  return [x + (nextX - x) * fraction, y + (nextY - y) * fraction];
}

function getSpritePaths(species: Profile) {
  const cached = spritePaths.get(species);
  if (cached) return cached;

  const paths = sprites[species].shapes.map(([color, ...points]: Shape) => {
    const path = new Path2D();
    points.forEach((point, index) => {
      const previous = points[(index + points.length - 1) % points.length];
      const next = points[(index + 1) % points.length];
      const [startX, startY] = toward(point, previous);
      if (index === 0) path.moveTo(startX, startY);
      else path.lineTo(startX, startY);
      path.quadraticCurveTo(...point, ...toward(point, next));
    });
    path.closePath();
    return { color, path };
  });
  spritePaths.set(species, paths);
  return paths;
}

export function drawLivestockProfile(ctx: CanvasRenderingContext2D, species: Profile): void {
  const { scale, eye, eyeColor = "#44302a" } = sprites[species] as Sprite;
  ctx.save();
  ctx.scale(scale, scale);
  for (const { color, path } of getSpritePaths(species)) {
    ctx.fillStyle = color;
    ctx.fill(path);
  }
  ctx.fillStyle = eyeColor;
  ctx.beginPath();
  ctx.arc(eye[0], eye[1], 1.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
