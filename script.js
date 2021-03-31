onsole.clear();


TweenLite.defaultEase = Power1.easeInOut;

var xmlns   = "http://www.w3.org/2000/svg"; 
var log     = console.log.bind(console);
var select  = document.querySelector.bind(document);

var sidebar = select(".sidebar");
var slider  = select("#slider");
var canvas  = select("#canvas");
var clear   = select("#clear");
var table   = select("#table");
var smooth  = select("#smoothing");

function demo() {
        
  var count = 0;
  var paths = [];       
  var path  = null;
  var shape = new Spline({ stroke: "#cc0066", strokeWidth: 3 });
      
  var rebuild   = _.debounce(rebuildTimeline, 150); 
  //var timeline  = new TimelineMax({ repeat: -1, yoyo: true });     
  //var tolerance = getTolerance();
    
  var timeline  = new TimelineMax({ repeat: 0, yoyo: true });  
  var tolerance = 20;  
  
  clear.addEventListener("click", clearDoodles);
  //slider.addEventListener("input", updateTolerance);
  canvas.addEventListener("mousedown", startDrawing);           
  
  TweenLite.set("main", { autoAlpha: 1 });
  
  // START DRAWING =========================================================
  function startDrawing(event) {
            
    timeline.pause(0);
    shape.hide(true);
    count++;
       
    path = new Polyline({ stroke: "#cc0066" }, count);
    path.last = Point.parse(event);
    paths.push(path);
    
    sidebar.classList.add("drawing");    
    
    canvas.addEventListener("mousemove",  updateDrawing);
    canvas.addEventListener("mouseup",    stopDrawing); 
    canvas.addEventListener("mouseleave", stopDrawing); 
  }
  
  // UPDATE DRAWING ========================================================
  function updateDrawing(event) {    
    path.addPoint(Point.parse(event));
  }
  
  // STOP DRAWING ==========================================================
  function stopDrawing(event) {
        
    sidebar.classList.remove("drawing");    
    
    canvas.removeEventListener("mousemove",  updateDrawing);
    canvas.removeEventListener("mouseup",    stopDrawing);
    canvas.removeEventListener("mouseleave", stopDrawing); 
       
    path.simplify(tolerance);    
    shape.solve(path.reduced);
    
    animate();    
  }
  
  // ANIMATE ===============================================================
  function animate() {
    
    path.hide();
    shape.show();
             
    if (count === 1) {      
      
      shape.update();
      timeline.set(shape, { attr: { d: shape.path }});    
      
    } else {           
      //timeline.to(shape, 1, { morphSVG: shape.path }).play();   
      timeline.to(shape, 1, { morphSVG: {shape: shape.path, shapeIndex: 0 }}).play();   
    }    
  }
       
  // REBUILD TIMELINE ======================================================
  function rebuildTimeline() {
    
    timeline.pause(0).clear();
    shape.hide();
    tolerance = getTolerance();
        
    _.reduce(paths, (tween, path, index) => {           
      
      path.simplify(tolerance);
      shape.solve(path.reduced);
            
      if (!index) {        
        
        shape.update();
        timeline.set(shape, { attr: { d: shape.path }}); 
        
      } else {        
        timeline.to(shape, 1, { morphSVG: shape.path }).play(); 
      }      
      return tween;
    }, timeline);
    
    shape.show();
    timeline.play(0);
  }
    
  // GET TOLERANCE =========================================================
  function getTolerance() {
    
    var value = slider.value;
    smooth.textContent = value;
    return value;
  }
  
  // UPDATE TOLERANCE ======================================================
  function updateTolerance() {
    
    tolerance = getTolerance();
    timeline.pause();
    if (paths.length) rebuild();
  }
    
  // CLEAR DOODLES =========================================================
  function clearDoodles() {    
    
    timeline.pause(0).clear();
    shape.clear();    
    paths.forEach(path => path.destroy());
    paths = [];
    count = 0;
    //table.innerHTML = "";
  }
}

//
// POINT
// ========================================================================
class Point {
  
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  
  static parse(event) {
    return new Point(event.clientX, event.clientY);
  }
}

//
// VECTOR
// ========================================================================
class Vector {
 
  constructor(x = 0, y = 0) { 
    
    var point = x.x && x.y ? x : { x, y };
    this.x = point.x;
    this.y = point.y;
  }

  get magnitude() { return Math.sqrt(this.x * this.x + this.y * this.y); }
  set magnitude(m) { 
    var uv = this.normalize();
    this.x = uv.x * m;
    this.y = uv.y * m;
  }
  
  static fromPoints(p1, p2) {
    return new Vector(p2.x - p1.x, p2.y - p1.y);
  }
    
  cross(vector) {
    return this.x * vector.y - this.y * vector.x;
  }
  
  dot(vector) {
    return this.x * vector.x + this.y * vector.y;
  }

  add(vector) {    
    return new Vector(this.x + vector.x, this.y + vector.y);
  }

  subtract(vector) {
    return new Vector(this.x - vector.x, this.y - vector.y);
  }
  
  multiply(scalar) {
    return new Vector(this.x * scalar, this.y * scalar);
  }
  
  divide(scalar) {
    return new Vector(this.x / scalar, this.y / scalar);
  }

  normalize() {
    var v = new Vector();
    var m = this.magnitude;
    v.x = this.x / m;
    v.y = this.y / m;
    return v;      
  }
  
  unit() {
    return this.divide(this.magnitude);
  }

  perp() {
    return new Vector(-this.y, this.x)
  }
  
  perpendicular(vector) {
    return this.subtract(this.project(vector));
  }
  
  project(vector) {
    var percent = this.dot(vector) / vector.dot(vector);
    return vector.multiply(percent);
  }

  reflect(axis) {      
    var vdot = this.dot(axis);
    var ldot = axis.dot(axis);
    var ratio = vdot / ldot;
    var v = new Vector();
    v.x = 2 * ratio * axis.x - this.x;
    v.y = 2 * ratio * axis.y - this.y;
    return v;
  }
}

//
// SPLINE
// ========================================================================
class Spline {

  constructor(config = {}) {
    
    this.group = createSVG("g", canvas, { autoAlpha: 0 });
    this.node  = createSVG("path", canvas, config);
    this[0] = this.node;
    
    this.length = 1;     
    this.paths  = [];
  }

  get path() { return this.paths[this.paths.length - 1].data; }
  
  hide(showGroup = false) {    
    
    TweenLite.set(this.node,  { autoAlpha: 0 });
    TweenLite.set(this.group, { autoAlpha: showGroup ? 1 : 0 });
    return this;
  }

  show() {    
    
    TweenLite.set(this.node,  { autoAlpha: 1 });
    TweenLite.set(this.group, { autoAlpha: 0 });
    return this;
  }

  set(vars) {
    TweenLite.set(this.node, vars);
    return this;
  }
  
  clear() {
    
    var group = this.group;
    
    while (group.lastChild) {
      group.removeChild(group.lastChild);
    }
    
    this.paths = [];
    this.hide();
    return this;
  }
  
  addPath(data) {
           
    var paths = this.paths;
    var props = { stroke: "#ddd", attr: { d: data }};
    var node  = createSVG("path", this.group, props);
    var alpha = 0.95;
    
    paths.push({ node, data });
           
    var i = paths.length;
    
    while (i--) {
            
      TweenLite.set(paths[i].node, { autoAlpha: alpha });
      alpha = Math.max(alpha - 0.3, 0);
    }
    
    return this;
  }
  
  update() {
    
    this.node.setAttribute("d", this.path);
    return this;
  }
  
  solve(data) {
        
    var size = data.length;
    var last = size - 4;    
    
    var path = `M${data[0]},${data[1]}`;
        
    for (var i = 0; i < size - 2; i +=2) {
            
      var x0 = i ? data[i - 2] : data[0];
      var y0 = i ? data[i - 1] : data[1];
      
      var x1 = data[i + 0];
      var y1 = data[i + 1];
      
      var x2 = data[i + 2];
      var y2 = data[i + 3];
      
      var x3 = i !== last ? data[i + 4] : x2;
      var y3 = i !== last ? data[i + 5] : y2;
      
      var cp1x = (-x0 + 6 * x1 + x2) / 6;
      var cp1y = (-y0 + 6 * y1 + y2) / 6;
      
      var cp2x = (x1 + 6 * x2 - x3) / 6;
      var cp2y = (y1 + 6 * y2 - y3) / 6;
            
      path += `C ${cp1x},${cp1y} ${cp2x},${cp2y} ${x2},${y2}`;    
    } 
    
    this.addPath(path);
    return path;
  }
}

//
// POLYLINE
// ========================================================================
class Polyline {

  constructor(config = {}, count) {
    
    this[0] = this.node = createSVG("polyline", canvas);
            
    // Table values
    this.data = {};
    //if (count) this.data = createRow(count);
    
    this.length  = 1; 
    this.last    = null;       
    this.points  = [];
    this.initial = [];    
    this.reduced = [];       
    
    this.set(config);   
  }
    
  addPoint(point) {
    
    if (this.last.x !== point.x || this.last.y !== point.y) {
      this.last = point;
      this.points.push(point);
      this.initial.push(point.x);
      this.initial.push(point.y);
      this.data.initial = this.points.length;
      this.node.setAttribute("points", this.initial); 
    }          
    return this;
  }
    
  destroy() {
    canvas.removeChild(this.node);
    this.last    = null;       
    this.points  = null;
    this.initial = null;    
    this.reduced = null;
  }
  
  hide() {
    this.set({ autoAlpha: 0 });
    return this;
  }
  
  show() {
    this.set({ autoAlpha: 1 });
    return this;
  }
  
  updatePoints() {
    this.data.reduced = this.reduced.length / 2;
    this.node.setAttribute("points", this.reduced); 
    return this;
  }
    
  set(vars) {
    TweenLite.set(this.node, vars);
    return this;
  }
  
  simplify(tolerance = 10) {
    
    var points = this.points;
    var length = points.length;
    
    if (length < 3) {                  
      if (!length) {
        this.addPoint({ x: this.last.x, y: this.last.y + 0.2 });
      }
      this.addPoint({ x: this.last.x + 0.2, y: this.last.y });
      this.reduced = _.slice(this.initial);
           
      this.updatePoints();
      return;
    }

    function acceptPoint() {
      acceptedPoint = previousPoint;
      result.push(acceptedPoint);
      cache = [];
    }
    
    var previousPoint = points[0];
    var acceptedPoint = points[0];
    var currentPoint  = points[1];
    var currentVector = Vector.fromPoints(previousPoint, currentPoint);
    var previousVector;
    
    var result = [points[0]];
    var cache  = [];
        
    for (var i = 2; i < length; i++) {
      previousPoint  = currentPoint;
      currentPoint   = points[i];
      previousVector = currentVector;
      currentVector  = Vector.fromPoints(previousPoint, currentPoint);
      
      if (previousVector.dot(currentVector) < 0) {
        acceptPoint();
      } else {
        
        var candidate  = Vector.fromPoints(acceptedPoint, currentPoint);
        var lastVector = Vector.fromPoints(acceptedPoint, previousPoint)
                
        cache.push(lastVector);

        for (var j = 0; j < cache.length; j++) {
          
          var perp = cache[j].perpendicular(candidate);
          
          if (perp.magnitude > tolerance) {
            acceptPoint();
            break;
          }
        }
      }
    }
        
    result.push(points[points.length - 1]);
    
    this.reduced = _.reduce(result, (path, point) => {
      path.push(point.x);
      path.push(point.y);
      return path;
    }, []);
        
    this.updatePoints(); 
    return this;
  }
}

// CREATE ROW ============================================================
function createRow(id) {
  
  var row = createElement("tr", table);    
  
  _.times(3, i => createElement("td", row, !i ? id : "--"));
  
  return {
    set initial(value) { row.children[1].textContent = value; },
    set reduced(value) { row.children[2].textContent = value; }
  };
}

// CREATE SVG ============================================================
function createSVG(type, parent, config) {  
    
  var node = document.createElementNS(xmlns, type);
  parent.appendChild(node);
  if (config) TweenLite.set(node, config);
  return node;
}

// CREATE ELEMENT ========================================================
function createElement(type, parent, text) {  
  
  var node = document.createElement(type);
  if (text) node.innerHTML = text;  
  parent.appendChild(node);
  return node;
}

// Start it up...
demo();
