# DokuWiki Knowledge Graph

An interactive web app for visualizing the connections between DokuWiki pages. Explore your wiki by navigating internal links, tags, and namespaces as a force-directed graph.

## Features

- **Page graph**: Wiki pages are nodes, internal links are edges
- **Tag nodes**: Tags appear as green diamond nodes connected to their pages
- **Namespace awareness**: Page IDs preserve namespace structure (e.g. `products:overview`)
- **Traceback highlighting**: Hover over a node to see the path back to the start
- **iframe embedding**: Embed the graph directly in DokuWiki pages
- **Random exploration**: Start from a random wiki page

## Requirements

- A DokuWiki instance with **XML-RPC API enabled**
- PHP 7.0+ with cURL extension
- A web server (Apache, Nginx, etc.) to serve the app

## Setup

### 1. Configure DokuWiki Connection

Copy `config.php` and edit it with your wiki details:

```php
return [
    'wiki_url'       => 'https://your-wiki.example.com',
    'xmlrpc_path'    => '/lib/exe/xmlrpc.php',
    'username'       => 'your-api-user',
    'password'       => 'your-api-password',
    'base_namespace' => '',        // Optional: limit to a namespace
    'cache_ttl'      => 300,       // Cache lifetime in seconds
    'max_pages'      => 500,       // Max pages to load
    'debug'          => false,
];
```

### 2. Enable XML-RPC in DokuWiki

In your DokuWiki admin panel, go to **Configuration Settings** and enable:
- `remote` (Enable XML-RPC API)
- `remoteuser` (Set which users can use the API)

### 3. Deploy

Place the entire directory on your web server. The app should be accessible at:
```
https://your-server.example.com/KnowledgeGraph/
```

### 4. Verify

Open the app in your browser. Enter a wiki page name (e.g. `start`) and click **Go**. The graph should expand showing linked pages and tags.

## Embedding in DokuWiki

Add an iframe to any DokuWiki page:

```
{{url>https://your-server.example.com/KnowledgeGraph/?embed=1&page=start 600px,400px noscroll}}
```

### URL Parameters

| Parameter | Description |
|-----------|-------------|
| `embed=1` | Hides the search bar and buttons (for iframe use) |
| `page=X`  | Start the graph at page X |
| `tag=X`   | Start with pages matching tag X |

## Architecture

```
Browser/iframe  <-->  lookup.php (PHP Proxy)  <-->  DokuWiki XML-RPC API
                          |
                      config.php (credentials)
```

The PHP proxy (`lookup.php`) keeps wiki credentials server-side and avoids CORS issues. It also provides a file-based cache to reduce API calls.

## Node Types

| Type | Shape | Color | Description |
|------|-------|-------|-------------|
| Page | Circle | Blue | A wiki page |
| Tag | Diamond | Green | A tag assigned to pages |
| Namespace | Triangle | Orange | A namespace grouping |

## File Structure

```
KnowledgeGraph/
  index.html            # Main app page
  lookup.php            # PHP API proxy
  config.php            # Wiki connection config
  dokuwiki_api.php      # DokuWiki XML-RPC client
  cache/                # Auto-created cache directory
  js/
    api.js              # Frontend API layer
    helpers.js          # Color, shape, ID utilities
    main.js             # Network setup and initialization
    main_functions.js   # Node expansion and traceback
    bindings.js         # Event handlers and UI bindings
    commafield.js       # Multi-input field component
  css/
    style.css           # Main styles
    bar.css             # Top bar styles
    buttongroup.css     # Button group styles
    commafield.css      # Input field styles
```

## Credits

Based on [Wikipedia Map](https://github.com/The-Penultimate-Defenestrator/wikipedia-map) by Luke Taylor. Adapted for DokuWiki integration.

Powered by [vis.js](https://visjs.org/) for graph visualization and DokuWiki's XML-RPC API.
