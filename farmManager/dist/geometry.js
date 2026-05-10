export function polygonArea(poly) {
    let total = 0;
    for (let i = 0; i < poly.length; i += 1) {
        const current = poly[i];
        const next = poly[(i + 1) % poly.length];
        total += current[0] * next[1] - next[0] * current[1];
    }
    return Math.abs(total / 2);
}
export function polygonCentroid(poly) {
    let x = 0;
    let y = 0;
    poly.forEach((point) => {
        x += point[0];
        y += point[1];
    });
    return [x / poly.length, y / poly.length];
}
export function pointInPolygon(point, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
        const xi = poly[i][0];
        const yi = poly[i][1];
        const xj = poly[j][0];
        const yj = poly[j][1];
        const intersects = yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
        if (intersects)
            inside = !inside;
    }
    return inside;
}
export function getBBox(poly) {
    return poly.reduce((box, point) => ({
        minX: Math.min(box.minX, point[0]),
        maxX: Math.max(box.maxX, point[0]),
        minY: Math.min(box.minY, point[1]),
        maxY: Math.max(box.maxY, point[1])
    }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
}
export function distance(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
export function midpoint(a, b) {
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}
export function lerp(a, b, t) {
    return a + (b - a) * t;
}
export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
export function hashString(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}
export function mulberry32(seed) {
    return function random() {
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
export function rotatePoint(point, center, degrees) {
    const radians = (degrees * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const dx = point[0] - center[0];
    const dy = point[1] - center[1];
    return [center[0] + dx * cos - dy * sin, center[1] + dx * sin + dy * cos];
}
export function snapPoint(point) {
    return [Math.round(point[0] * 2) / 2, Math.round(point[1] * 2) / 2];
}
//# sourceMappingURL=geometry.js.map