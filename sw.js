self.importScripts('lib/idb.js');

var cacheID = "mws-restaruant-stage3";
let dbReady = false;

const dbPromise = idb.open("mws-restaurant", 3, upgradeDB => {
  switch (upgradeDB.oldVersion) {
    case 0:
      upgradeDB.createObjectStore("restaurants", { keyPath: "id" });
    case 1:
      const reviewsStore = upgradeDB.createObjectStore("reviews", {keyPath: "id"});
      reviewsStore.createIndex("restaurant_id", "restaurant_id");
    case 2:
      upgradeDB.createObjectStore("pending", {
        keyPath: "id",
        autoIncrement: true
      });
  }
});

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(cacheID).then(cache => {
      return cache
        .addAll([
          "/",
          "/index.html",
          "/restaurant.html",
          "/review.html",
          "/css/styles.css",
          "/css/restaurant.css",
          "/css/review.css",
          "/js/dbhelper.js",
          "/js/main.js",
          "/js/restaurant_info.js",
          "/js/reviews.js",
          "/js/register.js",
          "/lib/idb.js",
          "/sw.js",
          "/img/small/1_1x.webp",
          "/img/small/1_2x.webp",
          "/img/small/2_1x.webp",
          "/img/small/2_2x.webp",
          "/img/small/3_1x.webp",
          "/img/small/3_2x.webp",
          "/img/small/4_1x.webp",
          "/img/small/4_2x.webp",
          "/img/small/5_1x.webp",
          "/img/small/5_2x.webp",
          "/img/small/6_1x.webp",
          "/img/small/6_2x.webp",
          "/img/small/7_1x.webp",
          "/img/small/7_2x.webp",
          "/img/small/8_1x.webp",
          "/img/small/8_2x.webp",
          "/img/small/9_1x.webp",
          "/img/small/9_2x.webp",
          "/img/small/10_1x.webp",
          "/img/small/10_2x.webp",
          "/img/big/1_1x.webp",
          "/img/big/1_2x.webp",
          "/img/big/2_1x.webp",
          "/img/big/2_2x.webp",
          "/img/big/3_1x.webp",
          "/img/big/3_2x.webp",
          "/img/big/4_1x.webp",
          "/img/big/4_2x.webp",
          "/img/big/5_1x.webp",
          "/img/big/5_2x.webp",
          "/img/big/6_1x.webp",
          "/img/big/6_2x.webp",
          "/img/big/7_1x.webp",
          "/img/big/7_2x.webp",
          "/img/big/8_1x.webp",
          "/img/big/8_2x.webp",
          "/img/big/9_1x.webp",
          "/img/big/9_2x.webp",
          "/img/big/10_1x.webp",
          "/img/big/10_2x.webp",
          "/img/picture-not-available.webp"
        ])
        .catch(error => {
          console.log("Caches open failed: " + error);
        });
    })
  );
});

self.addEventListener("fetch", event => {
  let cacheRequest = event.request;
  let cacheUrlObj = new URL(event.request.url);

  if (event.request.url.indexOf("restaurant.html") > -1) {
    const cacheURL = "restaurant.html";
    cacheRequest = new Request(cacheURL);
  }

  // Requests going to the API get handled separately from those going to other destinations
  const checkURL = new URL(event.request.url);
  if (checkURL.port === "1337") {

    const parts = checkURL.pathname.split("/");
    let id = checkURL.searchParams.get("restaurant_id") - 0;
    if (!id) {
      if (checkURL.pathname.indexOf("restaurants")) {
        id = parts[parts.length - 1] === "restaurants" ? "-1" : parts[parts.length - 1];
      } else {
        id = checkURL.searchParams.get("restaurant_id");
      }
    }
/*
    const parts = checkURL.pathname.split("/");
    const id = parts[parts.length - 1] === "restaurants" ? "-1" : parts[parts.length - 1];
*/
    handleAJAXEvent(event, id);
  } else {
    handleNonAJAXEvent(event, cacheRequest);
  }
});

/*
const handleAJAXEvent = (event, id) => {
  // Check the IndexedDB to see if the JSON for the API
  // has already been stored there. If so, return that.
  // If not, request it from the API, store it, and then
  // return it back.
  event.respondWith(
    dbPromise
      .then(db => {
        return db
          .transaction("restaurants")
          .objectStore("restaurants")
          .get(id);
      })
      .then(data => {
        return (
          (data && data.data) ||
          fetch(event.request)
            .then(fetchResponse => fetchResponse.json())
            .then(json => {
              return dbPromise.then(db => {
                const tx = db.transaction("restaurants", "readwrite");
                tx.objectStore("restaurants").put({
                  id: id,
                  data: json
                });
                return json;
              });
            })
        );
      })
      .then(finalResponse => {
        return new Response(JSON.stringify(finalResponse));
      })
      .catch(error => {
        return new Response("Error fetching data", { status: 500 });
      })
  );
};
*/
const handleAJAXEvent = (event, id) => {
  // Only use caching for GET events
  if (event.request.method !== "GET") {
    return fetch(event.request).then(fetchResponse => fetchResponse.json()).then(json => {
        return json
      });
  }

  // Split these request for handling restaurants vs reviews
  if (event.request.url.indexOf("reviews") > -1) {
    handleReviewsEvent(event, id);
  } else {
    handleRestaurantEvent(event, id);
  }
};

const handleReviewsEvent = (event, id) => {
  event.respondWith(dbPromise.then(db => {
    return db.transaction("reviews").objectStore("reviews").index("restaurant_id").getAll(id);
  }).then(data => {
    return (data.length && data) || fetch(event.request)
      .then(fetchResponse => fetchResponse.json())
      .then(data => {
        return dbPromise.then(idb => {
          const itx = idb.transaction("reviews", "readwrite");
          const store = itx.objectStore("reviews");
          data.forEach(review => {
            store.put({id: review.id, "restaurant_id": review["restaurant_id"], data: review});
          })
          return data;
        })
      })
  }).then(finalResponse => {
    if (finalResponse[0].data) {
      // Need to transform the data to the proper format
      const mapResponse = finalResponse.map(review => review.data);
      return new Response(JSON.stringify(mapResponse));
    }
    return new Response(JSON.stringify(finalResponse));
  }).catch(error => {
    return new Response("Error fetching data", {status: 500})
  }))
};

const handleRestaurantEvent = (event, id) => {
  // Check the IndexedDB to see if the JSON for the API has already been stored
  // there. If so, return that. If not, request it from the API, store it, and
  // then return it back.
  event.respondWith(dbPromise.then(db => {
    return db.transaction("restaurants").objectStore("restaurants").get(id);
  }).then(data => {
    return (data && data.data) || fetch(event.request).then(fetchResponse => fetchResponse.json()).then(json => {
        return dbPromise.then(db => {
          const tx = db.transaction("restaurants", "readwrite");
          const store = tx.objectStore("restaurants");
          store.put({id: id, data: json});
          return json;
        });
      });
  }).then(finalResponse => {
    return new Response(JSON.stringify(finalResponse));
  }).catch(error => {
    return new Response("Error fetching data", {status: 500});
  }));
};

const handleNonAJAXEvent = (event, cacheRequest) => {
  // Check if the HTML request has previously been cached.
  // If so, return the response from the cache. If not,
  // fetch the request, cache it, and then return it.
  event.respondWith(caches.match(cacheRequest, { ignoreSearch: true }).then(response => {
    return (response || fetch(event.request).then(fetchResponse => {
      return caches.open(cacheID).then(cache => {
          if (fetchResponse.url.indexOf("browser-sync") === -1) {
            cache.put(event.request, fetchResponse.clone());
          }
          return fetchResponse;
        });
    }).catch(error => {
      if (event.request.url.indexOf(".webp") > -1) {
        return caches.match("/img/picture-not-available.webp");
      }
      return new Response("Application is not connected to the internet", {
        status: 404,
        statusText: "Application is not connected to the internet"
      });
    }));
  }));
};
