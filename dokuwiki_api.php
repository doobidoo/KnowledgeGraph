<?php
/**
 * DokuWiki XML-RPC API Client
 *
 * Provides methods to interact with a remote DokuWiki instance
 * via the XML-RPC interface.
 */

class DokuWikiAPI {
    private $url;
    private $username;
    private $password;
    private $cookies = [];
    private $debug;

    public function __construct($config) {
        $this->url = rtrim($config['wiki_url'], '/') . $config['xmlrpc_path'];
        $this->username = $config['username'];
        $this->password = $config['password'];
        $this->debug = $config['debug'] ?? false;
    }

    /**
     * Execute an XML-RPC call to DokuWiki.
     */
    private function call($method, $params = []) {
        $request = xmlrpc_encode_request($method, $params, ['encoding' => 'UTF-8']);

        $headers = [
            'Content-Type: text/xml',
            'Content-Length: ' . strlen($request),
        ];

        if (!empty($this->cookies)) {
            $headers[] = 'Cookie: ' . implode('; ', $this->cookies);
        }

        $ch = curl_init($this->url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $request,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_HEADER => true,
        ]);

        $response = curl_exec($ch);

        if ($response === false) {
            $error = curl_error($ch);
            curl_close($ch);
            throw new Exception("cURL error: $error");
        }

        $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $responseHeaders = substr($response, 0, $headerSize);
        $responseBody = substr($response, $headerSize);
        curl_close($ch);

        // Extract all Set-Cookie headers and accumulate cookies
        if (preg_match_all('/Set-Cookie:\s*([^;\r\n]+)/i', $responseHeaders, $matches)) {
            foreach ($matches[1] as $cookieNameValue) {
                $cookieNameValue = trim($cookieNameValue);
                // Skip deleted cookies
                if (strpos($cookieNameValue, '=deleted') !== false) {
                    $name = explode('=', $cookieNameValue)[0];
                    unset($this->cookies[$name]);
                    continue;
                }
                $name = explode('=', $cookieNameValue)[0];
                $this->cookies[$name] = $cookieNameValue;
            }
        }

        $result = xmlrpc_decode($responseBody);

        if (is_array($result) && isset($result['faultCode'])) {
            throw new Exception("XML-RPC fault: " . $result['faultString'], $result['faultCode']);
        }

        return $result;
    }

    /**
     * Authenticate with DokuWiki.
     */
    public function login() {
        return $this->call('dokuwiki.login', [$this->username, $this->password]);
    }

    /**
     * Get all pages in the wiki.
     */
    public function getAllPages() {
        $this->login();
        return $this->call('wiki.getAllPages');
    }

    /**
     * Get pages within a specific namespace.
     */
    public function getPageList($namespace, $options = []) {
        $this->login();
        $opts = array_merge(['depth' => 0], $options);
        return $this->call('dokuwiki.getPagelist', [$namespace, $opts]);
    }

    /**
     * Get the raw wiki text of a page.
     */
    public function getPage($pageId) {
        $this->login();
        return $this->call('wiki.getPage', [$pageId]);
    }

    /**
     * Get page info (metadata).
     */
    public function getPageInfo($pageId) {
        $this->login();
        return $this->call('wiki.getPageInfo', [$pageId]);
    }

    /**
     * Get internal links from a page's wiki text.
     * Parses the DokuWiki syntax to find [[links]].
     */
    public function getPageLinks($pageId) {
        $this->login();
        $content = $this->call('wiki.getPage', [$pageId]);

        if (empty($content)) {
            return [];
        }

        return $this->extractInternalLinks($content, $pageId);
    }

    /**
     * Extract internal links from DokuWiki markup.
     */
    private function extractInternalLinks($content, $currentPageId) {
        $links = [];
        $currentNs = $this->getNamespace($currentPageId);

        // Match [[link]] and [[link|label]] patterns
        if (preg_match_all('/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/', $content, $matches)) {
            foreach ($matches[1] as $link) {
                $link = trim($link);

                // Skip external links, interwiki links, and media links
                if (preg_match('/^(https?:|mailto:|\\\\\\\\|{)/', $link)) continue;
                if (strpos($link, '>') !== false) continue; // interwiki

                // Resolve relative links
                $resolved = $this->resolveLink($link, $currentNs);
                if ($resolved && !in_array($resolved, $links)) {
                    $links[] = $resolved;
                }
            }
        }

        return $links;
    }

    /**
     * Resolve a DokuWiki link to a full page ID.
     */
    private function resolveLink($link, $currentNs) {
        $link = strtolower(trim($link));
        $link = str_replace(' ', '_', $link);
        // Remove anchors
        $link = preg_replace('/#.*$/', '', $link);
        if (empty($link)) return null;

        // Absolute link (starts with :)
        if ($link[0] === ':') {
            return ltrim($link, ':');
        }

        // Relative link within namespace
        if (!empty($currentNs)) {
            // Check if it starts with ..: (parent namespace)
            if (strpos($link, '..') === 0) {
                $parts = explode(':', $currentNs);
                array_pop($parts);
                $parentNs = implode(':', $parts);
                $relLink = substr($link, 3); // remove ".."
                return $parentNs ? $parentNs . ':' . $relLink : $relLink;
            }

            // Check if it already contains a namespace
            if (strpos($link, ':') !== false) {
                return $link;
            }

            return $currentNs . ':' . $link;
        }

        return $link;
    }

    /**
     * Get the namespace portion of a page ID.
     */
    private function getNamespace($pageId) {
        $parts = explode(':', $pageId);
        array_pop($parts);
        return implode(':', $parts);
    }

    /**
     * Extract tags from a page's content.
     * Looks for {{tag>...}} syntax used by the Tag plugin.
     */
    public function getPageTags($pageId) {
        $this->login();
        $content = $this->call('wiki.getPage', [$pageId]);

        if (empty($content)) {
            return [];
        }

        return $this->extractTags($content);
    }

    /**
     * Extract tags from DokuWiki markup.
     */
    private function extractTags($content) {
        $tags = [];
        // Match {{tag>tag1 tag2 "multi word tag"}} pattern
        if (preg_match_all('/\{\{tag>([^}]+)\}\}/', $content, $matches)) {
            foreach ($matches[1] as $tagString) {
                // Handle quoted multi-word tags and single-word tags
                if (preg_match_all('/"([^"]+)"|\S+/', $tagString, $tagMatches)) {
                    foreach ($tagMatches[0] as $tag) {
                        $tag = trim($tag, '"');
                        if (!empty($tag) && !in_array($tag, $tags)) {
                            $tags[] = $tag;
                        }
                    }
                }
            }
        }
        return $tags;
    }

    /**
     * Search for pages containing a query string.
     */
    public function searchPages($query) {
        $this->login();
        return $this->call('dokuwiki.search', [$query]);
    }

    /**
     * Get a list of all namespaces.
     */
    public function getNamespaces($namespace = '', $depth = 0) {
        $allPages = $this->getAllPages();
        $namespaces = [];

        foreach ($allPages as $page) {
            $id = $page['id'];
            $ns = $this->getNamespace($id);
            if (!empty($ns) && !in_array($ns, $namespaces)) {
                if (empty($namespace) || strpos($ns, $namespace) === 0) {
                    $namespaces[] = $ns;
                }
            }
        }

        sort($namespaces);
        return $namespaces;
    }

    /**
     * Get the title of a page from its first heading.
     */
    public function getPageTitle($pageId) {
        $this->login();
        $content = $this->call('wiki.getPage', [$pageId]);

        if (empty($content)) {
            return $pageId;
        }

        // Match DokuWiki heading: ====== Title ======
        if (preg_match('/^=+\s*(.+?)\s*=+$/m', $content, $match)) {
            return trim($match[1]);
        }

        return $pageId;
    }

    /**
     * Build a complete graph data structure from all pages.
     * Returns nodes (pages + tags) and edges (links + tag associations).
     */
    public function buildGraph($baseNamespace = '') {
        $allPages = $this->getAllPages();
        $nodes = [];
        $edges = [];
        $tagNodes = [];

        foreach ($allPages as $page) {
            $id = $page['id'];

            // Filter by base namespace if set
            if (!empty($baseNamespace) && strpos($id, $baseNamespace . ':') !== 0 && $id !== $baseNamespace) {
                continue;
            }

            $ns = $this->getNamespace($id);
            $title = $this->getPageTitle($id);

            // Add page node
            $nodes[] = [
                'id' => $id,
                'label' => $title,
                'type' => 'page',
                'namespace' => $ns,
            ];

            // Get internal links
            $links = $this->getPageLinks($id);
            foreach ($links as $link) {
                $edges[] = [
                    'from' => $id,
                    'to' => $link,
                    'type' => 'link',
                ];
            }

            // Get tags
            $tags = $this->getPageTags($id);
            foreach ($tags as $tag) {
                $tagId = 'tag:' . $tag;
                if (!isset($tagNodes[$tagId])) {
                    $tagNodes[$tagId] = [
                        'id' => $tagId,
                        'label' => $tag,
                        'type' => 'tag',
                        'namespace' => '',
                    ];
                }
                $edges[] = [
                    'from' => $id,
                    'to' => $tagId,
                    'type' => 'tag',
                ];
            }
        }

        // Merge tag nodes into nodes array
        $nodes = array_merge($nodes, array_values($tagNodes));

        return [
            'nodes' => $nodes,
            'edges' => $edges,
        ];
    }
}
