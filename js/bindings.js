// DokuWiki Knowledge Graph - Event Bindings

// Track whether the info panel is pinned (clicked) vs just hovered
var infoPinned = false;

// Expand a node on click and show preview
function expandEvent(params) {
  if (params.nodes.length) {
    var nodeId = params.nodes[0];
    expandNode(nodeId);
    showNodePreview(nodeId);
    infoPinned = true;
  } else {
    // Clicked on empty canvas — dismiss pinned panel
    infoPinned = false;
    var infoEl = document.getElementById('pageinfo');
    if (infoEl) infoEl.style.display = 'none';
  }
}

// Traceback on mobile click
function mobileTraceEvent(params) {
  if (params.nodes.length) {
    traceBack(params.nodes[0]);
    showNodePreview(params.nodes[0]);
    infoPinned = true;
  } else {
    infoPinned = false;
    var infoEl = document.getElementById('pageinfo');
    if (infoEl) infoEl.style.display = 'none';
    resetProperties();
  }
}

// Open the DokuWiki page on double-click
function openPageEvent(params) {
  if (params.nodes.length) {
    var nodeId = params.nodes[0];
    var node = nodes.get(nodeId);

    if (node.nodeType === "tag") {
      // Open DokuWiki tag page
      var url = wikiBaseUrl + "/doku.php/" + encodeURIComponent(node.tagName) + "?do=showtag&tag=" + encodeURIComponent(node.tagName);
      window.open(url, '_blank');
    } else {
      // Open DokuWiki page
      var pageId = node.pageId || nodeId;
      var url = getWikiPageUrl(pageId);
      window.open(url, '_blank');
    }
  }
}

// Build the info panel HTML for a node (without preview)
function buildNodeInfoHtml(node, nodeId) {
  var html = '';
  if (node.nodeType === "tag") {
    html = '<div class="info-header">' +
      '<span class="info-type tag-type">Tag</span> ' +
      '<strong>#' + (node.tagName || '') + '</strong>' +
      '</div>' +
      '<div class="info-hint">Click to expand, double-click to search in wiki</div>';
  } else {
    var ns = node.pageId ? getNamespaceFromId(node.pageId) : '';
    var typeLabel = node.nodeType === "start" ? "Namespace" : "Page";
    var typeClass = node.nodeType === "start" ? "start-type" : "page-type";
    html = '<div class="info-header">' +
      '<span class="info-type ' + typeClass + '">' + typeLabel + '</span> ' +
      '<strong>' + unwrap(node.label) + '</strong>' +
      '</div>' +
      (ns ? '<div class="info-ns">' + ns + '</div>' : '') +
      '<div class="info-id">' + (node.pageId || nodeId) + '</div>';
  }
  return html;
}

// Show page info on hover (lightweight, no preview)
function showPageInfoEvent(nodeId) {
  if (infoPinned) return; // Don't override pinned preview
  if (!nodeId) return;
  var node = nodes.get(nodeId);
  if (!node) return;

  var infoEl = document.getElementById('pageinfo');
  if (!infoEl) return;

  infoEl.innerHTML = buildNodeInfoHtml(node, nodeId) +
    '<div class="info-hint">Click to expand, double-click to open in wiki</div>';
  infoEl.style.display = 'block';
}

// Show full node preview with content excerpt (on click)
function showNodePreview(nodeId) {
  if (!nodeId) return;
  var node = nodes.get(nodeId);
  if (!node) return;

  var infoEl = document.getElementById('pageinfo');
  if (!infoEl) return;

  // Show header immediately
  var wikiUrl = '';
  if (node.nodeType === "tag") {
    wikiUrl = wikiBaseUrl + "/doku.php/" + encodeURIComponent(node.tagName) + "?do=showtag&tag=" + encodeURIComponent(node.tagName);
  } else {
    wikiUrl = getWikiPageUrl(node.pageId || nodeId);
  }

  infoEl.innerHTML = buildNodeInfoHtml(node, nodeId) +
    '<div class="info-preview"><span class="info-loading">Loading preview...</span></div>' +
    '<div class="info-actions"><a href="' + wikiUrl + '" target="_blank" class="info-link">Open in Wiki</a></div>';
  infoEl.style.display = 'block';

  // Fetch content preview for page nodes
  if (node.nodeType !== "tag") {
    var pageId = node.pageId || nodeId;
    getPagePreview(pageId, function(excerpt) {
      var previewEl = infoEl.querySelector('.info-preview');
      if (!previewEl) return;
      if (excerpt) {
        previewEl.innerHTML = '<div class="info-excerpt">' + escapeHtml(excerpt) + '</div>';
      } else {
        previewEl.innerHTML = '<div class="info-excerpt info-empty">No content available</div>';
      }
    });
  } else {
    var previewEl = infoEl.querySelector('.info-preview');
    if (previewEl) {
      previewEl.innerHTML = '<div class="info-excerpt info-empty">Tag node — click to see tagged pages</div>';
    }
  }
}

// Escape HTML entities for safe display
function escapeHtml(text) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

// Detect touch devices
var isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// Bind network events
function bindNetwork() {
  if (isTouchDevice) {
    network.on("hold", expandEvent);
    network.on("click", mobileTraceEvent);
  } else {
    network.on("click", expandEvent);
    network.on("hoverNode", function(params) {
      showPageInfoEvent(params.node);
      traceBack(params.node);
    });
    network.on("blurNode", function() {
      if (!infoPinned) {
        var infoEl = document.getElementById('pageinfo');
        if (infoEl) infoEl.style.display = 'none';
      }
      resetProperties();
    });
  }

  network.on("doubleClick", openPageEvent);
}

// Bind UI controls
function bind() {
  // Prevent iOS scrolling
  document.ontouchmove = function(event) {
    event.preventDefault();
  };

  var cf = document.getElementsByClassName("commafield")[0];

  // Submit button
  var submitButton = document.getElementById('submit');
  submitButton.onclick = function() {
    if (typeof shepherd !== 'undefined') shepherd.cancel();
    resetNetworkFromInput();
  };

  // Random button
  var randomButton = document.getElementById('random');
  randomButton.onclick = randomReset;

  // Tour button
  var tourbtn = document.getElementById("tourinit");
  if (tourbtn) {
    tourbtn.onclick = function() {
      if (typeof shepherd !== 'undefined') shepherd.start();
    };
  }

  // Help button: toggle help overlay
  var helpbutton = document.getElementById("help");
  var helpOverlay = document.getElementById("help-overlay");
  if (helpbutton && helpOverlay) {
    helpbutton.onclick = function() {
      helpOverlay.classList.toggle("visible");
    };
    // Close on backdrop click
    helpOverlay.onclick = function(e) {
      if (e.target === helpOverlay) {
        helpOverlay.classList.remove("visible");
      }
    };
    // Close button
    var helpClose = helpOverlay.querySelector(".help-close");
    if (helpClose) {
      helpClose.onclick = function() {
        helpOverlay.classList.remove("visible");
      };
    }
  }

  // Share button
  var sharebutton = document.getElementById("share");
  if (sharebutton) {
    sharebutton.onclick = function() {
      // Copy current graph state as URL
      var url = window.location.origin + window.location.pathname;
      if (startpages.length > 0) {
        var firstNode = nodes.get(startpages[0]);
        if (firstNode && firstNode.pageId) {
          url += "?page=" + encodeURIComponent(firstNode.pageId);
        }
      }
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url);
      }
    };
  }
}
