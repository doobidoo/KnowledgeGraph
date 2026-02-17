<?php
/**
 * DokuWiki Knowledge Graph - Configuration
 *
 * Configure the connection to your DokuWiki instance here.
 */

return [
    // DokuWiki base URL (without trailing slash)
    // Example: 'https://wiki.example.com' or 'http://192.168.1.100/dokuwiki'
    'wiki_url' => '',

    // XML-RPC endpoint (usually lib/exe/xmlrpc.php)
    'xmlrpc_path' => '/lib/exe/xmlrpc.php',

    // Authentication credentials for XML-RPC API
    'username' => '',
    'password' => '',

    // Optional: restrict to a specific namespace (empty = all namespaces)
    // Example: 'products' will only show pages under the products: namespace
    'base_namespace' => '',

    // Cache duration in seconds (0 = no cache)
    'cache_ttl' => 300,

    // Maximum number of pages to return for allpages queries
    'max_pages' => 500,

    // Enable debug mode (logs errors to PHP error log)
    'debug' => false,
];
