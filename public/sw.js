/**
 * Nyaya service worker — hand-written (no @serwist/next build plugin).
 *
 * Caching strategy:
 *   /api/ai/*            → network-only (never cache AI responses)
 *   /api/content/*       → stale-while-revalidate
 *   same-origin GET      → cache-first, network fallback; navigation fallback → /offline.html
 *   POST /api/reports    → queue for background sync retry on failure
 *
 * Cache name: nyaya-v1
 *
 * Designed to never crash if `caches`, `clients`, or `sync` APIs are unavailable
 * (older browsers / private-mode Safari). All feature detection is guarded.
 */

var CACHE = "nyaya-v1";
var PRECACHE_URLS = [
  "/",
  "/emergency",
  "/rights",
  "/info",
  "/offline.html",
  "/manifest.json",
  "/icons/icon.svg",
];

var OFFLINE_URL = "/offline.html";
var REPORTS_QUEUE = "nyaya-reports-queue";

// ── install: precache the app shell ──────────────────────────────
self.addEventListener("install", function (event) {
  if (typeof caches === "undefined") return;
  event.waitUntil(
    caches
      .open(CACHE)
      .then(function (cache) {
        // Use addAll but tolerate individual failures (e.g. /info 404 during dev).
        return Promise.all(
          PRECACHE_URLS.map(function (url) {
            return cache
              .add(new Request(url, { cache: "reload" }))
              .catch(function (err) {
                console.warn("[sw] precache miss:", url, err && err.message);
              });
          })
        );
      })
      .then(function () {
        if (self.skipWaiting) self.skipWaiting();
      })
  );
});

// ── activate: purge old caches + claim clients ───────────────────
self.addEventListener("activate", function (event) {
  if (typeof caches === "undefined") return;
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (k) {
              return k !== CACHE;
            })
            .map(function (k) {
              return caches.delete(k);
            })
        );
      })
      .then(function () {
        if (self.clients && self.clients.claim) return self.clients.claim();
      })
  );
});

// ── fetch: route by URL pattern ──────────────────────────────────
self.addEventListener("fetch", function (event) {
  var req = event.request;

  // Only handle same-origin requests. Cross-origin (CDN, OSM tiles, Groq,
  // maps) is left to the browser — caching it here would balloon storage
  // and we have no way to validate cross-origin responses reliably.
  if (new URL(req.url).origin !== self.location.origin) return;

  // POST /api/reports → queue for background sync on failure
  if (req.method === "POST" && req.url.indexOf("/api/reports") !== -1) {
    event.respondWith(handleReportPost(req));
    return;
  }

  // Non-GET requests (POST/PUT/DELETE/PATCH) → straight to network
  if (req.method !== "GET") return;

  // /api/ai/* → network-only (never cache AI responses)
  if (req.url.indexOf("/api/ai/") !== -1) {
    event.respondWith(fetch(req).catch(function () {
      return new Response(
        JSON.stringify({
          error: "offline",
          message:
            "You are offline. The AI assistant is unavailable — please reconnect. Emergency playbooks and saved rights are still available.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }));
    return;
  }

  // /api/content/* → stale-while-revalidate
  if (req.url.indexOf("/api/content/") !== -1) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Same-origin GET → cache-first with network fallback.
  // Navigations fall back to /offline.html when both cache and network fail.
  var isNavigation =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").indexOf("text/html") !== -1;

  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) {
        // Revalidate in background
        fetch(req)
          .then(function (fresh) {
            if (fresh && fresh.status === 200) {
              caches.open(CACHE).then(function (c) {
                c.put(req, fresh.clone()).catch(function () {});
              });
            }
          })
          .catch(function () {
            /* offline — cache is fine */
          });
        return cached;
      }
      return fetch(req)
        .then(function (res) {
          if (res && res.status === 200 && res.type === "basic") {
            var clone = res.clone();
            caches.open(CACHE).then(function (c) {
              c.put(req, clone).catch(function () {});
            });
          }
          return res;
        })
        .catch(function () {
          if (isNavigation) {
            return caches.match(OFFLINE_URL).then(function (off) {
              return off || new Response("You are offline.", { status: 503 });
            });
          }
          return new Response("Offline", { status: 503 });
        });
    })
  );
});

// ── background sync: retry queued /api/reports POSTs ──────────────
function handleReportPost(req) {
  return fetch(req.clone()).catch(function () {
    // Network failed — queue for retry if Background Sync is supported.
    return queueForRetry(req).then(function () {
      return new Response(
        JSON.stringify({
          ok: true,
          queued: true,
          message:
            "You are offline. Your report was saved and will be submitted automatically when you reconnect.",
        }),
        { status: 202, headers: { "Content-Type": "application/json" } }
      );
    });
  });
}

function queueForRetry(req) {
  return req
    .clone()
    .text()
    .then(function (body) {
      return openReportsQueue().then(function (store) {
        return store.put({
          id: Date.now() + "-" + Math.random().toString(36).slice(2),
          url: req.url,
          method: req.method,
          body: body,
          contentType: req.headers.get("content-type") || "application/json",
          queuedAt: Date.now(),
        });
      });
    });
}

function openReportsQueue() {
  return new Promise(function (resolve, reject) {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    try {
      var req = indexedDB.open(REPORTS_QUEUE, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains("reports")) {
          db.createObjectStore("reports", { keyPath: "id" });
        }
      };
      req.onsuccess = function () {
        var db = req.result;
        var tx = db.transaction("reports", "readwrite");
        resolve(tx.objectStore("reports"));
      };
      req.onerror = function () {
        reject(req.error || new Error("IndexedDB open failed"));
      };
    } catch (e) {
      reject(e);
    }
  });
}

function flushReportsQueue() {
  return openReportsQueue()
    .then(function (store) {
      return new Promise(function (resolve) {
        var allReq = store.getAll();
        allReq.onsuccess = function () {
          var items = allReq.result || [];
          if (!items.length) return resolve(0);
          var done = 0;
          var cleared = 0;
          items.forEach(function (item) {
            fetch(item.url, {
              method: item.method,
              headers: { "Content-Type": item.contentType },
              body: item.body,
            })
              .then(function (res) {
                if (res && res.ok) {
                  var del = store.delete(item.id);
                  del.onsuccess = function () {
                    cleared++;
                    if (++done === items.length) resolve(cleared);
                  };
                  del.onerror = function () {
                    if (++done === items.length) resolve(cleared);
                  };
                } else {
                  if (++done === items.length) resolve(cleared);
                }
              })
              .catch(function () {
                if (++done === items.length) resolve(cleared);
              });
          });
        };
        allReq.onerror = function () {
          resolve(0);
        };
      });
    })
    .catch(function () {
      return 0;
    });
}

// 'sync' event (Background Sync API) — fires when connectivity returns.
self.addEventListener("sync", function (event) {
  if (event.tag === "nyaya-reports-sync") {
    event.waitUntil(flushReportsQueue());
  }
});

// 'periodicsync' (Periodic Background Sync, optional) — best effort only.
self.addEventListener("periodicsync", function (event) {
  if (event.tag === "nyaya-content-refresh") {
    event.waitUntil(refreshContentCache());
  }
});

function refreshContentCache() {
  if (typeof caches === "undefined") return Promise.resolve();
  return caches.open(CACHE).then(function (cache) {
    return Promise.all(
      PRECACHE_URLS.map(function (url) {
        return cache
          .add(new Request(url, { cache: "reload" }))
          .catch(function () {});
      })
    );
  });
}

// Listen for 'message' from clients to manually trigger a queue flush
// (used on platforms where Background Sync isn't supported).
self.addEventListener("message", function (event) {
  if (!event.data) return;
  if (event.data.type === "FLUSH_REPORTS") {
    flushReportsQueue().then(function (n) {
      if (event.source && event.source.postMessage) {
        event.source.postMessage({
          type: "FLUSH_REPORTS_RESULT",
          flushed: n,
        });
      }
    });
  }
  if (event.data.type === "SKIP_WAITING") {
    if (self.skipWaiting) self.skipWaiting();
  }
});
