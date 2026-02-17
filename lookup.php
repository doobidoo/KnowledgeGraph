<?php
/**
 * DokuWiki Knowledge Graph - API Proxy
 *
 * Routes frontend requests to the DokuWiki XML-RPC API.
 * Keeps credentials server-side and avoids CORS issues.
 */

header('Content-Type: application/json; charset=utf-8');

// Load configuration
$config = require __DIR__ . '/config.php';

// Validate configuration
if (empty($config['wiki_url'])) {
    http_response_code(500);
    echo json_encode(['error' => 'Wiki URL not configured. Please edit config.php.']);
    exit;
}

require_once __DIR__ . '/dokuwiki_api.php';

// Simple file-based cache
function getCacheFile($key) {
    $dir = __DIR__ . '/cache';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    return $dir . '/' . md5($key) . '.json';
}

function getCache($key, $ttl) {
    if ($ttl <= 0) return null;
    $file = getCacheFile($key);
    if (file_exists($file) && (time() - filemtime($file)) < $ttl) {
        return json_decode(file_get_contents($file), true);
    }
    return null;
}

function setCache($key, $data) {
    $file = getCacheFile($key);
    file_put_contents($file, json_encode($data));
}

try {
    $api = new DokuWikiAPI($config);
    $action = $_GET['api'] ?? '';
    $page = $_GET['page'] ?? '';
    $cacheTtl = $config['cache_ttl'] ?? 300;

    switch ($action) {

        // Get the display name / title of a page
        case 'pagename':
            if (empty($page)) {
                echo json_encode(['error' => 'Missing page parameter']);
                break;
            }
            $cacheKey = "pagename:$page";
            $cached = getCache($cacheKey, $cacheTtl);
            if ($cached !== null) {
                echo json_encode($cached);
                break;
            }
            $title = $api->getPageTitle($page);
            $result = ['id' => $page, 'title' => $title];
            setCache($cacheKey, $result);
            echo json_encode($result);
            break;

        // Get internal links of a page
        case 'links':
            if (empty($page)) {
                echo json_encode(['error' => 'Missing page parameter']);
                break;
            }
            $cacheKey = "links:$page";
            $cached = getCache($cacheKey, $cacheTtl);
            if ($cached !== null) {
                echo json_encode($cached);
                break;
            }
            $links = $api->getPageLinks($page);
            setCache($cacheKey, $links);
            echo json_encode($links);
            break;

        // Get tags of a page
        case 'tags':
            if (empty($page)) {
                echo json_encode(['error' => 'Missing page parameter']);
                break;
            }
            $cacheKey = "tags:$page";
            $cached = getCache($cacheKey, $cacheTtl);
            if ($cached !== null) {
                echo json_encode($cached);
                break;
            }
            $tags = $api->getPageTags($page);
            setCache($cacheKey, $tags);
            echo json_encode($tags);
            break;

        // Get page info (title, namespace, tags combined)
        case 'pageinfo':
            if (empty($page)) {
                echo json_encode(['error' => 'Missing page parameter']);
                break;
            }
            $cacheKey = "pageinfo:$page";
            $cached = getCache($cacheKey, $cacheTtl);
            if ($cached !== null) {
                echo json_encode($cached);
                break;
            }
            $title = $api->getPageTitle($page);
            $tags = $api->getPageTags($page);
            $ns = explode(':', $page);
            array_pop($ns);
            $namespace = implode(':', $ns);
            $result = [
                'id' => $page,
                'title' => $title,
                'namespace' => $namespace,
                'tags' => $tags,
            ];
            setCache($cacheKey, $result);
            echo json_encode($result);
            break;

        // Get all pages (optionally filtered by namespace)
        case 'allpages':
            $ns = $_GET['namespace'] ?? $config['base_namespace'];
            $cacheKey = "allpages:$ns";
            $cached = getCache($cacheKey, $cacheTtl);
            if ($cached !== null) {
                echo json_encode($cached);
                break;
            }
            $allPages = $api->getAllPages();
            $result = [];
            $limit = $config['max_pages'] ?? 500;
            $count = 0;
            foreach ($allPages as $p) {
                if (!empty($ns) && strpos($p['id'], $ns . ':') !== 0 && $p['id'] !== $ns) {
                    continue;
                }
                $result[] = ['id' => $p['id'], 'size' => $p['size'] ?? 0];
                $count++;
                if ($count >= $limit) break;
            }
            setCache($cacheKey, $result);
            echo json_encode($result);
            break;

        // Get all namespaces
        case 'namespaces':
            $ns = $_GET['namespace'] ?? $config['base_namespace'];
            $cacheKey = "namespaces:$ns";
            $cached = getCache($cacheKey, $cacheTtl);
            if ($cached !== null) {
                echo json_encode($cached);
                break;
            }
            $namespaces = $api->getNamespaces($ns);
            setCache($cacheKey, $namespaces);
            echo json_encode($namespaces);
            break;

        // Get pages by tag
        case 'tagpages':
            $tag = $_GET['tag'] ?? '';
            if (empty($tag)) {
                echo json_encode(['error' => 'Missing tag parameter']);
                break;
            }

            // 1. Check cached tag index (1h TTL)
            $indexKey = "tagindex";
            $tagIndex = getCache($indexKey, 3600);
            if ($tagIndex !== null) {
                $result = isset($tagIndex[$tag]) ? $tagIndex[$tag] : [];
                echo json_encode($result);
                break;
            }

            // 2. No index — scan per-page tag caches + fetch uncached
            // Use ALL pages (no max_pages limit) for complete tag coverage
            $tagPagesKey = "allpages_full";
            $pages = getCache($tagPagesKey, $cacheTtl);
            if ($pages === null) {
                $allPages = $api->getAllPages();
                $pages = [];
                foreach ($allPages as $p) {
                    $pages[] = ['id' => $p['id']];
                }
                setCache($tagPagesKey, $pages);
            }

            $result = [];
            $uncached = [];
            foreach ($pages as $p) {
                $pageTagsCache = getCache("tags:" . $p['id'], $cacheTtl);
                if ($pageTagsCache !== null) {
                    if (in_array($tag, $pageTagsCache)) {
                        $result[] = ['id' => $p['id']];
                    }
                } else {
                    $uncached[] = $p['id'];
                }
            }

            // Fetch tags for uncached pages (limit to avoid timeout)
            $fetchLimit = min(count($uncached), 50);
            for ($i = 0; $i < $fetchLimit; $i++) {
                $pageTags = $api->getPageTags($uncached[$i]);
                setCache("tags:" . $uncached[$i], $pageTags);
                if (in_array($tag, $pageTags)) {
                    $result[] = ['id' => $uncached[$i]];
                }
            }

            echo json_encode($result);
            break;

        // Search pages
        case 'search':
            $query = $_GET['q'] ?? '';
            if (empty($query)) {
                echo json_encode(['error' => 'Missing q parameter']);
                break;
            }
            $results = $api->searchPages($query);
            echo json_encode($results);
            break;

        // Get a random page
        case 'random':
            $ns = $config['base_namespace'];
            $cacheKey = "allpages:$ns";
            $cached = getCache($cacheKey, $cacheTtl);
            $pages = $cached;
            if ($pages === null) {
                $allPages = $api->getAllPages();
                $pages = [];
                foreach ($allPages as $p) {
                    if (!empty($ns) && strpos($p['id'], $ns . ':') !== 0 && $p['id'] !== $ns) {
                        continue;
                    }
                    $pages[] = ['id' => $p['id']];
                }
                setCache($cacheKey, $pages);
            }
            if (empty($pages)) {
                echo json_encode(['error' => 'No pages found']);
                break;
            }
            $random = $pages[array_rand($pages)];
            echo json_encode($random);
            break;

        // Build the complete graph (expensive, use caching)
        case 'graph':
            $ns = $_GET['namespace'] ?? $config['base_namespace'];
            $cacheKey = "graph:$ns";
            $cached = getCache($cacheKey, $cacheTtl);
            if ($cached !== null) {
                echo json_encode($cached);
                break;
            }
            $graph = $api->buildGraph($ns);
            setCache($cacheKey, $graph);
            echo json_encode($graph);
            break;

        // Get configuration info for the frontend
        case 'config':
            echo json_encode([
                'wiki_url' => $config['wiki_url'],
                'base_namespace' => $config['base_namespace'],
            ]);
            break;

        default:
            echo json_encode(['error' => 'Unknown API action: ' . $action]);
            break;
    }

} catch (Exception $e) {
    http_response_code(500);
    $errorResponse = ['error' => $e->getMessage()];
    if ($config['debug']) {
        $errorResponse['trace'] = $e->getTraceAsString();
    }
    echo json_encode($errorResponse);
}
