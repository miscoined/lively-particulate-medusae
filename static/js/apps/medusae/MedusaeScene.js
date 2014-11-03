var DEBUG_WIRE = true;

var PTCL = Particulate;
var GEOM = App.Geometry;
var LINKS = App.Links;
var FACES = App.Faces;

var Vec3 = PTCL.Vec3;
var PointConstraint = PTCL.PointConstraint;
var DistanceConstraint = PTCL.DistanceConstraint;
var AngleConstraint = PTCL.AngleConstraint;
var AxisConstraint = PTCL.AxisConstraint;

var sin = Math.sin;
var cos = Math.cos;
var tan = Math.tan;
var log = Math.log;
var floor = Math.floor;
var PI = Math.PI;
var GRAVITY = -0.001;

var _push = Array.prototype.push;

var gravityForce = PTCL.DirectionalForce.create();

// Medusae geometry
// ---------------

function Medusae() {
  this.segments = 3 * 9;
  this.ribsCount = 20;
  this.size = 20;

  this._queuedConstraints = [];
  this.verts = [];
  this.links = [];
  this.faces = [];

  this.ribs = [];
  this.skins = [];

  this._membraneIndices = [];

  this.createGeometry();
  this.createSystem();
  this.createMaterials();
}

Medusae.prototype.createGeometry = function () {
  var ribsCount = this.ribsCount;

  this.createCore();

  for (var i = 0; i < ribsCount; i ++) {
    this.createRib(i, ribsCount);
    if (i > 0) {
      this.createSkin(i - 1, i);
    }
  }

  for (var j = 0; j < 3; j ++) {
    this.createTail(j, 5);
  }

  // this.createMembrane();
};

function spineAngleIndices(a, b, start, howMany) {
  var indices = [];
  for (var i = 0; i < howMany; i ++) {
    indices.push(a, b, start + i);
  }
  return indices;
}

Medusae.prototype.createCore = function () {
  var verts = this.verts;
  var segments = this.segments;
  var ribsCount = this.ribsCount;
  var size = this.size;

  GEOM.point(0, 0, size, verts);
  GEOM.point(0, 0, 0, verts);
  GEOM.point(0, 0, 0, verts);

  var spine = DistanceConstraint.create([20, size], [0, 2]);
  var axis = AxisConstraint.create(0, 1, 2);

  var topStart = 3;
  var bottomStart = segments * (ribsCount - 1) + 3;
  var topAngle = AngleConstraint.create([PI * 0.35, PI * 0.65],
    spineAngleIndices(1, 0, topStart, segments));
  var bottomAngle = AngleConstraint.create([PI * 0.45, PI * 0.65],
    spineAngleIndices(0, 2, bottomStart, segments));

  this.queueConstraints(spine, axis);
  this.queueConstraints(topAngle, bottomAngle);

  this.addLinks(spine.indices);

  FACES.radial(0, topStart, segments, this.faces);

  this.core = {};
};

function ribRadius(t) {
  // return sin(PI - PI * 0.55 * t * 1.5);
  return sin(PI - PI * 0.55 * t * 1.8) + log(t * 100 + 2) / 3;
}

function innerRibIndices(offset, start, segments, buffer) {
  var step = floor(segments / 3);
  var a, b;
  for (var i = 0; i < 3; i ++) {
    a = offset + step * i;
    b = offset + step * (i + 1);

    buffer.push(
      start + a % segments,
      start + b % segments);
  }
  return buffer;
}

Medusae.prototype.createRib = function (index, total) {
  var segments = this.segments;
  var verts = this.verts;
  var size = this.size;
  var yPos = size - (index / total) * size;

  var start = index * segments + 3;
  var radiusT = ribRadius(index / total);
  var radius = radiusT * 10 + 0.5;

  GEOM.circle(segments, radius, yPos, verts);

  var ribIndices = LINKS.loop(start, segments, []);
  var ribLen = 2 * PI * radius / segments;
  // var ribLen = Vec3.distance(this.verts, ribIndices[0], ribIndices[1]);
  var rib = DistanceConstraint.create([ribLen * 0.9, ribLen], ribIndices);

  // TODO: Parmeterize sub-structure divisions
  var innerIndices = [];
  innerRibIndices(0, start, segments, innerIndices);
  innerRibIndices(3, start, segments, innerIndices);
  innerRibIndices(6, start, segments, innerIndices);

  var innerRibLen = 2 * PI * radius / 3;
  // var innerRibLen = Vec3.distance(this.verts, innerIndices[0], innerIndices[1]);
  var innerRib = DistanceConstraint.create([innerRibLen * 0.8, innerRibLen], innerIndices);

  // Push membrane angle indices
  LINKS.loop3(start, segments, this._membraneIndices);

  var spine, spineCenter;
  if (index === 0 || index === total - 1) {
    spineCenter = index === 0 ? 0 : 2;
    spine = DistanceConstraint.create([radius * 0.8, radius],
      LINKS.radial(spineCenter, start, segments, []));

    this.queueConstraints(spine);
    if (index === 0) {
      this.addLinks(spine.indices);
    }
  }

  this.queueConstraints(rib, innerRib);
  // this.addLinks(rib.indices);
  // this.addLinks(innerRib.indices);

  this.ribs.push({
    start : start,
    radius : radius
  });
};

Medusae.prototype.createSkin = function (r0, r1) {
  var segments = this.segments;
  var rib0 = this.ribs[r0];
  var rib1 = this.ribs[r1];

  var dist = Vec3.distance(this.verts, rib0.start, rib1.start);
  var skin = DistanceConstraint.create([dist * 0.5, dist],
    LINKS.rings(rib0.start, rib1.start, segments, []));

  this.queueConstraints(skin);
  this.addLinks(skin.indices);

  FACES.rings(rib0.start, rib1.start, segments, this.faces);

  this.skins.push({
    a : r0,
    b : r1
  });
};

Medusae.prototype.createMembrane = function () {
  var segments = this.segments;
  var angle = (segments - 2) * PI / segments;
  var membrane = AngleConstraint.create([angle * 0.8, angle * 1.1], this._membraneIndices);

  this.queueConstraints(membrane);
};

Medusae.prototype.createTail = function (index, total) {
  var size = this.size;
  var segments = 50;
  var innerSize = 0.5;
  var outerSize = innerSize * 1.8;
  var linkSizeScale = 18;

  var verts = this.verts;
  var innerStart = verts.length / 3;
  var outerStart = innerStart + segments;
  var innerIndices = LINKS.line(innerStart, segments, [0, innerStart]);
  var outerIndices = LINKS.line(outerStart, segments, []);

  var linkConstraints = [];
  var linkIndices = [];
  var linkSize;

  for (var i = 0; i < segments; i ++) {
    GEOM.point(0, size - i * innerSize, 0, verts);
  }

  var angle = Math.PI * 2 * index / (total - 1);
  var outerX, outerZ;

  for (i = 0; i < segments; i ++) {
    linkSize = sin(i / (segments - 1) * PI * 0.8);
    outerX = cos(angle) * linkSize;
    outerZ = sin(angle) * linkSize;

    GEOM.point(outerX, size - i * outerSize, outerZ, verts);

    linkIndices.push(innerStart + i, outerStart + i);
    linkConstraints.push(DistanceConstraint.create(
      linkSize * linkSizeScale,
      innerStart + i, outerStart + i));
  }

  var inner = DistanceConstraint.create([innerSize * 0.5, innerSize * 2], innerIndices);
  var outer = DistanceConstraint.create([outerSize * 0.5, outerSize * 2], outerIndices);
  var axis = AxisConstraint.create(0, 1, innerIndices);

  this.queueConstraints(inner, outer, axis);
  this.queueConstraints(linkConstraints);

  // this.addLinks(innerIndices);
  this.addLinks(outerIndices);
  this.addLinks(linkIndices);
};

Medusae.prototype.queueConstraint = function (constraint) {
  this._queuedConstraints.push(constraint);
};

Medusae.prototype.queueConstraints = function (constraints) {
  _push.apply(this._queuedConstraints, constraints.length ? constraints : arguments);
};

Medusae.prototype.createSystem = function () {
  var queuedConstraints = this._queuedConstraints;
  var system = this.system = PTCL.ParticleSystem.create(this.verts, 2);
  this.verts = this.system.positions;

  for (var i = 0, il = queuedConstraints.length; i < il; i ++) {
    system.addConstraint(queuedConstraints[i]);
  }

  system.setWeight(0, 0);
  system.setWeight(1, 0);
  system.addPinConstraint(PointConstraint.create([0, this.size, 0], 0));
  system.addPinConstraint(PointConstraint.create([0, 0, 0], 1));

  system.addForce(gravityForce);
};

Medusae.prototype.addLinks = function (indices) {
  _push.apply(this.links, indices);
};

Medusae.prototype.addFaces = function (faceIndices) {
  _push.apply(this.faces, faceIndices);
};

Medusae.prototype.createMaterials = function () {
  var vertices = new THREE.BufferAttribute();
  vertices.array = this.verts;
  vertices.itemSize = 3;

  var indices = new THREE.BufferAttribute();
  indices.array = new Uint16Array(this.links);

  // Particles
  var dotsGeom = new THREE.BufferGeometry();
  dotsGeom.addAttribute('position', vertices);

  this.dots = new THREE.ParticleSystem(dotsGeom,
    new THREE.ParticleSystemMaterial({size: 2}));

  // Connections
  var linesGeom = new THREE.BufferGeometry();
  linesGeom.addAttribute('position', vertices);
  linesGeom.addAttribute('index', indices);

  this.lines = new THREE.Line(linesGeom,
    new THREE.LineBasicMaterial({
      color : 0xffffff,
      transparent : true,
      blending: THREE.AdditiveBlending,
      opacity : 0.25,
      depthTest : !DEBUG_WIRE
    }));
  this.lines.scale.multiplyScalar(1.1);

  // Faces
  var faceGeom = new THREE.BufferGeometry();
  var faceIndices = new THREE.BufferAttribute();
  faceIndices.array = new Uint16Array(this.faces);
  faceGeom.addAttribute('position', vertices);
  faceGeom.addAttribute('index', faceIndices);
  faceGeom.computeVertexNormals();

  this.skinMesh = new THREE.Mesh(faceGeom,
    new THREE.MeshLambertMaterial({
      color : 0x411991,
      emissive : 0x0f0a19,
      shading : THREE.FlatShading,
      // transparent : true,
      // blending : THREE.AdditiveBlending,
      // opacity : 0.25,
      // side : THREE.DoubleSide
    }));

  this.innerMesh = new THREE.Mesh(faceGeom,
    new THREE.MeshLambertMaterial({
      color : 0x4d1442,
      emissive : 0x240e20,
      // ambient : 0x84146e,
      shading : THREE.FlatShading,
      side : THREE.BackSide
    }));
  this.innerMesh.scale.multiplyScalar(0.8);

  this.positionAttr = dotsGeom.attributes.position;

  // var indicesDotted = new THREE.BufferAttribute();
  // indicesDotted.array = new Uint16Array(dottedLineIndices);

  // var distancesDotted = new THREE.BufferAttribute();
  // distancesDotted.array = uniformFloatArray(vertices.length / 3, 30);
  // distancesDotted.array[0] = 0;
  // distancesDotted.itemSize = 1;

  // var linesDotted = new THREE.BufferGeometry();
  // linesDotted.addAttribute('position', vertices);
  // linesDotted.addAttribute('index', indicesDotted);
  // linesDotted.addAttribute('lineDistance', distancesDotted);

  // var visConnectorsDots = new THREE.Line(linesDotted,
  //   new THREE.LineDashedMaterial({
  //     linewidth : 1,
  //     dashSize : 0.5,
  //     gapSize : 3
  //   }), THREE.LinePieces);
};

Medusae.prototype.addTo = function (scene) {
  // scene.add(this.dots);
  scene.add(this.lines);
  scene.add(this.skinMesh);
  scene.add(this.innerMesh);
};

// Medusae.prototype.updateCore = function (delta) {
//   var t = sin(delta * 0.01) * 0.5 + 0.5;
//   var radius = t * 10 + 15;
//   this.core.bottom.setDistance(radius * 0.7, radius);
// };

Medusae.prototype.update = function (delta) {
  // this.updateCore(delta);
  this.system.tick(1);
  this.positionAttr.needsUpdate = true;
};

var medusae = new Medusae();

// Visualization
// -------------

var demo = PTCL.DemoScene.create();
demo.camera.position.set(200, 100, 0);

// var ambient = new THREE.AmbientLight(0xffffff);
// demo.scene.add(ambient);

var light = new THREE.PointLight(0xffffff, 1, 0);
light.position.set(200, 100, 0);
demo.scene.add(light);

// Medusae
medusae.addTo(demo.scene);

// Bounds
// var box = new THREE.Mesh(
//   new THREE.BoxGeometry(200, 200, 200, 1, 1, 1),
//   new THREE.MeshBasicMaterial({
//     wireframe : true
//   }));
// demo.scene.add(box);

var up = demo.controls.object.up;
// var animateFrame = 0;
demo.animate(function () {
  gravityForce.set(up.x * GRAVITY, up.y * GRAVITY, up.z * GRAVITY);
  medusae.update();
  demo.update();
  demo.render();
});
