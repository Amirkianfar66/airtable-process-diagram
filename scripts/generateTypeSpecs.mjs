// scripts/generateTypeSpecs.mjs
// Generates data-driven JSON 3D specs for TypeShapeRuntime → public/type-specs/*.json
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ---------- helpers ----------
const PI = Math.PI;

function normKey(s = "") {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/\(.+?\)/g, "")
    .replace(/[\/]/g, " ")
    .replace(/&/g, " and ")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/_+$/g, "");
}

const box = (args, { position, rotation, ...mat } = {}) => {
  const n = { type: "box", args: [...args] };
  if (position) n.position = [...position];
  if (rotation) n.rotation = [...rotation];
  return Object.assign(n, mat);
};

const rbox = (args, { radius = 3, position, rotation, ...mat } = {}) => {
  const n = { type: "roundedBox", args: [...args], radius };
  if (position) n.position = [...position];
  if (rotation) n.rotation = [...rotation];
  return Object.assign(n, mat);
};

const cyl = (args, { position, rotation, ...mat } = {}) => {
  const n = { type: "cylinder", args: [...args] };
  if (position) n.position = [...position];
  if (rotation) n.rotation = [...rotation];
  return Object.assign(n, mat);
};

const sph = (args, { position, rotation, ...mat } = {}) => {
  const n = { type: "sphere", args: [...args] };
  if (position) n.position = [...position];
  if (rotation) n.rotation = [...rotation];
  return Object.assign(n, mat);
};

const tor = (args, { position, rotation, ...mat } = {}) => {
  const n = { type: "torus", args: [...args] };
  if (position) n.position = [...position];
  if (rotation) n.rotation = [...rotation];
  return Object.assign(n, mat);
};

const group = (children, { position, rotation, deg = false } = {}) => {
  const g = { type: "group", children };
  if (position) g.position = [...position];
  if (rotation) g.rotation = [...rotation];
  if (deg) g.deg = true;
  return g;
};

// convenience bits
const inlinePipe = (L = 80, R = 12, color) =>
  cyl([R, R, L, 24], { rotation: [0, 0, PI / 2], ...(color ? { color } : {}) });

const disk = (radius = 20, thick = 4, color) =>
  cyl([radius, radius, thick, 24], { ...(color ? { color } : {}) });

const handwheel = (radius = 16, tube = 2, opts = {}) =>
  tor([radius, tube, 12, 24], opts);

const stem = (h = 30, r = 2, opts = {}) =>
  cyl([r, r, h, 16], Object.assign({ position: [0, h / 2, 0], color: "#666" }, opts));

const actuatorDome = (r = 10, opts = {}) =>
  sph([r, 24, 16], Object.assign({ position: [0, r + 15, 0], color: "#7c9cff" }, opts));

const valveBody = (L = 40, D = 24, color = "#888") =>
  group([
    inlinePipe(L, D * 0.4, color),
    cyl([D * 0.5, D * 0.5, 22, 24], { position: [0, 0, 0], color }),
  ]);

const gauge = (pos = [0, 18, 0]) =>
  group(
    [
      cyl([1.5, 1.5, 14, 12], { position: [0, 7, 0], color: "#666" }),
      tor([6, 1.2, 12, 24], { position: [0, 14, 0], color: "#ddd" }),
    ],
    { position: pos }
  );

// ---------- library ----------
const specs = {};
const save = (name, spec) => (specs[normKey(name)] = spec);

// ---- Piping fittings / specials ----
save("Manifold", group([
  inlinePipe(120, 10, "#8f8"),
  cyl([8,8,40,20], { rotation: [0, PI/2, 0], position: [-30,0,0], color:"#8f8" }),
  cyl([8,8,40,20], { rotation: [0, PI/2, 0], position: [  0,0,0], color:"#8f8" }),
  cyl([8,8,40,20], { rotation: [0, PI/2, 0], position: [ 30,0,0], color:"#8f8" }),
]));

save("ELBOW", group([
  inlinePipe(40,10,"#aaa"),
  group([inlinePipe(40,10,"#aaa")], { rotation:[0,PI/2,0], position:[20,0,20] })
]));

save("UNION", group([
  inlinePipe(60,10,"#aaa"),
  cyl([14,14,16,24], { color:"#bbb" }),
  cyl([12,12,10,24], { color:"#888" }),
]));

save("REDUCER", group([
  inlinePipe(30,12,"#aaa"),
  cyl([12,8,30,24], { rotation:[0,0,PI/2], color:"#aaa" }),
  group([inlinePipe(30,8,"#aaa")], { position:[30,0,0] })
]));

save("BRANCH", group([
  inlinePipe(100,10,"#aaa"),
  cyl([8,8,50,16], { rotation:[0,PI/2,0], color:"#aaa" })
]));

save("BLIND FLANGE", group([ disk(18,6,"#777") ]));

save("FLANGE", group([
  disk(18,4,"#777"),
  tor([14,1.2,12,24], { color:"#999" })
]));

save("WYE", group([
  inlinePipe(60,10,"#aaa"),
  group([inlinePipe(40,8,"#aaa")], { rotation:[0, PI/4, 0], position:[10,0,10] })
]));

save("TEE", group([
  inlinePipe(100,10,"#aaa"),
  cyl([8,8,50,16], { rotation:[0,PI/2,0], color:"#aaa" })
]));

save("PLUG", group([ disk(10,8,"#666") ]));

save("CAP", group([
  sph([12,24,16], { color:"#666" }),
  cyl([12,12,4,24], { position:[0,-6,0], color:"#666" })
]));

save("SPECTACLE BLANK WITH FLANGES", group([
  disk(16,4,"#777"),
  disk(16,4,"#777",),
  box([32,2,2], { position:[16,0,0], color:"#777" })
]));

save("SPACER WITH FLANGES", group([
  disk(16,4,"#777"),
  cyl([12,12,12,24], { color:"#888" }),
  disk(16,4,"#777"),
]));

save("Hose Connection", group([
  inlinePipe(40,8,"#aaa"),
  cyl([10,10,10,16], { color:"#888" }),
  cyl([8,8,16,16], { position:[0,0,13], color:"#aaa" }),
  tor([10,1,12,24], { position:[0,0,18], color:"#ccc" }),
]));

save("CONE STRAINER", group([
  inlinePipe(80,10,"#aaa"),
  cyl([0.1,10,30,24], { rotation:[0,0,PI/2], position:[10,0,0], color:"#99c" })
]));

save("BASKET STRAINER", group([
  inlinePipe(80,10,"#aaa"),
  rbox([30,24,24], { radius:2, color:"#99c" })
]));

save("FLAME ARRESTER", group([
  inlinePipe(50,10,"#aaa"),
  rbox([26,26,26], { radius:3, color:"#f59e0b" }),
  tor([10,2,12,24], { position:[0,16,0], color:"#f59e0b" })
]));

save("DETONATION ARRESTER", group([
  inlinePipe(60,10,"#aaa"),
  rbox([34,26,26], { radius:2, color:"#ef4444" }),
  tor([12,2,12,24], { position:[0,18,0], color:"#ef4444" })
]));

save("STEAM TRAP", group([
  inlinePipe(40,8,"#aaa"),
  cyl([10,10,20,16], { color:"#888" }),
  sph([8,24,16], { position:[0,12,0], color:"#888" })
]));

save("Vent SILENCER", group([
  cyl([10,10,20,16], { color:"#999" }),
  sph([10,24,16], { position:[0,10,0], color:"#bbb" })
]));

save("ANTO FOULING SYATEM", group([
  rbox([40,18,24], { radius:2, color:"#7dd3fc" }),
  tor([10,1.5,12,24], { position:[-12,12,0], color:"#38bdf8" }),
  tor([10,1.5,12,24], { position:[ 12,12,0], color:"#38bdf8" }),
]));

// ---- Valves ----
const valveWithHandwheel = () =>
  group([valveBody(), stem(), handwheel(16,2,{rotation:[PI/2,0,0], position:[0,26,0]})]);

save("Ball Valve", group([ valveBody(), sph([10,24,16], { color:"#ccc" }) ]));
save("Check Valve", group([ valveBody(), rbox([18,6,24], { radius:1, color:"#bbb" }) ]));
save("Butterfly Valve", group([ valveBody(), rbox([28,2,28], { radius:1, rotation:[0,PI/2,0], color:"#bbb" }) ]));
save("Gate Valve", valveWithHandwheel());
save("Control Valve", group([ valveBody(), actuatorDome() ]));
save("Globe Valve", group([ valveBody(), sph([8,24,16], { color:"#aaa" }), handwheel(16,2,{rotation:[PI/2,0,0], position:[0,22,0]}) ]));
save("Knife Valve", group([ valveBody(), rbox([28,2,24], { radius:0.5, color:"#aaa" }) ]));
save("Relief Valve", group([
  inlinePipe(30,8,"#aaa"),
  cyl([10,10,20,16], { color:"#888" }),
  cyl([6,4,26,16], { rotation:[0,0,PI/2], position:[6,12,0], color:"#888" }),
]));
save("Plug Valve", group([ valveBody(), cyl([10,12,18,16], { color:"#bbb" }) ]));
save("Needle Valve", group([ valveBody(), cyl([2,0.5,18,16], { position:[0,10,0], color:"#bbb" }) ]));
save("Pinch Valve", group([ inlinePipe(40,10,"#aaa"), rbox([26,20,24], { radius:2, color:"#bbb" }) ]));
save("Rotary Valve", group([ rbox([34,26,26], { radius:2, color:"#bbb" }), cyl([10,10,50,16], { rotation:[0,PI/2,0], color:"#bbb" }) ]));
save("Threeway Valve", group([ valveBody(), cyl([8,8,40,16], { rotation:[0,PI/2,0], color:"#888" }) ]));
save("Angle Valve", group([
  inlinePipe(40,10,"#aaa"),
  group([inlinePipe(40,10,"#aaa")], { rotation:[0,PI/2,0], position:[20,0,20] }),
  handwheel(16,2,{rotation:[PI/2,0,0], position:[10,20,10]})
]));
save("Solenoid-valve", group([
  valveBody(),
  box([14,14,14], { position:[0,12,0], color:"#111" }),
  cyl([3,3,10,12], { position:[0,18,0], color:"#111" }),
]));
save("Pressure-relief valve", specs[normKey("Relief Valve")]);

// ---- Instruments ----
save("PRESSURE TRANSMITTER", group([
  cyl([3,3,20,12], { position:[0,10,0], color:"#666" }),
  rbox([16,16,10], { radius:2, position:[0,20,0], color:"#2563eb" }),
]));
save("TEMPERATURE TRANSMITTER", group([
  cyl([2,2,26,12], { position:[0,13,0], color:"#666" }),
  rbox([16,16,10], { radius:2, position:[0,26,0], color:"#9333ea" }),
]));
save("PH PROBE SENSOR", group([
  cyl([1.5,1.5,30,12], { position:[0,15,0], color:"#0ea5e9" }),
  sph([2,16,12], { position:[0,30,0], color:"#22d3ee" }),
]));
save("O2 DETECTION SENSOR", group([
  rbox([16,16,10], { radius:2, color:"#16a34a" }),
  tor([6,1,12,24], { position:[0,10,0], color:"#22c55e" }),
]));
save("TURBIDITY ANALYZER PROBE", group([
  cyl([2,2,30,12], { position:[0,15,0], color:"#64748b" }),
  box([8,8,8], { position:[0,26,0], color:"#94a3b8" }),
]));
save("ETG GAS ANALYZER", group([
  rbox([30,18,20], { radius:3, color:"#14b8a6" }),
  box([10,10,6], { position:[-12,5,0], color:"#0d9488" }),
]));
save("LEVEL TRANSMITTER", group([
  cyl([3,3,24,12], { position:[0,12,0], color:"#666" }),
  sph([6,16,12], { position:[0,24,0], color:"#60a5fa" }),
]));
save("WEIGHTING SENSOR", group([
  rbox([18,8,12], { radius:2, color:"#94a3b8" }),
  cyl([2,2,12,12], { position:[0,-6,0], color:"#64748b" }),
]));
save("Vibration Sensor", group([
  rbox([12,12,8], { radius:2, color:"#ef4444" }),
  cyl([2,2,10,12], { position:[0,5,0], color:"#ef4444" }),
]));
save("Suspended Solids Sensor", group([
  rbox([14,14,10], { radius:2, color:"#475569" }),
  cyl([2,2,16,12], { position:[0,8,0], color:"#94a3b8" }),
]));
save("Rotation sensor", group([
  rbox([14,14,10], { radius:2, color:"#0ea5e9" }),
  tor([6,1,12,24], { position:[0,10,0], color:"#38bdf8" }),
]));
save("Salinity Sensor", group([
  rbox([16,16,10], { radius:2, color:"#06b6d4" }),
  cyl([2,2,18,12], { position:[0,9,0], color:"#0891b2" }),
]));
save("Positon switch sensor", group([
  rbox([14,14,10], { radius:2, color:"#16a34a" }),
  box([8,4,4], { position:[0,8,0], color:"#22c55e" }),
]));
save("Flow Transmitter", group([
  inlinePipe(40,8,"#aaa"),
  rbox([20,20,14], { radius:2, color:"#0ea5e9" }),
]));
save("Pressure Gauge", gauge());

// ---- Equipment & process ----
save("BIG BAG DISCHARGER", group([
  rbox([60,8,60], { radius:2, position:[0,-20,0], color:"#334155" }),
  cyl([2,2,40,10], { position:[-26,-10, 26], color:"#64748b" }),
  cyl([2,2,40,10], { position:[ 26,-10, 26], color:"#64748b" }),
  cyl([2,2,40,10], { position:[-26,-10,-26], color:"#64748b" }),
  cyl([2,2,40,10], { position:[ 26,-10,-26], color:"#64748b" }),
  cyl([20,10,30,16], { position:[0,-10,0], color:"#94a3b8" }),
]));

save("SCREW CONVEYOR", group([
  rbox([120,14,20], { radius:2, color:"#94a3b8" }),
  cyl([10,10,120,16], { rotation:[0,PI/2,0], color:"#64748b" }),
]));

save("BUCKET ELEVATOR", group([
  rbox([30,120,24], { radius:2, color:"#94a3b8" }),
  box([20,10,8], { position:[0,-40,12], color:"#64748b" }),
  box([20,10,8], { position:[0, 40,12], color:"#64748b" }),
]));

save("FFD Motor", group([
  rbox([34,26,26], { radius:3, color:"#475569" }),
  cyl([6,6,20,16], { rotation:[0,PI/2,0], color:"#475569" }),
]));
save("VFD Motor", specs[normKey("FFD Motor")]);

save("WeighHopper", group([
  rbox([40,8,40], { radius:2, position:[0,18,0], color:"#94a3b8" }),
  cyl([20,4,30,16], { position:[0,-2,0], color:"#64748b" }),
]));

save("Vibrating Hopper", group([
  rbox([40,8,40], { radius:2, position:[0,20,0], color:"#94a3b8" }),
  box([30,12,30], { color:"#64748b" }),
]));

save("FLUIDIZEDCONE", group([
  cyl([0.1,24,40,24], { color:"#94a3b8" }),
  inlinePipe(40,6,"#94a3b8"),
]));

save("VFD", group([
  rbox([26,34,10], { radius:2, color:"#111827" }),
  box([16,10,2], { position:[0,6,6], color:"#1f2937" }),
]));

save("FABRICFILTER", group([
  rbox([60,60,40], { radius:3, color:"#94a3b8" }),
  cyl([6,6,30,16], { position:[-18,-30,0], color:"#64748b" }),
  cyl([6,6,30,16], { position:[ 18,-30,0], color:"#64748b" }),
]));

save("HeatingCoil", group([
  rbox([60,10,40], { radius:2, color:"#ef4444" }),
  tor([12,1.5,12,24], { position:[-18,6,0], color:"#ef4444" }),
  tor([12,1.5,12,24], { position:[  0,6,0], color:"#ef4444" }),
  tor([12,1.5,12,24], { position:[ 18,6,0], color:"#ef4444" }),
]));

save("PNEUMATICPISTON", group([
  cyl([6,6,30,16], { color:"#6b7280" }),
  cyl([2,2,26,12], { position:[0,15,0], color:"#94a3b8" }),
]));

save("Calciner", group([
  cyl([30,30,140,32], { color:"#a3a3a3" }),
  cyl([20,0.1,24,24], { position:[0,-70,0], color:"#a3a3a3" }),
]));

save("Hydrator", group([
  cyl([26,26,80,24], { color:"#60a5fa" }),
  sph([14,24,16], { position:[0,40,0], color:"#93c5fd" }),
]));

save("FLAT-BLADE PADDLE AGITATOR", group([
  cyl([18,18,40,16], { color:"#94a3b8" }),
  cyl([2,2,30,12], { position:[0,30,0], color:"#94a3b8" }),
  box([2,12,36], { position:[0,15,0], color:"#64748b" }),
]));

save("CSTR REACTOR", group([
  sph([30,24,16], { color:"#60a5fa" }),
  cyl([2,2,36,12], { position:[0,18,0], color:"#94a3b8" }),
  box([2,10,24], { position:[0,6,0], color:"#94a3b8" }),
]));

save("HORIZONTAL CENTRIFUGAL PUMP", group([
  cyl([20,20,50,24], { color:"#3b82f6" }),
  box([50,20,24], { position:[0,20,0], color:"#3b82f6" }),
  cyl([6,6,60,16], { rotation:[0,0,PI/2], color:"#3b82f6" }),
  cyl([6,6,60,16], { rotation:[0,PI/2,0], color:"#3b82f6" }),
]));

save("BLADE AGITATOR", group([
  cyl([18,18,30,16], { color:"#94a3b8" }),
  cyl([2,2,30,12], { position:[0,30,0], color:"#94a3b8" }),
  box([2,10,28], { position:[0,15,0], color:"#64748b" }),
  box([28,10,2], { position:[0,15,0], color:"#64748b" }),
]));

save("DOUBLE WALL TANK", group([
  cyl([36,36,90,24], { color:"#22c55e" }),
  cyl([32,32,90,24], { color:"#86efac" }),
  sph([36,24,16], { position:[0,45,0], color:"#22c55e" }),
]));

save("VESSEL", group([
  cyl([30,30,90,24], { color:"#22c55e" }),
  sph([30,24,16], { position:[0,45,0], color:"#22c55e" }),
]));

save("RECIPROCATING COMPRESSOR", group([
  rbox([80,30,30], { radius:4, color:"#059669" }),
  cyl([10,10,30,16], { rotation:[0,PI/2,0], position:[-30,0,0], color:"#10b981" }),
  cyl([10,10,30,16], { rotation:[0,PI/2,0], position:[ 30,0,0], color:"#10b981" }),
]));

save("SPHERE", group([ sph([40,32,24], { color:"#eab308" }) ]));

save("CONDESATE DUST FILTER", group([
  rbox([40,60,30], { radius:3, color:"#94a3b8" }),
  cyl([10,10,30,16], { position:[0,-30,0], color:"#64748b" }),
]));

save("DOME ROOF TANK", group([
  cyl([40,40,90,24], { color:"#22c55e" }),
  sph([40,24,16], { position:[0,45,0], color:"#16a34a" }),
]));

save("STATIC MIXER", group([
  inlinePipe(120,10,"#aaa"),
  box([6,2,20], { position:[-30,0,0], color:"#bbb" }),
  box([6,2,20], { position:[  0,0,0], color:"#bbb" }),
  box([6,2,20], { position:[ 30,0,0], color:"#bbb" }),
]));

save("SEAWATERFILTER", group([
  rbox([50,30,30], { radius:3, color:"#38bdf8" }),
  cyl([8,8,30,16], { position:[-25,0,0], color:"#38bdf8" }),
  cyl([8,8,30,16], { position:[ 25,0,0], color:"#38bdf8" }),
]));

save("Tubular reactor", group([ inlinePipe(160,12,"#60a5fa") ]));

save("ROSYSTEM Filter", group([
  inlinePipe(160,10,"#06b6d4"),
  rbox([40,16,20], { radius:2, position:[0,10,0], color:"#0891b2" }),
]));

save("Heat EXCHANGER PLATE AND FRAME", group([
  group(new Array(10).fill(0).map((_,i)=> box([2,40,24], { position:[i*3-15,0,0], color:"#ef4444" })))
]));

save("Gas Air Filter", group([
  rbox([40,40,20], { radius:2, color:"#94a3b8" }),
  tor([12,1.5,12,24], { position:[0,24,0], color:"#64748b" }),
]));

save("Calciner Dischager", group([
  cyl([20,0.1,24,24], { color:"#a3a3a3" }),
  inlinePipe(40,6,"#a3a3a3"),
]));

save("Anti  Fouling", specs[normKey("ANTO FOULING SYATEM")]);

// ---- Generic categories / aliases (map to the shapes above) ----
save("Valve", specs[normKey("Gate Valve")]);
save("Instrument General", group([ rbox([20,16,10], { radius:2, color:"#0ea5e9" }) ]));
save("Equipment Tank", specs[normKey("VESSEL")]);
save("Plant/System", group([ rbox([80,10,80], { radius:4, color:"#9ca3af" }) ]));
save("Equipment", group([ rbox([40,20,40], { radius:4, color:"#9ca3af" }) ]));
save("Structure", group([ rbox([80,10,80], { radius:2, color:"#64748b" }) ]));
save("Duct", group([ rbox([80,20,20], { radius:2, color:"#94a3b8" }) ]));
save("Instrument", specs[normKey("PRESSURE TRANSMITTER")]);
save("Pipe", inlinePipe(120,10,"#aaa"));
save("Inline Valve", specs[normKey("Butterfly Valve")]);
save("General", group([ rbox([30,20,30], { radius:2, color:"#9ca3af" }) ]));

save("silo", group([
  cyl([40,40,120,24], { color:"#c4b5fd" }),
  cyl([0.1,20,30,16], { position:[0,-60,0], color:"#a78bfa" }),
]));
save("U2530", group([ rbox([30,30,30], { radius:3, color:"#9ca3af" }) ]));

save("Tank", specs[normKey("VESSEL")]);
save("Blower", group([
  cyl([30,30,16,24], { color:"#38bdf8" }),
  tor([26,6,12,24], { color:"#0ea5e9" }),
]));
save("Heat-Exchanger", group([
  rbox([80,24,24], { radius:3, color:"#ef4444" }),
  cyl([4,4,80,16], { rotation:[0,0,PI/2], color:"#ef4444" }),
]));
save("Compressor", group([ rbox([80,30,30], { radius:4, color:"#10b981" }) ]));
save("Filter", group([ rbox([40,40,20], { radius:3, color:"#94a3b8" }) ]));
save("Conveyor", specs[normKey("SCREW CONVEYOR")]);
save("Furnace", group([ rbox([60,50,40], { radius:3, color:"#dc2626" }) ]));
save("Driver", group([ rbox([60,30,30], { radius:6, color:"#475569" }) ]));
save("Mixer", specs[normKey("STATIC MIXER")]);
save("Reactor", specs[normKey("CSTR REACTOR")]);
save("Cone-strainer", specs[normKey("CONE STRAINER")]);
save("Basket-strainer", specs[normKey("BASKET STRAINER")]);
save("Flame-arrestor", specs[normKey("FLAME ARRESTER")]);
save("Inline-silencer", specs[normKey("Vent SILENCER")]);
save("Detonation-arrestor", specs[normKey("DETONATION ARRESTER")]);
save("Expansion-joint", group([
  inlinePipe(60,10,"#aaa"),
  tor([10,1,12,24], { position:[-10,0,0], color:"#999" }),
  tor([10,1,12,24], { position:[  0,0,0], color:"#999" }),
  tor([10,1,12,24], { position:[ 10,0,0], color:"#999" }),
]));
save("Inline-mixer", specs[normKey("STATIC MIXER")]);
save("Damper", group([
  rbox([60,30,20], { radius:2, color:"#94a3b8" }),
  box([2,28,18], { color:"#64748b" }),
]));
save("Blower-centrifugal", specs[normKey("Blower")]);
save("Blower-displacement", group([
  rbox([60,30,30], { radius:3, color:"#38bdf8" }),
  cyl([12,12,30,16], { rotation:[0,PI/2,0], position:[-15,0,0], color:"#0ea5e9" }),
  cyl([12,12,30,16], { rotation:[0,PI/2,0], position:[ 15,0,0], color:"#0ea5e9" }),
]));
save("Compressor-centrifugal", group([
  rbox([80,30,30], { radius:4, color:"#10b981" }),
  tor([26,6,12,24], { color:"#059669" }),
]));
save("Compressor-reciprocating", specs[normKey("RECIPROCATING COMPRESSOR")]);
save("Compressor-screw", group([
  rbox([80,30,30], { radius:4, color:"#10b981" }),
  cyl([10,10,40,16], { rotation:[0,PI/2,0], position:[-20,0,0], color:"#059669" }),
  cyl([10,10,40,16], { rotation:[0,PI/2,0], position:[ 20,0,0], color:"#059669" }),
]));
save("Conveyor screw", specs[normKey("SCREW CONVEYOR")]);
save("Conveyor-vibrating", group([
  rbox([120,14,20], { radius:2, color:"#94a3b8" }),
  box([110,4,12], { position:[0,6,0], color:"#64748b" }),
]));
save("Conveyor-belt", group([
  rbox([140,10,24], { radius:2, color:"#94a3b8" }),
  cyl([10,10,24,16], { position:[-60,-5,0], color:"#64748b" }),
  cyl([10,10,24,16], { position:[ 60,-5,0], color:"#64748b" }),
]));

// ---------- write files ----------
const outDir = join(process.cwd(), "public", "type-specs");
mkdirSync(outDir, { recursive: true });
for (const [key, spec] of Object.entries(specs)) {
  writeFileSync(join(outDir, `${key}.json`), JSON.stringify(spec, null, 2));
}
console.log(`Wrote ${Object.keys(specs).length} specs to ${outDir}`);
