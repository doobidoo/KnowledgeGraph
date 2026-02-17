// DokuWiki Knowledge Graph - Event Bindings

// Expand a node on click
function expandEvent(params) {
  if (params.nodes.length) {
    expandNode(params.nodes[0]);
  }
}

// Traceback on mobile click
function mobileTraceEvent(params) {
  if (params.nodes.length) {
    traceBack(params.nodes[0]);
  } else {
    resetProperties();
  }
}

// Open the DokuWiki page on double-click
function openPageEvent(params) {
  if (params.nodes.length) {
    var nodeId = params.nodes[0];
    var node = nodes.get(nodeId);

    if (node.nodeType === "tag") {
      // Open DokuWiki search for this tag
      var url = wikiBaseUrl + "/doku.php?do=search&id=" + encodeURIComponent(node.tagName);
      window.open(url, '_blank');
    } else {
      // Open DokuWiki page
      var pageId = node.pageId || nodeId;
      var url = getWikiPageUrl(pageId);
      window.open(url, '_blank');
    }
  }
}

// Show page info on hover
function showPageInfoEvent(nodeId) {
  if (!nodeId) return;
  var node = nodes.get(nodeId);
  if (!node) return;

  var infoEl = document.getElementById('pageinfo');
  if (!infoEl) return;

  if (node.nodeType === "tag") {
    infoEl.innerHTML = '<div class="info-header">' +
      '<span class="info-type tag-type">Tag</span> ' +
      '<strong>#' + (node.tagName || '') + '</strong>' +
      '</div>' +
      '<div class="info-hint">Click to expand, double-click to search in wiki</div>';
  } else {
    var ns = node.pageId ? getNamespaceFromId(node.pageId) : '';
    infoEl.innerHTML = '<div class="info-header">' +
      '<span class="info-type page-type">Page</span> ' +
      '<strong>' + unwrap(node.label) + '</strong>' +
      '</div>' +
      (ns ? '<div class="info-ns">Namespace: ' + ns + '</div>' : '') +
      '<div class="info-id">' + (node.pageId || nodeId) + '</div>' +
      '<div class="info-hint">Click to expand, double-click to open in wiki</div>';
  }

  infoEl.style.display = 'block';
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
      var infoEl = document.getElementById('pageinfo');
      if (infoEl) infoEl.style.display = 'none';
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

  // Help button: open wiki start page
  var helpbutton = document.getElementById("help");
  if (helpbutton) {
    helpbutton.onclick = function() {
      if (wikiBaseUrl) {
        window.open(wikiBaseUrl + "/doku.php?id=start", '_blank');
      }
    };
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
