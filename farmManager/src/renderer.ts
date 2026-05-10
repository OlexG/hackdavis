import * as DemoState from "./demoState.js";
import * as G from "./geometry.js";
import type { FarmObject, PathObject, Point, ScreenPoint, ZoomLimits } from "./types.js";

const { state } = DemoState;
  const TILE_X = 6.1;
  const TILE_Y = 3.05;
  const HEIGHT_SCALE = 5.2;
  const BOARD_WIDTH = 108;
  const BOARD_HEIGHT = 82;
  const BOARD_CENTER: Point = [BOARD_WIDTH / 2, BOARD_HEIGHT / 2];

  const palette = {
    cropArea: "#496b47",
    cropAreaSide: "#314c37",
    tilledSoil: "#8b6a43",
    tilledSoilSide: "#5f452d",
    field: "#5f9f55",
    fieldSide: "#416f40",
    pasture: "#a7b85b",
    pastureSide: "#6f7d3d",
    structureWall: "#c98d57",
    structureSide: "#9a6848",
    roof: "#58697a",
    path: "#c59d5b",
    selected: "#f8e08a",
    draft: "#f0c35a"
  };

  let canvas;
  let ctx;
  let logicalWidth = 0;
  let logicalHeight = 0;
  let animationFrame = 0;
  let isRendering = false;

export function init(targetCanvas: HTMLCanvasElement): () => void {
    canvas = targetCanvas;
    ctx = canvas.getContext("2d");
    isRendering = true;
    window.addEventListener("resize", resize);
    resize();
    animationFrame = requestAnimationFrame(render);

    return () => {
      isRendering = false;
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrame);
      canvas = null;
      ctx = null;
    };
  }

export function resize(): void {
    const previousWidth = logicalWidth;
    const previousHeight = logicalHeight;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    logicalWidth = rect.width;
    logicalHeight = rect.height;

    if (previousWidth > 0 && previousHeight > 0) {
      state.panX += (logicalWidth - previousWidth) * 0.01;
      state.panY += (logicalHeight - previousHeight) * 0.52;
    }
  }

export function project(point: Point, height = 0): ScreenPoint {
    const rotated = G.rotatePoint(worldToBoard(point), BOARD_CENTER, state.rotation);
    const x = rotated[0];
    const y = rotated[1];
    return {
      x: logicalWidth * 0.49 + state.panX + (x - y) * TILE_X * state.zoom,
      y: 92 + state.panY + (x + y) * TILE_Y * state.zoom - height * HEIGHT_SCALE * state.zoom
    };
  }

export function unproject(screenX: number, screenY: number): Point {
    const dx = (screenX - (logicalWidth * 0.49 + state.panX)) / (TILE_X * state.zoom);
    const dy = (screenY - (92 + state.panY)) / (TILE_Y * state.zoom);
    const rotated: Point = [(dy + dx) / 2, (dy - dx) / 2];
    return boardToWorld(G.rotatePoint(rotated, BOARD_CENTER, -state.rotation));
  }

  function getWorldTransform() {
    const bbox = G.getBBox(DemoState.activeBoundary());
    const width = Math.max(1, bbox.maxX - bbox.minX);
    const height = Math.max(1, bbox.maxY - bbox.minY);
    const scale = Math.min(104 / width, 78 / height);
    return {
      bbox,
      scale,
      offsetX: (BOARD_WIDTH - width * scale) / 2,
      offsetY: (BOARD_HEIGHT - height * scale) / 2
    };
  }

  function worldToBoard(point: Point): Point {
    const transform = getWorldTransform();
    return [
      transform.offsetX + (point[0] - transform.bbox.minX) * transform.scale,
      transform.offsetY + (point[1] - transform.bbox.minY) * transform.scale
    ];
  }

  function boardToWorld(point: Point): Point {
    const transform = getWorldTransform();
    return [
      transform.bbox.minX + (point[0] - transform.offsetX) / transform.scale,
      transform.bbox.minY + (point[1] - transform.offsetY) / transform.scale
    ];
  }

  function projectedBoundaryBounds(zoom = 1): { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number } {
    const points = DemoState.activeBoundary().map((point) => {
      const rotated = G.rotatePoint(worldToBoard(point), BOARD_CENTER, state.rotation);
      return {
        x: (rotated[0] - rotated[1]) * TILE_X * zoom,
        y: (rotated[0] + rotated[1]) * TILE_Y * zoom
      };
    });
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

export function getZoomLimits(): ZoomLimits {
    const size = projectedBoundaryBounds(1);
    const minZoom = Math.min(
      logicalWidth / Math.max(1, size.width * 1.25),
      logicalHeight / Math.max(1, size.height * 1.25)
    );
    const transform = getWorldTransform();
    const base25Feet = 25 * transform.scale * Math.hypot(TILE_X, TILE_Y);
    const maxZoom = Math.max(minZoom * 1.4, (Math.min(logicalWidth, logicalHeight) * 0.65) / Math.max(1, base25Feet));
    return {
      min: G.clamp(minZoom, 0.12, 1.2),
      max: G.clamp(maxZoom, 1.4, 12)
    };
  }

export function getCenteredPan(zoom = state.zoom): { x: number; y: number } {
    const bounds = projectedBoundaryBounds(zoom);
    const boundaryCenterX = (bounds.minX + bounds.maxX) / 2;
    const boundaryCenterY = (bounds.minY + bounds.maxY) / 2;
    return {
      x: logicalWidth * 0.5 - logicalWidth * 0.49 - boundaryCenterX,
      y: logicalHeight * 0.52 - 92 - boundaryCenterY
    };
  }

  function render() {
    if (!ctx || !isRendering) return;
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);
    drawBackdrop();
    drawGround();
    drawObjects();
    drawDraft();
    animationFrame = requestAnimationFrame(render);
  }

  function drawBackdrop() {
    const gradient = ctx.createLinearGradient(0, 0, 0, logicalHeight);
    gradient.addColorStop(0, "#253534");
    gradient.addColorStop(0.55, "#19231f");
    gradient.addColorStop(1, "#101511");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);
  }

  function drawGround() {
    const boundary = DemoState.activeBoundary();
    drawWorldPolygon(boundary, 0, state.view === "satellite" ? "#5c7c4c" : "#496b47", "#203029");
    ctx.save();
    ctx.clip(buildPath(boundary, 0.03));
    if (state.view === "satellite") drawTerrainPatches();
    else drawGridLines();
    ctx.restore();
    drawFence(boundary, "#d4b16b", 0.25);
  }

  function drawObjects() {
    const objects = DemoState.currentObjects().slice();
    drawLayer(objects, "path", drawPathObject);
    drawLayer(objects, "cropArea", drawCropArea);
    drawLayer(objects, "livestock", drawLivestock);
    drawLayer(objects, "cropField", drawCropField);
    drawLayer(objects, "structure", drawStructure);
    objects.forEach(drawObjectLabel);
  }

  function drawLayer(objects: FarmObject[], type: FarmObject["type"], drawFn: (object: any) => void) {
    objects
      .filter((object) => object.type === type)
      .sort((a, b) => objectDepth(a) - objectDepth(b))
      .forEach(drawFn);
  }

  function drawCropArea(object) {
    drawExtrudedPolygon(object.polygon, object.height, {
      top: palette.tilledSoil,
      side: palette.tilledSoilSide,
      stroke: "rgba(69, 48, 28, 0.84)"
    });
    drawTilledRows(object);
    if (state.selectedId === object.id) drawSelection(object);
  }

  function drawCropField(object) {
    drawExtrudedPolygon(object.polygon, object.height, {
      top: !object.attrs.cropKey ? "#6f7a52" : object.attrs.status === "Harvested" ? "#658f4b" : palette.field,
      side: palette.fieldSide,
      stroke: "rgba(30, 47, 28, 0.8)"
    });
    drawCropRows(object);
    if (isOverCapacity(object)) drawCapacityWarning(object);
    if (state.selectedId === object.id) drawSelection(object);
  }

  function drawLivestock(object) {
    drawExtrudedPolygon(object.polygon, object.height, {
      top: palette.pasture,
      side: palette.pastureSide,
      stroke: "rgba(68, 80, 37, 0.85)"
    });
    drawFence(object.polygon, "#c9a865", object.height + 0.25);
    drawAnimals(object);
    if (isOverCapacity(object)) drawCapacityWarning(object);
    if (state.selectedId === object.id) drawSelection(object);
  }

  function drawStructure(object) {
    const isGreenhouse = object.attrs.kind === "Greenhouse";
    drawExtrudedPolygon(object.polygon, object.height, {
      top: isGreenhouse ? "rgba(137, 204, 198, 0.62)" : palette.roof,
      side: isGreenhouse ? "rgba(90, 138, 134, 0.46)" : palette.structureSide,
      stroke: "rgba(47, 43, 36, 0.8)"
    });
    drawRoofRidge(object);
    if (state.selectedId === object.id) drawSelection(object);
  }

  function drawPathObject(object) {
    drawPath(object.points, object.attrs.material === "Mulch" ? "#a66f44" : palette.path);
    if (state.selectedId === object.id) {
      ctx.save();
      ctx.strokeStyle = palette.selected;
      ctx.lineWidth = 3;
      tracePath(object.points, 0.3);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawCropRows(object) {
    const topPath = buildPath(object.polygon, object.height + 0.08);
    const bbox = G.getBBox(object.polygon);
    ctx.save();
    ctx.clip(topPath);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "rgba(245, 230, 164, 0.24)";
    const rows = object.attrs.rows || 5;
    for (let y = bbox.minY - 6; y <= bbox.maxY + 6; y += Math.max(3.5, (bbox.maxY - bbox.minY) / rows)) {
      const p1 = project([bbox.minX - 8, y], object.height + 0.12);
      const p2 = project([bbox.maxX + 8, y + 2], object.height + 0.12);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    ctx.restore();

    const positions = generatePositions(object.polygon, object.attrs.count || 12, G.hashString(`${object.id}-${state.commitIndex}`), 0);
    positions
      .sort((a, b) => a[0] + a[1] - (b[0] + b[1]))
      .forEach((position) => drawPlant(position, object.height + 0.2, object.attrs));
  }

  function drawTilledRows(object) {
    const topPath = buildPath(object.polygon, object.height + 0.08);
    const bbox = G.getBBox(object.polygon);
    ctx.save();
    ctx.clip(topPath);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "rgba(58, 38, 22, 0.34)";
    for (let y = bbox.minY - 8; y <= bbox.maxY + 8; y += 3.8) {
      ctx.beginPath();
      for (let x = bbox.minX - 8; x <= bbox.maxX + 8; x += 2.8) {
        const waveY = y + Math.sin((x + object.id.length) * 0.25) * 0.45;
        const p = project([x, waveY], object.height + 0.12);
        if (x <= bbox.minX - 7.9) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(235, 183, 107, 0.16)";
    ctx.lineWidth = 1;
    for (let y = bbox.minY - 6; y <= bbox.maxY + 6; y += 7.6) {
      const p1 = project([bbox.minX - 8, y], object.height + 0.13);
      const p2 = project([bbox.maxX + 8, y + 1.5], object.height + 0.13);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlant(position, baseHeight, attrs) {
    const base = project(position, baseHeight);
    const growth = Math.max(0.12, attrs.growth || 0.45);
    const h = (5 + growth * 16) * state.zoom;
    const sway = Math.sin(performance.now() / 900 + position[0]) * 0.45;
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = attrs.visual === "grain" ? "#d3c85a" : "#2e6f45";
    ctx.lineWidth = Math.max(1, 1.7 * state.zoom);
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(base.x + sway, base.y - h);
    ctx.stroke();

    if (attrs.visual === "grain") {
      ctx.fillStyle = "#8db64f";
      drawTriangle(base.x + sway, base.y - h * 0.55, 4.5 * state.zoom, 8 * state.zoom, -1);
      drawTriangle(base.x + sway, base.y - h * 0.48, 4.5 * state.zoom, 8 * state.zoom, 1);
      if (growth > 0.72) {
        ctx.fillStyle = "#ecc95a";
        drawDiamond(base.x + sway, base.y - h * 0.82, 2.8 * state.zoom, 5.5 * state.zoom);
      }
    } else if (attrs.visual === "fruiting") {
      ctx.fillStyle = "#4f9c51";
      drawDiamond(base.x + sway, base.y - h * 0.42, 6 * growth * state.zoom, 4.5 * growth * state.zoom);
      drawDiamond(base.x + sway + 2, base.y - h * 0.66, 5 * growth * state.zoom, 4 * growth * state.zoom);
      if (growth > 0.56) {
        ctx.fillStyle = "#d94d3d";
        drawCircle(base.x - 2 * state.zoom, base.y - h * 0.62, 2.2 * state.zoom);
      }
    } else if (attrs.visual === "leafy" || attrs.visual === "herb") {
      ctx.fillStyle = attrs.visual === "herb" ? "#64b66b" : "#9ccd68";
      drawDiamond(base.x, base.y - 2 * state.zoom, 6 * growth * state.zoom, 4 * growth * state.zoom);
      drawDiamond(base.x + 1.5 * state.zoom, base.y - 3.5 * state.zoom, 4.5 * growth * state.zoom, 3.5 * growth * state.zoom);
    } else {
      ctx.fillStyle = "#5cb56a";
      drawCircle(base.x, base.y - h * 0.42, Math.max(2, 4.5 * growth * state.zoom));
    }
    ctx.restore();
  }

  function drawAnimals(object) {
    const positions = generatePositions(object.polygon, object.attrs.count, G.hashString(object.id), 2);
    positions
      .sort((a, b) => a[0] + a[1] - (b[0] + b[1]))
      .forEach((position, index) => {
        const p = project(position, object.height + 0.2);
        const bob = Math.sin(performance.now() / 620 + index * 0.9) * 0.7;
        ctx.save();
        ctx.translate(p.x, p.y + bob);
        ctx.scale(state.zoom, state.zoom);
        ctx.fillStyle = "rgba(0,0,0,0.16)";
        ctx.beginPath();
        ctx.ellipse(0, 4, 7, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        if (object.attrs.species === "Chicken" || object.attrs.species === "Duck") {
          const isDuck = object.attrs.species === "Duck";
          ctx.fillStyle = isDuck ? "#f1ecd2" : index % 3 === 0 ? "#f4e3c3" : "#d47d4c";
          drawLocalPolygon([[-5, 1], [1, -5], [6, 1], [1, 5]]);
          ctx.fillStyle = isDuck ? "#f1c14b" : "#d94d3d";
          drawLocalPolygon([[5, -1], [9, 1], [5, 3]]);
        } else if (object.attrs.species === "Sheep") {
          ctx.fillStyle = "#efe8d5";
          drawCircle(-4, -1, 4.8);
          drawCircle(1, -2, 5.2);
          drawCircle(5, 0, 4.5);
          ctx.fillStyle = "#3b332c";
          ctx.beginPath();
          ctx.ellipse(8, -1, 2.6, 2.2, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = index % 2 === 0 ? "#d8c0a3" : "#9f8063";
          ctx.beginPath();
          ctx.ellipse(0, 0, 7, 4.5, -0.15, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#efe2ce";
          ctx.beginPath();
          ctx.ellipse(7, -2, 3.5, 3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#4a3829";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(7, -4);
          ctx.lineTo(10, -7);
          ctx.moveTo(8, -3);
          ctx.lineTo(12, -5);
          ctx.stroke();
        }
        ctx.restore();
      });
  }

  function drawRoofRidge(object) {
    const poly = object.polygon;
    if (poly.length < 4) return;
    const c = G.polygonCentroid(poly);
    const a = G.midpoint(poly[0], poly[1]);
    const b = G.midpoint(poly[2], poly[3]);
    const p1 = project(a, object.height + 0.55);
    const p2 = project(b, object.height + 0.55);
    const pc = project(c, object.height + 1.1);
    ctx.save();
    ctx.strokeStyle = object.attrs.kind === "Greenhouse" ? "rgba(255,255,255,0.46)" : "rgba(28,32,35,0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(pc.x, pc.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawExtrudedPolygon(poly, height, style) {
    poly.forEach((point, index) => {
      const next = poly[(index + 1) % poly.length];
      const p1 = project(point, 0);
      const p2 = project(next, 0);
      const p3 = project(next, height);
      const p4 = project(point, height);
      const light = (next[0] - point[0]) - (next[1] - point[1]) > 0 ? 0.08 : -0.08;
      ctx.fillStyle = shadeColor(style.side, light);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.lineTo(p4.x, p4.y);
      ctx.closePath();
      ctx.fill();
    });
    drawWorldPolygon(poly, height, style.top, style.stroke);
  }

  function drawWorldPolygon(poly, height, fill, stroke) {
    const path = buildPath(poly, height);
    ctx.fillStyle = fill;
    ctx.fill(path);
    if (stroke && stroke !== "transparent") {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.25;
      ctx.stroke(path);
    }
  }

  function buildPath(poly, height = 0) {
    const path = new Path2D();
    poly.forEach((point, index) => {
      const p = project(point, height);
      if (index === 0) path.moveTo(p.x, p.y);
      else path.lineTo(p.x, p.y);
    });
    path.closePath();
    return path;
  }

  function drawGridLines() {
    const bbox = G.getBBox(DemoState.activeBoundary());
    const step = niceGridStep(Math.max(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY));
    const startX = Math.floor(bbox.minX / step) * step;
    const endX = Math.ceil(bbox.maxX / step) * step;
    const startY = Math.floor(bbox.minY / step) * step;
    const endY = Math.ceil(bbox.maxY / step) * step;
    ctx.save();
    ctx.strokeStyle = "rgba(232, 239, 214, 0.12)";
    ctx.lineWidth = 1;
    for (let x = startX; x <= endX; x += step) {
      traceLine([x, startY], [x, endY], 0.04);
    }
    for (let y = startY; y <= endY; y += step) {
      traceLine([startX, y], [endX, y], 0.04);
    }
    ctx.restore();
  }

  function niceGridStep(span) {
    if (span > 1200) return 100;
    if (span > 600) return 50;
    if (span > 240) return 25;
    if (span > 120) return 10;
    return 6;
  }

  function drawTerrainPatches() {
    const bbox = G.getBBox(DemoState.activeBoundary());
    const patchW = Math.max(12, (bbox.maxX - bbox.minX) / 8);
    const patchH = Math.max(10, (bbox.maxY - bbox.minY) / 8);
    const colors = ["#58754b", "#6d8752", "#526c45", "#7d8f55", "#48683f", "#6f6f45"];
    for (let x = bbox.minX; x < bbox.maxX; x += patchW) {
      for (let y = bbox.minY; y < bbox.maxY; y += patchH) {
        drawWorldPolygon(
          [
            [x, y],
            [Math.min(bbox.maxX, x + patchW), y + ((x + y) % 3)],
            [Math.min(bbox.maxX, x + patchW), Math.min(bbox.maxY, y + patchH)],
            [x + ((x + y) % 5), Math.min(bbox.maxY, y + patchH)]
          ],
          0.02,
          colors[Math.abs(Math.floor(x * 7 + y * 11)) % colors.length],
          "transparent"
        );
      }
    }
  }

  function drawFence(poly, color, height) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1, 1.3 * state.zoom);
    poly.forEach((point, index) => {
      const next = poly[(index + 1) % poly.length];
      traceLine(point, next, height);
      ctx.stroke();
      const posts = Math.max(2, Math.floor(G.distance(point, next) / 8));
      for (let i = 0; i <= posts; i += 1) {
        const t = i / posts;
      const world: Point = [G.lerp(point[0], next[0], t), G.lerp(point[1], next[1], t)];
        const base = project(world, height - 0.15);
        const top = project(world, height + 1.1);
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(top.x, top.y);
        ctx.stroke();
        drawCircle(top.x, top.y, 1.6 * state.zoom);
      }
    });
    ctx.restore();
  }

  function drawPath(points, color) {
    ctx.save();
    ctx.strokeStyle = "rgba(36, 28, 17, 0.42)";
    ctx.lineWidth = 9 * state.zoom;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    tracePath(points, 0.07);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 6 * state.zoom;
    tracePath(points, 0.12);
    ctx.stroke();
    ctx.strokeStyle = "rgba(245, 222, 168, 0.2)";
    ctx.lineWidth = 2 * state.zoom;
    tracePath(points, 0.15);
    ctx.stroke();
    ctx.restore();
  }

  function tracePath(points, height) {
    points.forEach((point, index) => {
      const p = project(point, height);
      if (index === 0) ctx.beginPath(), ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
  }

  function traceLine(a, b, height) {
    const p1 = project(a, height);
    const p2 = project(b, height);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
  }

  function drawSelection(object) {
    const path = buildPath(object.polygon, 1);
    ctx.save();
    ctx.strokeStyle = palette.selected;
    ctx.lineWidth = 3;
    ctx.shadowColor = "rgba(248, 224, 138, 0.5)";
    ctx.shadowBlur = 12;
    ctx.stroke(path);
    ctx.restore();
  }

  function drawObjectLabel(object) {
    const point = object.type === "path" ? object.points[Math.floor(object.points.length / 2)] : G.polygonCentroid(object.polygon);
    const height = object.type === "structure" ? object.height + 1 : object.type === "path" ? 1.2 : object.height + 2.4;
    const p = project(point, height);
    const isSelected = state.selectedId === object.id;
    const text = object.label;
    ctx.save();
    ctx.font = `${isSelected ? 700 : 650} ${isSelected ? 13 : 12}px Inter, system-ui, sans-serif`;
    const metrics = ctx.measureText(text);
    const padX = 7;
    const boxW = metrics.width + padX * 2;
    const boxH = 22;
    ctx.fillStyle = isSelected ? "rgba(248, 224, 138, 0.94)" : "rgba(19, 27, 24, 0.76)";
    ctx.strokeStyle = isSelected ? "rgba(64, 47, 16, 0.3)" : "rgba(230, 240, 218, 0.16)";
    roundedRect(p.x - boxW / 2, p.y - boxH - 8, boxW, boxH, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = isSelected ? "#211b0e" : "#edf4e7";
    ctx.textBaseline = "middle";
    ctx.fillText(text, p.x - metrics.width / 2, p.y - boxH / 2 - 8);
    ctx.restore();
  }

  function drawDraft() {
    if (state.mode !== "draw") return;
    if (!state.draft.length && !state.mouse) return;
    const points = state.mouse ? [...state.draft, state.mouse] : state.draft;
    ctx.save();
    ctx.strokeStyle = palette.draft;
    ctx.fillStyle = palette.draft;
    ctx.lineWidth = 2.5;
    if (points.length) {
      points.forEach((point, index) => {
        const p = project(point, 1);
        if (index === 0) ctx.beginPath(), ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      if (state.drawType !== "path" && state.draft.length >= 3) {
        ctx.closePath();
        ctx.globalAlpha = 0.18;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.stroke();
    }
    state.draft.forEach((point, index) => {
      const p = project(point, 1.15);
      drawDiamond(p.x, p.y, index === state.draft.length - 1 && state.drawType === "path" ? 7 : 5, 5);
    });
    if (state.mouse) {
      const p = project(state.mouse, 1.15);
      ctx.save();
      ctx.strokeStyle = "rgba(255, 245, 184, 0.95)";
      ctx.lineWidth = 2;
      drawDiamond(p.x, p.y, 8, 8);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function generatePositions(poly, count, seed, offset) {
    const rng = G.mulberry32(seed + offset * 131);
    const bbox = G.getBBox(poly);
    const positions = [];
    const cols = Math.max(2, Math.ceil(Math.sqrt(count * 1.45)));
    const rows = Math.max(2, Math.ceil(count / cols) + 1);
    for (let row = 0; row < rows && positions.length < count; row += 1) {
      for (let col = 0; col < cols && positions.length < count; col += 1) {
        const x = bbox.minX + ((col + 0.5) / cols) * (bbox.maxX - bbox.minX) + (rng() - 0.5) * 2.5;
        const y = bbox.minY + ((row + 0.5) / rows) * (bbox.maxY - bbox.minY) + (rng() - 0.5) * 2.5;
        if (G.pointInPolygon([x, y], poly)) positions.push([x, y]);
      }
    }
    let guard = 0;
    while (positions.length < count && guard < 500) {
      const point: Point = [bbox.minX + rng() * (bbox.maxX - bbox.minX), bbox.minY + rng() * (bbox.maxY - bbox.minY)];
      if (G.pointInPolygon(point, poly)) positions.push(point);
      guard += 1;
    }
    return positions;
  }

  function objectDepth(object) {
    const points = object.type === "path" ? object.points : object.polygon;
    return Math.max(...points.map((point) => {
      const rotated = G.rotatePoint(worldToBoard(point), BOARD_CENTER, state.rotation);
      return rotated[0] + rotated[1];
    }));
  }

export function hitTestAll(world: Point): FarmObject[] {
    return DemoState.currentObjects()
      .filter((object) => {
        if (object.type === "path") return pointNearPath(world, object.points, 2.8);
        return G.pointInPolygon(world, object.polygon);
      })
      .sort((a, b) => hitPriority(a, world) - hitPriority(b, world));
  }

  function hitPriority(object, world) {
    if (object.type === "structure") return 10;
    if (object.type === "cropField") return 20;
    if (object.type === "livestock") return 30;
    if (object.type === "cropArea") return 40;
    if (object.type === "path") return 90;
    return 50;
  }

  function pointNearPath(point, points, threshold) {
    for (let i = 0; i < points.length - 1; i += 1) {
      if (distanceToSegment(point, points[i], points[i + 1]) <= threshold) return true;
    }
    return false;
  }

  function isOverCapacity(object) {
    if (object.type !== "cropField" && object.type !== "livestock") return false;
    const idealSpace = Number(object.attrs.idealSpaceSqft);
    const count = Number(object.attrs.count);
    if (!Number.isFinite(idealSpace) || idealSpace <= 0 || !Number.isFinite(count) || count <= 0) return false;
    return count * idealSpace > G.polygonArea(object.polygon) * 1.02;
  }

  function drawCapacityWarning(object) {
    const height = object.height + 0.55;
    const path = buildPath(object.polygon, height);
    const center = project(G.polygonCentroid(object.polygon), height + 0.4);
    ctx.save();
    ctx.setLineDash([7, 5]);
    ctx.strokeStyle = "#ffe45f";
    ctx.lineWidth = Math.max(2, 2.2 * state.zoom);
    ctx.stroke(path);
    ctx.setLineDash([]);
    ctx.fillStyle = "#ffe45f";
    ctx.strokeStyle = "#3b2a14";
    ctx.lineWidth = 2;
    roundedRect(center.x - 10, center.y - 22, 20, 20, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#3b2a14";
    ctx.font = "900 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("!", center.x, center.y - 12);
    ctx.restore();
  }

  function distanceToSegment(point, a, b) {
    const l2 = Math.pow(G.distance(a, b), 2);
    if (l2 === 0) return G.distance(point, a);
    const t = G.clamp(((point[0] - a[0]) * (b[0] - a[0]) + (point[1] - a[1]) * (b[1] - a[1])) / l2, 0, 1);
    return G.distance(point, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
  }

  function shadeColor(hex, amount) {
    if (!hex.startsWith("#")) return hex;
    const number = parseInt(hex.slice(1), 16);
    const r = G.clamp(((number >> 16) & 255) + 255 * amount, 0, 255);
    const g = G.clamp(((number >> 8) & 255) + 255 * amount, 0, 255);
    const b = G.clamp((number & 255) + 255 * amount, 0, 255);
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  }

  function drawDiamond(x, y, width, height) {
    ctx.beginPath();
    ctx.moveTo(x, y - height);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x - width, y);
    ctx.closePath();
    ctx.fill();
  }

  function drawTriangle(x, y, width, height, direction) {
    ctx.beginPath();
    ctx.moveTo(x, y - height * 0.5);
    ctx.lineTo(x + width * direction, y + height * 0.5);
    ctx.lineTo(x, y + height * 0.2);
    ctx.closePath();
    ctx.fill();
  }

  function drawCircle(x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawLocalPolygon(points) {
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point[0], point[1]);
      else ctx.lineTo(point[0], point[1]);
    });
    ctx.closePath();
    ctx.fill();
  }

  function roundedRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
  }
