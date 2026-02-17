// DokuWiki Knowledge Graph - API Layer
// Communicates with lookup.php which proxies to DokuWiki XML-RPC.

var api_endpoint = "lookup.php";
var wikiBaseUrl = ""; // Set from config on init

// Initialize: fetch wiki config from backend
function initAPI(onReady) {
  requestPage(api_endpoint + "?api=config", function(data) {
    var config = JSON.parse(data);
    wikiBaseUrl = config.wiki_url || "";
    if (onReady) onReady(config);
  });
}

// Make an asynchronous GET request
function requestPage(url, onSuccess, onError) {
  onSuccess = onSuccess || function(){};
  onError = onError || function(){};
  var xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
    if (xhttp.readyState == 4) {
      if (xhttp.status == 200) {
        onSuccess(xhttp.responseText);
      } else {
        onError(xhttp.status, xhttp.responseText);
      }
    }
  };
  xhttp.open("GET", url, true);
  xhttp.send();
}

// Generic API request helper
function apiRequest(action, params, onSuccess, onError) {
  var url = api_endpoint + "?api=" + action;
  for (var key in params) {
    if (params.hasOwnProperty(key)) {
      url += "&" + encodeURIComponent(key) + "=" + encodeURIComponent(params[key]);
    }
  }
  requestPage(url, function(data) {
    var parsed = JSON.parse(data);
    if (parsed && parsed.error) {
      if (onError) onError(parsed.error);
      return;
    }
    onSuccess(parsed);
  }, onError);
}

// --- Page Operations ---

// Get the title of a page
function getPageName(pageId, onSuccess) {
  apiRequest("pagename", {page: pageId}, function(data) {
    onSuccess(data.title || data.id);
  });
}

// Get internal links of a page (returns array of page IDs)
function getPageLinks(pageId, onSuccess) {
  apiRequest("links", {page: pageId}, onSuccess);
}

// Get tags of a page (returns array of tag strings)
function getPageTags(pageId, onSuccess) {
  apiRequest("tags", {page: pageId}, onSuccess);
}

// Get combined page info (title, namespace, tags)
function getPageInfo(pageId, onSuccess) {
  apiRequest("pageinfo", {page: pageId}, onSuccess);
}

// --- Collection Operations ---

// Get all pages (optionally filtered by namespace)
function getAllPages(onSuccess, namespace) {
  var params = {};
  if (namespace) params.namespace = namespace;
  apiRequest("allpages", params, onSuccess);
}

// Get all namespaces
function getNamespaces(onSuccess, namespace) {
  var params = {};
  if (namespace) params.namespace = namespace;
  apiRequest("namespaces", params, onSuccess);
}

// Get a random page
function getRandomPage(onSuccess) {
  apiRequest("random", {}, function(data) {
    onSuccess(data.id);
  });
}

// Search pages by query
function searchPages(query, onSuccess) {
  apiRequest("search", {q: query}, onSuccess);
}

// Get a content preview / excerpt for a page
function getPagePreview(pageId, onSuccess) {
  apiRequest("preview", {page: pageId}, function(data) {
    onSuccess(data.excerpt || '');
  });
}

// Get all pages that have a specific tag
function getPagesByTag(tag, onSuccess) {
  apiRequest("tagpages", {tag: tag}, onSuccess);
}

// Build the complete graph from server
function getFullGraph(onSuccess, namespace) {
  var params = {};
  if (namespace) params.namespace = namespace;
  apiRequest("graph", params, onSuccess);
}

// --- Utility ---

// Build the URL to open a DokuWiki page
function getWikiPageUrl(pageId) {
  if (!wikiBaseUrl) return "#";
  return wikiBaseUrl + "/doku.php?id=" + encodeURIComponent(pageId);
}
