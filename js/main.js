// main.js
// Loads live earthquake data from the USGS and draws each quake on the map.
// Also does the headline, the Latest list, the replay and all the buttons.
// The sound part is in sound.js.

const HOUR = 60 * 60 * 1000; // in milliseconds

// the 3 feeds for the Hour / Day / Week tabs
const feeds = {
  hour: { url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson', length: HOUR, text: 'In the past hour' },
  day: { url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson', length: 24 * HOUR, text: 'Over the past day' },
  week: { url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson', length: 7 * 24 * HOUR, text: 'This past week' }
};

// where we're "listening" from (used for left/right sound and the distance on the card)
const home = { name: 'Toronto', lat: 43.70, lon: -79.42 };

// these numbers match the map image so the circles land in the right spot.
// the map is centred on the Pacific (longitude 150) so the Ring of Fire isn't split in half
const mapCenterLon = 150;
const mapTop = 76.5;
const mapBottom = -61.5;

let currentWindow = 'day';
let quakes = [];      // newest first
let selected = null;  // the quake with its card open
let ripples = [];
let lastUpdate = 0;
let hasError = false;

let replaying = false;
let replayTime = 0;
let lastFrame = 0;

const headline = document.getElementById('headline');
const statusText = document.getElementById('statusText');
const listenBtn = document.getElementById('listenBtn');
const playBtn = document.getElementById('playBtn');
const list = document.getElementById('list');
const card = document.getElementById('card');
const toast = document.getElementById('toast');
const canvas = document.getElementById('map');
const ctx = canvas.getContext('2d');


// ---- loading the data ----

async function loadQuakes() {
  try {
    let response = await fetch(feeds[currentWindow].url);
    let data = await response.json();

    // pull out just the info I need from each quake
    let newQuakes = [];
    for (let f of data.features) {
      if (f.properties.type != 'earthquake') continue; // the feed also has quarry blasts etc.
      newQuakes.push({
        id: f.id,
        mag: f.properties.mag || 0,
        place: f.properties.place || 'Unknown location',
        time: f.properties.time,
        url: f.properties.url,
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        depth: f.geometry.coordinates[2]
      });
    }
    newQuakes.sort((a, b) => b.time - a.time);

    // any quake that wasn't there last time is new, so it gets a ripple, a sound and a pop-up
    // (skipped on the first load since there's nothing to compare to yet)
    if (quakes.length > 0) {
      let oldIds = new Set(quakes.map(q => q.id));
      let fresh = [];
      for (let q of newQuakes) {
        if (!oldIds.has(q.id)) fresh.push(q);
      }
      for (let i = 0; i < fresh.length; i++) {
        setTimeout(() => strike(fresh[i], true), i * 400);
      }
      if (fresh.length > 0) showToast(fresh[0], fresh.length);
    }

    quakes = newQuakes;
    lastUpdate = data.metadata.generated;
    hasError = false;
    updateHeadline();
    updateList();
  } catch (error) {
    console.log('Could not load the USGS feed', error);
    hasError = true;
    if (quakes.length == 0) {
      headline.textContent = "Can't reach the USGS feed right now. Trying again every minute.";
    }
  }
}


// ---- helper functions ----

// shallow = red, middle = amber, deep = blue
function depthColour(depth, alpha) {
  if (depth < 70) return 'rgba(210, 63, 42, ' + alpha + ')';
  if (depth < 300) return 'rgba(201, 138, 27, ' + alpha + ')';
  return 'rgba(36, 68, 122, ' + alpha + ')';
}

// magnitude is squared so the big quakes really stand out. circles get a bit smaller on small screens
function radius(mag) {
  let scale = Math.max(canvas.clientWidth / 1050, 0.6);
  return (2 + Math.max(mag, 0) * Math.max(mag, 0) * 0.4) * scale;
}

// turns longitude/latitude into x/y on the canvas
function toXY(lon, lat) {
  let x = ((lon - mapCenterLon + 540) % 360) / 360; // shifts the Pacific to the middle
  let y = (mapTop - lat) / (mapTop - mapBottom);
  return { x: x * canvas.clientWidth, y: y * canvas.clientHeight };
}

// distance between two places in km (haversine formula, since the earth is round)
function distanceKm(lat1, lon1, lat2, lon2) {
  let toRad = Math.PI / 180;
  let dLat = (lat2 - lat1) * toRad;
  let dLon = (lon2 - lon1) * toRad;
  let a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

function timeAgo(time) {
  let minutes = Math.round((Date.now() - time) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return minutes + ' min ago';
  if (minutes < 24 * 60) return Math.floor(minutes / 60) + ' h ago';
  let days = Math.floor(minutes / (24 * 60));
  if (days == 1) return '1 day ago';
  return days + ' days ago';
}

// "11 km W of Honmachi, Japan" sounds fine in the headline, but "Fiji region" needs a "the"
function nicePlace(place) {
  if (place.includes(' of ')) return place;
  return 'the ' + place;
}

// adds a ripple ring around a quake and plays its note
function strike(q, big, withSound = true) {
  let ripple = { quake: q, start: performance.now(), duration: 1500, size: 15 + q.mag * 5 };
  if (big) {
    ripple.duration = 2500;
    ripple.size = 45;
  }
  ripples.push(ripple);
  if (withSound) playQuake(q, home.lon);
}


// ---- headline + the CSS variables ----

function updateHeadline() {
  let feed = feeds[currentWindow];
  document.title = '揺れ YURE · ' + quakes.length + ' quakes';

  if (quakes.length == 0) {
    headline.textContent = feed.text + ', the Earth has kept still.';
    return;
  }

  let strongest = quakes[0];
  for (let q of quakes) {
    if (q.mag > strongest.mag) strongest = q;
  }
  headline.innerHTML = `${feed.text}, the Earth moved ${quakes.length.toLocaleString()} times. ` +
    `The strongest, <em>M${strongest.mag.toFixed(1)}</em>, came from ${nicePlace(strongest.place)}.`;

  // logo shakes more if there was a big quake in the last hour (between 0.15px and 4px)
  let biggestRecent = 0;
  for (let q of quakes) {
    if (q.time > Date.now() - HOUR && q.mag > biggestRecent) biggestRecent = q.mag;
  }
  let tremble = Math.min(Math.max((biggestRecent - 1.5) * 0.7, 0.15), 4);
  document.documentElement.style.setProperty('--tremble', tremble + 'px');

  // live dot pulses faster when there are more quakes per hour (between 0.6s and 4s)
  let perHour = quakes.length / (feed.length / HOUR);
  let pulse = Math.min(Math.max(6 / (1 + perHour / 4), 0.6), 4);
  document.documentElement.style.setProperty('--pulse', pulse + 's');
}


// ---- latest list ----

function updateList() {
  list.innerHTML = '';
  for (let q of quakes.slice(0, 6)) {
    let li = document.createElement('li');
    li.innerHTML = `
      <span class="list-mag" style="background:${depthColour(q.depth, 1)}">${q.mag.toFixed(1)}</span>
      <span class="list-place">${q.place}</span>
      <span class="list-time">${timeAgo(q.time)}</span>`;
    li.addEventListener('click', () => selectQuake(q));
    list.appendChild(li);
  }
}


// ---- drawing the map ----

function circle(x, y, r, stroke, fill, width = 1) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

// runs about 60 times a second
function draw() {
  let w = canvas.clientWidth;
  let h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  let now = Date.now();
  let windowLength = feeds[currentWindow].length;
  let currentTime = now;
  if (replaying) currentTime = replayTime;

  // draw oldest first so the newest ones end up on top
  for (let i = quakes.length - 1; i >= 0; i--) {
    let q = quakes[i];
    if (replaying && q.time > replayTime) continue; // hasn't happened yet in the replay

    let pos = toXY(q.lon, q.lat);
    q.x = pos.x; // saved so clicks can find it
    q.y = pos.y;
    let r = radius(q.mag);

    // older quakes fade out, but never below 0.25
    let alpha = Math.max(0.25, 1 - (currentTime - q.time) / windowLength);
    circle(q.x, q.y, r, depthColour(q.depth, alpha), depthColour(q.depth, alpha * 0.5));

    // quakes from the last hour keep pulsing
    if (!replaying && now - q.time < HOUR) {
      let t = ((performance.now() + q.time) % 2500) / 2500;
      circle(q.x, q.y, r + t * 16, depthColour(q.depth, (1 - t) * 0.7));
    }
  }

  // ripples grow and fade, then get removed
  for (let rp of ripples) {
    let t = (performance.now() - rp.start) / rp.duration;
    if (t < 1) {
      circle(rp.quake.x, rp.quake.y, radius(rp.quake.mag) + t * rp.size, depthColour(rp.quake.depth, 1 - t), null, 1.5);
    }
  }
  ripples = ripples.filter(rp => performance.now() - rp.start < rp.duration);

  // outline around the selected quake
  if (selected && selected.x != undefined) {
    circle(selected.x, selected.y, radius(selected.mag) + 4, '#1d1b18', null, 1.5);
  }

  // red progress bar at the bottom during the replay
  if (replaying) {
    let progress = 1 - (now - replayTime) / windowLength;
    ctx.fillStyle = '#d23f2a';
    ctx.fillRect(0, h - 3, w * progress, 3);
  }
}

// without this the canvas looks blurry on retina screens
function resizeCanvas() {
  let ratio = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * ratio;
  canvas.height = canvas.clientHeight * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}


// ---- replay ----
// plays the whole hour/day/week back in 40 seconds

function startReplay() {
  replayTime = Date.now() - feeds[currentWindow].length;
  lastFrame = performance.now();
  replaying = true;
  playBtn.classList.add('on');
  hideCard();
  if (!soundOn) toggleListen();
}

function stopReplay() {
  replaying = false;
  playBtn.textContent = '▶ Replay';
  playBtn.classList.remove('on');
}

function stepReplay() {
  if (!replaying) return;

  // move time forward (40 seconds of real time = the whole window)
  let before = replayTime;
  let speed = feeds[currentWindow].length / 40000;
  replayTime += (performance.now() - lastFrame) * speed;
  lastFrame = performance.now();

  // play the quakes we just passed. if there are tons of them, only play the 2.5+ ones
  let busy = quakes.length > 500;
  for (let q of quakes) {
    if (q.time > before && q.time <= replayTime) {
      strike(q, false, !busy || q.mag >= 2.5);
    }
  }

  playBtn.textContent = '■ ' + new Date(replayTime).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  if (replayTime >= Date.now()) stopReplay();
}


// ---- quake card + pop-up ----

function selectQuake(q) {
  if (replaying) stopReplay();
  selected = q;
  showCard(q);
  strike(q, true);
}

function showCard(q) {
  let km = Math.round(distanceKm(home.lat, home.lon, q.lat, q.lon));
  card.innerHTML = `
    <button class="card-close" aria-label="Close">×</button>
    <p class="card-mag" style="color:${depthColour(q.depth, 1)}">M${q.mag.toFixed(1)}</p>
    <p class="card-place">${q.place}</p>
    <p class="card-info">
      ${timeAgo(q.time)} · ${Math.round(q.depth)} km deep<br>
      ${km.toLocaleString()} km from ${home.name}
    </p>
    <a href="${q.url}" target="_blank">More on USGS ↗</a>`;
  card.classList.add('show');
  card.querySelector('.card-close').addEventListener('click', hideCard);

  // put the card next to the quake, flip it to the left side if it would go off the edge
  let left = q.x + 16;
  if (left + card.offsetWidth > canvas.clientWidth) {
    left = q.x - 16 - card.offsetWidth;
  }
  let top = q.y - card.offsetHeight / 2;
  top = Math.max(8, Math.min(top, canvas.clientHeight - card.offsetHeight - 8));
  card.style.left = Math.max(8, left) + 'px';
  card.style.top = top + 'px';
}

function hideCard() {
  selected = null;
  card.classList.remove('show');
}

function showToast(q, count) {
  if (count > 1) {
    toast.textContent = `新 ${count} new quakes · latest M${q.mag.toFixed(1)} ${q.place}`;
  } else {
    toast.textContent = `新 New quake · M${q.mag.toFixed(1)} ${q.place}`;
  }
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 6000);
}


// ---- buttons, clicks and keys ----

function toggleListen() {
  if (soundOn) {
    stopSound();
    listenBtn.textContent = 'Listen';
    listenBtn.classList.remove('on');
  } else {
    startSound();
    listenBtn.textContent = 'Listening';
    listenBtn.classList.add('on');
    // play the 3 newest quakes as a little hello
    let newest = quakes.slice(0, 3).reverse();
    for (let i = 0; i < newest.length; i++) {
      setTimeout(() => strike(newest[i], true), 200 + i * 600);
    }
  }
}

listenBtn.addEventListener('click', toggleListen);

playBtn.addEventListener('click', () => {
  if (replaying) stopReplay();
  else startReplay();
});

// Hour / Day / Week tabs
let tabs = document.querySelectorAll('#windowBtns button');
for (let button of tabs) {
  button.addEventListener('click', () => {
    for (let b of tabs) b.classList.remove('active');
    button.classList.add('active');
    currentWindow = button.dataset.window;
    stopReplay();
    hideCard();
    quakes = [];
    headline.textContent = 'Listening for the Earth...';
    loadQuakes();
  });
}

// finds the closest quake to the mouse (if the mouse is on or near its circle)
function quakeAt(event) {
  let box = canvas.getBoundingClientRect();
  let mx = event.clientX - box.left;
  let my = event.clientY - box.top;
  let found = null;
  let bestDistance = Infinity;
  for (let q of quakes) {
    if (q.x == undefined) continue;
    if (replaying && q.time > replayTime) continue;
    let d = Math.hypot(q.x - mx, q.y - my);
    if (d < Math.max(radius(q.mag) + 4, 8) && d < bestDistance) {
      found = q;
      bestDistance = d;
    }
  }
  return found;
}

canvas.addEventListener('click', (event) => {
  let q = quakeAt(event);
  if (q) selectQuake(q);
  else hideCard();
});

canvas.addEventListener('mousemove', (event) => {
  if (quakeAt(event)) canvas.style.cursor = 'pointer';
  else canvas.style.cursor = 'crosshair';
});

// space = replay, esc = close card (skip when a button is focused, since space already clicks it)
document.addEventListener('keydown', (event) => {
  if (event.target.tagName == 'BUTTON') return;
  if (event.code == 'Space') {
    event.preventDefault();
    playBtn.click();
  }
  if (event.key == 'Escape') hideCard();
});

window.addEventListener('resize', () => {
  resizeCanvas();
  hideCard();
});


// status text in the top corner

function updateStatus() {
  let status = document.querySelector('.status');
  if (hasError) {
    status.classList.add('error');
    statusText.textContent = 'Connection lost, retrying...';
  } else if (lastUpdate) {
    status.classList.remove('error');
    statusText.textContent = 'Live · updated ' + Math.round((Date.now() - lastUpdate) / 1000) + ' s ago';
  }
}


// starts everything

function animate() {
  stepReplay();
  draw();
  requestAnimationFrame(animate);
}

resizeCanvas();
loadQuakes();
setInterval(loadQuakes, 60000);   // USGS updates the feed every minute
setInterval(updateStatus, 1000);
setInterval(updateList, 30000);   // keeps the "x min ago" times up to date
requestAnimationFrame(animate);