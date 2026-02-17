// DokuWiki Knowledge Graph - Helper Functions

// -- COLOR FUNCTIONS -- //

function hexToRGB(hex) {
  if (hex[0] == "#") hex = hex.slice(1);
  var strips = [hex.slice(0,2), hex.slice(2,4), hex.slice(4,6)];
  return strips.map(function(x){ return parseInt(x, 16); });
}

function rgbToHex(rgb) {
  var hexvals = rgb.map(function(x){ return Math.round(x).toString(16); });
  hexvals = hexvals.map(function(x){ return x.length == 1 ? "0"+x : x; });
  return "#" + hexvals.join("");
}

function lightenHex(hex, percent) {
  var rgb = hexToRGB(hex);
  if (percent > 100) percent = 100;
  var newRgb = rgb.map(function(x){
    return x + percent / 100.0 * (255 - x);
  });
  return rgbToHex(newRgb);
}

// -- NODE COLORS BY TYPE -- //

// Page nodes: blue gradient by level
function getPageColor(level) {
  return lightenHex("#03A9F4", 5 * level);
}

// Tag nodes: green
function getTagColor() {
  return "#4CAF50";
}

// Namespace start pages: red
function getStartColor() {
  return "#E53935";
}

// Get color based on node type and level
function getColor(level, type) {
  if (type === "tag") return getTagColor();
  if (type === "start") return getStartColor();
  return getPageColor(level);
}

// Highlighted color (yellow) for traceback
function getYellowColor(level) {
  return lightenHex("#FFC107", 5 * level);
}

// Edge color pointing to a certain level
function getEdgeColor(level) {
  var nodecolor = getPageColor(level);
  return vis.util.parseColor(nodecolor).border;
}

// -- NODE SHAPES BY TYPE -- //

function getNodeShape(type) {
  if (type === "tag") return "diamond";
  if (type === "start") return "square";
  return "dot";
}

// Check if a page ID is a namespace start page
function isStartPage(pageId) {
  if (!pageId) return false;
  var parts = pageId.split(":");
  return parts[parts.length - 1] === "start";
}

// -- TEXT FUNCTIONS -- //

function wordwrap(text, limit) {
  var words = text.split(" ");
  var lines = [""];
  for (var i = 0; i < words.length; i++) {
    var word = words[i];
    var lastLine = lines[lines.length - 1];
    if (lastLine.length + word.length > limit) {
      lines.push(word);
    } else {
      lines[lines.length - 1] = lastLine + " " + word;
    }
  }
  return lines.join("\n").trim();
}

function unwrap(text) {
  return text.replace(/\n/g, " ");
}

// -- ID FUNCTIONS -- //

// Create a neutral ID from a DokuWiki page ID.
// Preserves colons (namespace separators) but normalizes the rest.
function getNeutralId(id) {
  id = id.toLowerCase();
  id = id.replace(/%20/g, "_");
  id = id.replace(/[^a-z\d:_\-]/g, "");
  return id;
}

// Extract the namespace from a page ID
function getNamespaceFromId(pageId) {
  var parts = pageId.split(":");
  parts.pop();
  return parts.join(":");
}

// Extract the page name (without namespace) from a page ID
function getPageNameFromId(pageId) {
  var parts = pageId.split(":");
  return parts[parts.length - 1];
}

// -- MATH HELPERS -- //

function sign(x) {
  if (Math.sign) return Math.sign(x);
  if (x === 0) return 0;
  return x > 0 ? 1 : -1;
}

// -- NETWORK SHORTCUTS -- //

function colorNodes(ns, color) {
  for (var i = 0; i < ns.length; i++) {
    var nodeType = ns[i].nodeType || "page";
    if (color) {
      ns[i].color = getYellowColor(ns[i].level);
    } else {
      ns[i].color = getColor(ns[i].level, nodeType);
    }
    delete ns[i].x;
    delete ns[i].y;
  }
  nodes.update(ns);
  isReset = false;
}

function edgesWidth(es, width) {
  for (var i = 0; i < es.length; i++) {
    es[i].width = width;
  }
  edges.update(es);
  isReset = false;
}

function getEdgeConnecting(a, b) {
  var edge = edges.get({filter: function(edge) {
    return edge.from === a && edge.to === b;
  }})[0];
  if (edge instanceof Object) return edge.id;
}

function getCenter() {
  var nodePositions = network.getPositions();
  var keys = Object.keys(nodePositions);
  if (keys.length === 0) return [0, 0];
  var xsum = 0, ysum = 0;
  for (var i = 0; i < keys.length; i++) {
    var pos = nodePositions[keys[i]];
    xsum += pos.x;
    ysum += pos.y;
  }
  return [xsum / keys.length, ysum / keys.length];
}

function getSpawnPosition(parentID) {
  var pos = network.getPositions(parentID)[parentID];
  var x = pos.x, y = pos.y;
  var cog = getCenter();
  var dx = cog[0] - x, dy = cog[1] - y;
  var relSpawnX, relSpawnY;

  if (dx === 0) {
    relSpawnX = 0;
    relSpawnY = -sign(dy) * 100;
  } else {
    var slope = dy / dx;
    var dis = 200;
    relSpawnX = dis / Math.sqrt(Math.pow(slope, 2) + 1);
    relSpawnY = relSpawnX * slope;
  }
  return [Math.round(relSpawnX + x), Math.round(relSpawnY + y)];
}
