// DokuWiki Knowledge Graph - Main Network Setup

var nodes, edges, network;
var startpages = [];
var needsreset = true;
var isEmbedded = false;

var container = document.getElementById('container');

// vis.js options
var options = {
  nodes: {
    shape: 'dot',
    scaling: {
      min: 15, max: 30,
      label: { min: 12, max: 24, drawThreshold: 9, maxVisible: 20 }
    },
    font: { size: 14, face: 'Helvetica Neue, Helvetica, Arial' }
  },
  edges: {
    arrows: { to: { enabled: true, scaleFactor: 0.5 } },
    smooth: { type: 'continuous' }
  },
  interaction: {
    hover: true,
    hoverConnectedEdges: false,
    selectConnectedEdges: true,
  },
  physics: {
    barnesHut: {
      gravitationalConstant: -3000,
      centralGravity: 0.3,
      springLength: 120,
      springConstant: 0.04,
      damping: 0.09
    },
    stabilization: { iterations: 150 }
  },
  groups: {
    page: { shape: 'dot', color: { background: '#03A9F4', border: '#0288D1' } },
    tag: { shape: 'diamond', color: { background: '#4CAF50', border: '#388E3C' } },
    namespace: { shape: 'triangle', color: { background: '#FF9800', border: '#F57C00' } }
  }
};

var nodes = new vis.DataSet();
var edges = new vis.DataSet();
var data = { nodes: nodes, edges: edges };
var initialized = false;

function makeNetwork() {
  network = new vis.Network(container, data, options);
  bindNetwork();
  initialized = true;
}

// Reset the network with a single start page
function resetNetwork(pageId) {
  if (!initialized) makeNetwork();
  var nodeId = getNeutralId(pageId);
  startpages = [nodeId];
  tracenodes = [];
  traceedges = [];

  document.getElementById("submit").innerHTML = '<i class="icon ion-refresh"> </i>';

  getPageName(pageId, function(title) {
    nodes = new vis.DataSet([{
      id: nodeId,
      label: wordwrap(title, 20),
      value: 2,
      level: 0,
      color: getColor(0, "page"),
      shape: getNodeShape("page"),
      nodeType: "page",
      pageId: pageId,
      x: 0, y: 0,
      parent: nodeId
    }]);
    edges = new vis.DataSet();
    data = { nodes: nodes, edges: edges };
    network.setData(data);

    // Also load tags for the start node
    loadTagsForNode(pageId, nodeId, 0);
  });
}

// Add a new start node
function addStart(pageId, index) {
  if (needsreset) {
    resetNetwork(pageId);
    needsreset = false;
    return;
  }

  var nodeId = getNeutralId(pageId);
  startpages.push(nodeId);

  getPageName(pageId, function(title) {
    nodes.add([{
      id: nodeId,
      label: wordwrap(title, 20),
      value: 2,
      level: 0,
      color: getColor(0, "page"),
      shape: getNodeShape("page"),
      nodeType: "page",
      pageId: pageId,
      x: 0, y: 0,
      parent: nodeId
    }]);
    loadTagsForNode(pageId, nodeId, 0);
  });
}

// Load tags for a node and add tag nodes + edges
function loadTagsForNode(pageId, nodeId, level) {
  getPageTags(pageId, function(tags) {
    if (!tags || tags.length === 0) return;
    var tagLevel = level + 1;
    for (var i = 0; i < tags.length; i++) {
      var tagId = "tag:" + tags[i];
      var tagNeutralId = getNeutralId(tagId);

      // Add tag node if it doesn't exist
      if (nodes.getIds().indexOf(tagNeutralId) === -1) {
        nodes.add([{
          id: tagNeutralId,
          label: "#" + tags[i],
          value: 1,
          level: tagLevel,
          color: getColor(tagLevel, "tag"),
          shape: getNodeShape("tag"),
          nodeType: "tag",
          tagName: tags[i],
          parent: nodeId
        }]);
      }

      // Add edge from page to tag
      if (!getEdgeConnecting(nodeId, tagNeutralId)) {
        edges.add([{
          from: nodeId,
          to: tagNeutralId,
          color: { color: '#81C784', opacity: 0.6 },
          dashes: true,
          level: tagLevel,
          selectionWidth: 2,
          hoverWidth: 0
        }]);
      }
    }
  });
}

// Reset from the search input
function resetNetworkFromInput() {
  needsreset = true;
  var cf = document.getElementsByClassName("commafield")[0];
  var inputs = getItems(cf);

  if (!inputs[0]) {
    noInputDetected();
    return;
  }

  for (var i = 0; i < inputs.length; i++) {
    addStart(inputs[i], i);
  }
}

// Reset with a random page
function randomReset() {
  needsreset = true;
  clearItems(cf);
  getRandomPage(function(pageId) {
    addStart(pageId);
    addItem(cf, pageId);
  });
}

// Parse URL parameters for embed mode
function parseUrlParams() {
  var params = {};
  var search = window.location.search.substring(1);
  if (search) {
    var pairs = search.split('&');
    for (var i = 0; i < pairs.length; i++) {
      var pair = pairs[i].split('=');
      params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
    }
  }
  return params;
}

// Initialize from URL parameters (for iframe embedding)
function initFromParams() {
  var params = parseUrlParams();

  // Embed mode: hide chrome
  if (params.embed === '1') {
    isEmbedded = true;
    document.getElementById('formbox').style.display = 'none';
    document.getElementById('buttons').style.display = 'none';
    var logo = document.getElementById('logo');
    if (logo) logo.style.display = 'none';
  }

  // Start with a specific page
  if (params.page) {
    needsreset = true;
    addStart(params.page);
    return true;
  }

  // Start with a tag filter
  if (params.tag) {
    // Load all pages for this tag via search
    // (handled later once tag search is available)
    return false;
  }

  return false;
}
