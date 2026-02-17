// DokuWiki Knowledge Graph - Core Functions

var isReset = true;
var selectedNode = null;
var traceedges = [];
var tracenodes = [];

// Callback after expanding a page node with its links
function expandNodeCallback(parentNodeId, linkedPageIds) {
  var node = nodes.get(parentNodeId);
  var level = node.level + 1;

  var subnodes = [];
  var newedges = [];
  var nodeSpawn = getSpawnPosition(parentNodeId);

  for (var i = 0; i < linkedPageIds.length; i++) {
    var linkedPageId = linkedPageIds[i];
    var linkedNodeId = getNeutralId(linkedPageId);

    // Add linked page as node if not already present
    if (nodes.getIds().indexOf(linkedNodeId) === -1) {
      subnodes.push({
        id: linkedNodeId,
        label: wordwrap(getPageNameFromId(linkedPageId), 15),
        value: 1,
        level: level,
        color: getColor(level, "page"),
        shape: getNodeShape("page"),
        nodeType: "page",
        pageId: linkedPageId,
        parent: parentNodeId,
        x: nodeSpawn[0],
        y: nodeSpawn[1]
      });
    }

    // Add edge if not already present
    if (!getEdgeConnecting(parentNodeId, linkedNodeId)) {
      newedges.push({
        from: parentNodeId,
        to: linkedNodeId,
        color: getEdgeColor(level),
        level: level,
        selectionWidth: 2,
        hoverWidth: 0
      });
    }
  }

  nodes.add(subnodes);
  edges.add(newedges);

  // Fetch titles for newly added nodes asynchronously
  for (var j = 0; j < subnodes.length; j++) {
    (function(subnode) {
      getPageName(subnode.pageId, function(title) {
        nodes.update([{ id: subnode.id, label: wordwrap(title, 15) }]);
      });
    })(subnodes[j]);
  }
}

// Expand a page node: load its internal links from DokuWiki
function expandNode(nodeId) {
  var node = nodes.get(nodeId);
  if (!node) return;

  // Tag nodes: clicking expands to show all pages with this tag
  if (node.nodeType === "tag") {
    expandTagNode(nodeId);
    return;
  }

  // Page nodes: load internal links
  var pageId = node.pageId || nodeId;
  getPageLinks(pageId, function(links) {
    expandNodeCallback(nodeId, links);
    // Also load tags for each linked page
    for (var i = 0; i < links.length; i++) {
      var linkedNodeId = getNeutralId(links[i]);
      loadTagsForNode(links[i], linkedNodeId, node.level + 1);
    }
  });
}

// Expand a tag node: search for pages with this tag
function expandTagNode(tagNodeId) {
  var node = nodes.get(tagNodeId);
  if (!node || !node.tagName) return;

  var level = node.level + 1;
  var nodeSpawn = getSpawnPosition(tagNodeId);

  // Search for pages containing this tag
  searchPages(node.tagName, function(results) {
    if (!results || results.length === 0) return;
    var subnodes = [];
    var newedges = [];

    for (var i = 0; i < results.length; i++) {
      var result = results[i];
      var pageId = result.id || result;
      var linkedNodeId = getNeutralId(pageId);

      if (nodes.getIds().indexOf(linkedNodeId) === -1) {
        subnodes.push({
          id: linkedNodeId,
          label: wordwrap(getPageNameFromId(pageId), 15),
          value: 1,
          level: level,
          color: getColor(level, "page"),
          shape: getNodeShape("page"),
          nodeType: "page",
          pageId: pageId,
          parent: tagNodeId,
          x: nodeSpawn[0],
          y: nodeSpawn[1]
        });
      }

      if (!getEdgeConnecting(tagNodeId, linkedNodeId)) {
        newedges.push({
          from: tagNodeId,
          to: linkedNodeId,
          color: { color: '#81C784', opacity: 0.6 },
          dashes: true,
          level: level,
          selectionWidth: 2,
          hoverWidth: 0
        });
      }
    }

    nodes.add(subnodes);
    edges.add(newedges);
  });
}

// Get all nodes tracing back to the start node
function getTraceBackNodes(node) {
  var finished = false;
  var path = [];
  var maxIterations = 100;
  var count = 0;
  while (!finished && count < maxIterations) {
    path.push(node);
    if (startpages.indexOf(node) !== -1) {
      finished = true;
    }
    var nodeData = nodes.get(node);
    if (!nodeData || !nodeData.parent) break;
    node = nodeData.parent;
    count++;
  }
  return path;
}

// Get all edges tracing back to the start node
function getTraceBackEdges(tbnodes) {
  tbnodes.reverse();
  var path = [];
  for (var i = 0; i < tbnodes.length - 1; i++) {
    var edgeId = getEdgeConnecting(tbnodes[i], tbnodes[i+1]);
    if (edgeId) path.push(edgeId);
  }
  return path;
}

// Reset the color of all nodes and width of all edges
function resetProperties() {
  if (!isReset) {
    selectedNode = null;
    var modnodes = tracenodes.map(function(i){ return nodes.get(i); }).filter(Boolean);
    colorNodes(modnodes, 0);
    var modedges = traceedges.map(function(i){
      var e = edges.get(i);
      if (e) {
        var toNode = nodes.get(e.to);
        e.color = toNode ? getEdgeColor(toNode.level) : getEdgeColor(0);
      }
      return e;
    }).filter(Boolean);
    edgesWidth(modedges, 1);
    tracenodes = [];
    traceedges = [];
  }
}

// Highlight the path from a node back to the central node
function traceBack(node) {
  if (node !== selectedNode) {
    selectedNode = node;
    resetProperties();
    tracenodes = getTraceBackNodes(node);
    traceedges = getTraceBackEdges(tracenodes.slice());
    var modnodes = tracenodes.map(function(i){ return nodes.get(i); }).filter(Boolean);
    colorNodes(modnodes, 1);
    var modedges = traceedges.map(function(i){
      var e = edges.get(i);
      if (e) e.color = { inherit: "to" };
      return e;
    }).filter(Boolean);
    edgesWidth(modedges, 5);
  }
}
