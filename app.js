// Local Weather: vanilla JS. Weather: Open-Meteo. Place name: BigDataCloud (free, no key).
"use strict";
const $ = id => document.getElementById(id);
const LOCATION_ENDPOINT = "https://weather-forcasts.ua6b47385.workers.dev/api/location";
const state = { unit: "C", lat: null, lon: null, place: "", accuracy: null, data: null, geoDenied: false };

// WMO weather codes (Open-Meteo docs) -> label + emoji
const CODES = {0:["Clear sky","☀️","🌙"],1:["Mainly clear","🌤️","🌙"],2:["Partly cloudy","⛅","☁️"],3:["Overcast","☁️","☁️"],
  45:["Fog","🌫️"],48:["Rime fog","🌫️"],51:["Light drizzle","🌦️"],53:["Drizzle","🌦️"],55:["Heavy drizzle","🌧️"],
  56:["Freezing drizzle","🌧️"],57:["Freezing drizzle","🌧️"],61:["Light rain","🌦️"],63:["Rain","🌧️"],65:["Heavy rain","🌧️"],
  66:["Freezing rain","🌧️"],67:["Freezing rain","🌧️"],71:["Light snow","🌨️"],73:["Snow","🌨️"],75:["Heavy snow","❄️"],
  77:["Snow grains","🌨️"],80:["Light showers","🌦️"],81:["Showers","🌧️"],82:["Violent showers","⛈️"],
  85:["Snow showers","🌨️"],86:["Heavy snow showers","❄️"],95:["Thunderstorm","⛈️"],96:["Thunderstorm, hail","⛈️"],99:["Thunderstorm, heavy hail","⛈️"]};
function describe(code, isDay = 1) {
  const c = CODES[code] || ["Unknown", "❔"];
  return { label: c[0], icon: (!isDay && c[2]) ? c[2] : c[1] };
}

// ---- UI helpers ----
function status(msg, isError) {
  const el = $("status");
  el.textContent = msg || "";
  el.hidden = !msg;
  el.classList.toggle("error", !!isError);
}
function show(view) { $("welcome").hidden = view !== "welcome"; $("dashboard").hidden = view !== "dashboard"; }
const temp = c => Math.round(state.unit === "C" ? c : c * 9 / 5 + 32) + "°";
const compass = d => ["N","NE","E","SE","S","SW","W","NW"][Math.round(d / 45) % 8];
const clock = iso => iso.slice(11, 16); // times arrive in the location's own timezone

// ---- Network ----
async function getJSON(url) {
  let res;
  try { res = await fetch(url); } catch { throw new Error("Network error. Check your connection and try again."); }
  if (!res.ok) throw new Error("The service returned an error (" + res.status + "). Try again shortly.");
  return res.json();
}

async function sendLocationToServer() {
  const response = await fetch(LOCATION_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latitude: state.lat, longitude: state.lon, accuracy: state.accuracy })
  });
  if (!response.ok) throw new Error("The server returned " + response.status + ".");
}

async function fetchWeather() {
  const p = new URLSearchParams({
    latitude: state.lat, longitude: state.lon, timezone: "auto", forecast_days: 1, wind_speed_unit: "kmh",
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m,precipitation",
    hourly: "temperature_2m,precipitation_probability,weather_code,is_day",
    daily: "temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max"
  });
  return getJSON("https://api.open-meteo.com/v1/forecast?" + p);
}

async function reverseGeocode(lat, lon) {
  try {
    const d = await getJSON(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
    const name = [d.city || d.locality, d.principalSubdivision, d.countryName].filter(Boolean);
    return [...new Set(name)].join(", ") || "Your location";
  } catch { return "Your location"; } // name is optional; weather still works
}

// ---- Main flow ----
async function loadWeather() {
  status("Loading weather…");
  $("refreshBtn").disabled = true;
  try {
    state.data = await fetchWeather();
    render();
    show("dashboard");
    status("");
  } catch (e) {
    status(e.message, true);
  } finally { $("refreshBtn").disabled = false; }
}

function render() {
  const d = state.data, cur = d.current, day = d.daily;
  const w = describe(cur.weather_code, cur.is_day);
  $("placeName").textContent = state.place || "Your location";
  $("coords").textContent = `Lat ${(+state.lat).toFixed(4)}, Lon ${(+state.lon).toFixed(4)}` +
    (state.accuracy ? ` · accuracy about ±${Math.round(state.accuracy)} m` : "");
  $("icon").textContent = w.icon;
  $("temp").textContent = temp(cur.temperature_2m);
  $("cond").textContent = w.label;
  $("feels").textContent = "Feels like " + temp(cur.apparent_temperature);
  $("hum").textContent = cur.relative_humidity_2m + "%";
  $("wind").textContent = `${Math.round(cur.wind_speed_10m)} km/h ${compass(cur.wind_direction_10m)}`;
  $("rain").textContent = day.precipitation_probability_max[0] == null ? "n/a" : day.precipitation_probability_max[0] + "%";
  $("range").textContent = `${temp(day.temperature_2m_min[0])} / ${temp(day.temperature_2m_max[0])}`;
  $("rise").textContent = clock(day.sunrise[0]);
  $("set").textContent = clock(day.sunset[0]);
  $("updated").textContent = "Local time at this place: " + clock(cur.time) + " · data from Open-Meteo";

  const list = $("hourly");
  list.textContent = "";
  const nowHour = cur.time.slice(0, 13);
  d.hourly.time.forEach((t, i) => {
    if (t.slice(0, 13) < nowHour) return; // only the rest of today
    const hw = describe(d.hourly.weather_code[i], d.hourly.is_day[i]);
    const li = document.createElement("li");
    li.innerHTML = '<div class="h"></div><div class="i" aria-hidden="true"></div><div class="t"></div><div class="p"></div>';
    li.querySelector(".h").textContent = clock(t);
    li.querySelector(".i").textContent = hw.icon;
    li.querySelector(".t").textContent = temp(d.hourly.temperature_2m[i]);
    li.querySelector(".p").textContent = d.hourly.precipitation_probability[i] == null ? "" : d.hourly.precipitation_probability[i] + "%";
    li.title = hw.label;
    list.appendChild(li);
  });
}

// ---- Geolocation (only on button click) ----
async function detect() {
  if (state.geoDenied) { status("Location was denied earlier. Use the manual search, or allow location in your browser's site settings and reload.", true); return; }
  if (!("geolocation" in navigator)) { status("This browser has no geolocation support. Use the manual search.", true); return; }
  // If the browser already reports "denied", don't trigger anything.
  try {
    const perm = await navigator.permissions?.query({ name: "geolocation" });
    if (perm && perm.state === "denied") { state.geoDenied = true; $("detectBtn").disabled = true; status("Location is blocked for this site. Use the manual search, or allow it in your browser settings.", true); return; }
  } catch { /* Permissions API not available: continue */ }

  status("Waiting for your browser's permission prompt…");
  $("detectBtn").disabled = true;
  navigator.geolocation.getCurrentPosition(async pos => {
    state.lat = pos.coords.latitude; state.lon = pos.coords.longitude; state.accuracy = pos.coords.accuracy;
    status("Location found. Sending it to this site's server and loading weather…");
    const locationReport = sendLocationToServer().then(() => true, () => false);
    state.place = await reverseGeocode(state.lat, state.lon);
    $("detectBtn").disabled = false;
    await loadWeather();
    if (await locationReport) {
      status("Location sent to this site's server.");
    } else {
      status("Weather loaded, but this site's server could not receive your location. Check that /api/location is configured.", true);
    }
  }, err => {
    const msgs = { 1: "Permission denied. You can search by city or coordinates instead.", 2: "Your position is unavailable right now. Try again or search manually.", 3: "Location request timed out. Try again or search manually." };
    if (err.code === 1) { state.geoDenied = true; } else { $("detectBtn").disabled = false; }
    status(msgs[err.code] || "Could not get your location.", true);
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
}

// ---- Manual entry: "lat, lon" or a city name ----
async function manual(e) {
  e.preventDefault();
  const q = $("manualInput").value.trim();
  if (!q) return;
  const m = q.match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
  state.accuracy = null;
  try {
    if (m) {
      const lat = +m[1], lon = +m[2];
      if (Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error("Latitude must be −90 to 90 and longitude −180 to 180.");
      state.lat = lat; state.lon = lon; state.place = await reverseGeocode(lat, lon);
    } else {
      status("Searching…");
      const r = await getJSON("https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&name=" + encodeURIComponent(q));
      if (!r.results || !r.results.length) throw new Error(`No place found for "${q}". Try another spelling or enter coordinates.`);
      const p = r.results[0];
      state.lat = p.latitude; state.lon = p.longitude;
      state.place = [p.name, p.admin1, p.country].filter(Boolean).join(", ");
    }
    loadWeather();
  } catch (err) { status(err.message, true); }
}

function setUnit(u) {
  state.unit = u;
  $("unitC").setAttribute("aria-pressed", u === "C");
  $("unitF").setAttribute("aria-pressed", u === "F");
  if (state.data) render(); // convert locally, no new request
}

$("detectBtn").addEventListener("click", detect);
$("manualForm").addEventListener("submit", manual);
$("refreshBtn").addEventListener("click", loadWeather); // refreshes weather only; does not re-ask for GPS
$("changeBtn").addEventListener("click", () => { status(""); show("welcome"); });
$("unitC").addEventListener("click", () => setUnit("C"));
$("unitF").addEventListener("click", () => setUnit("F"));
