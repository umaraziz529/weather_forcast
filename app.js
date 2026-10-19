const $ = (id) => document.getElementById(id);
const cfg = window.APP_CONFIG;
const weatherCodes = {
  0:["Clear sky","☀"],1:["Mainly clear","🌤"],2:["Partly cloudy","⛅"],3:["Overcast","☁"],
  45:["Fog","🌫"],48:["Depositing rime fog","🌫"],51:["Light drizzle","🌦"],53:["Drizzle","🌦"],55:["Heavy drizzle","🌧"],
  61:["Light rain","🌦"],63:["Rain","🌧"],65:["Heavy rain","🌧"],71:["Light snow","🌨"],73:["Snow","🌨"],75:["Heavy snow","❄"],
  80:["Rain showers","🌦"],81:["Rain showers","🌧"],82:["Heavy showers","⛈"],95:["Thunderstorm","⛈"],96:["Thunderstorm with hail","⛈"],99:["Thunderstorm with hail","⛈"]
};
let currentCoords = null;
$("year").textContent = new Date().getFullYear();
function say(message, isError=false){$("status").textContent=message;$("status").style.color=isError?"#ffb4c0":"#a4b1ca";}
function describe(code){return weatherCodes[code] || ["Variable conditions","☁"];}
function fmtDay(date){return new Date(date+"T12:00:00").toLocaleDateString(undefined,{weekday:"long"});}
function fmtHour(date){return new Date(date).toLocaleTimeString(undefined,{hour:"numeric"});}
async function getWeather(lat, lon, place, coordsText=null){
  say("Loading forecast…");
  const url = new URL(cfg.WEATHER_API_BASE);
  url.search = new URLSearchParams({
    latitude:lat,longitude:lon,
    current:"temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m",
    hourly:"temperature_2m,weather_code",
    daily:"weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset",
    timezone:"auto",forecast_days:"7"
  }).toString();
  try{
    const res=await fetch(url); if(!res.ok) throw new Error("Weather service returned an error.");
    const data=await res.json(); const c=data.current; const d=describe(c.weather_code);
    $("placeName").textContent=place || `${Number(lat).toFixed(3)}, ${Number(lon).toFixed(3)}`;
    $("localDate").textContent=new Date(c.time).toLocaleString(undefined,{weekday:"long",month:"long",day:"numeric",hour:"numeric",minute:"2-digit"});
    $("weatherIcon").textContent=d[1]; $("temperature").textContent=Math.round(c.temperature_2m)+"°";
    $("condition").textContent=d[0]; $("feelsLike").textContent=Math.round(c.apparent_temperature)+"°";
    $("humidity").textContent=c.relative_humidity_2m+"%"; $("wind").textContent=Math.round(c.wind_speed_10m)+" km/h";
    $("coordinates").textContent=coordsText || `Forecast coordinates: ${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)} · Weather provided by Open-Meteo`;
    $("hourly").innerHTML=data.hourly.time.slice(0,24).filter((_,i)=>i%3===0).map((t)=>{const i=data.hourly.time.indexOf(t);const w=describe(data.hourly.weather_code[i]);return `<div class="hour-card"><div class="hour-time">${fmtHour(t)}</div><div class="hour-symbol">${w[1]}</div><div class="hour-temp">${Math.round(data.hourly.temperature_2m[i])}°</div><div class="hour-time">${w[0]}</div></div>`}).join("");
    $("daily").innerHTML=data.daily.time.map((t,i)=>{const w=describe(data.daily.weather_code[i]);return `<div class="daily-row"><span class="daily-day">${i===0?"Today":fmtDay(t)}</span><span>${w[1]}</span><span class="daily-desc">${w[0]}</span><span class="daily-temps">${Math.round(data.daily.temperature_2m_max[i])}° / ${Math.round(data.daily.temperature_2m_min[i])}°</span></div>`}).join("");
    say("Forecast updated successfully.");
  }catch(e){say(e.message || "Could not load weather. Try again.",true);}
}
async function searchCity(){
  const city=$("cityInput").value.trim(); if(!city){say("Enter a city name first.",true);return;}
  say("Searching for city…");
  try{
    const url=new URL(cfg.GEOCODING_API_BASE);url.search=new URLSearchParams({name:city,count:1,language:"en",format:"json"}).toString();
    const r=await fetch(url);if(!r.ok)throw new Error("City search failed.");const j=await r.json();
    if(!j.results?.length)throw new Error("City not found. Try another spelling.");
    const p=j.results[0];currentCoords={latitude:p.latitude,longitude:p.longitude,accuracy:null,source:"city"};
    await getWeather(p.latitude,p.longitude,[p.name,p.admin1,p.country].filter(Boolean).join(", "));
  }catch(e){say(e.message,true);}
}
$("citySearch").addEventListener("click",searchCity);
$("cityInput").addEventListener("keydown",e=>{if(e.key==="Enter")searchCity();});
$("locationBtn").addEventListener("click",()=>{$("consentDialog").showModal();});
$("continueLocation").addEventListener("click",e=>{
  e.preventDefault();
  const store=$("storeConsent").checked;
  $("consentDialog").close();
  if(!navigator.geolocation){say("This browser does not support location. Search a city instead.",true);return;}
  say("Waiting for your browser's location permission…");
  navigator.geolocation.getCurrentPosition(async pos=>{
    const c={latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy:pos.coords.accuracy,source:"device"};
    currentCoords=c;
    let place=`Your location (${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)})`;
    await getWeather(c.latitude,c.longitude,place,`Latitude ${c.latitude.toFixed(6)} · Longitude ${c.longitude.toFixed(6)} · Accuracy ±${Math.round(c.accuracy)} m`);
    if(store){
      const visitorId=getVisitorId();
      try{
        const response=await fetch(`${cfg.LOCATION_API_URL.replace(/\/$/,"")}/api/location`,{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({latitude:c.latitude,longitude:c.longitude,accuracy_m:c.accuracy,consent:true,visitor_id:visitorId,consented_at:new Date().toISOString(),purpose:"Local weather forecast and consented location record"})
        });
        if(!response.ok)throw new Error("The database did not confirm the save.");
        say("Weather loaded. You consented to saving this location, and the server confirmed the record.");
      }catch(err){say("Weather loaded, but the location record could not be saved. Check backend setup.",true);console.error(err);}
    }else{say("Weather loaded. Your coordinates were not saved to the database.");}
  },err=>say(err.code===1?"Location permission was denied. You can search for a city instead.":"Could not get your location. Check device location settings or search for a city.",true),{enableHighAccuracy:true,timeout:15000,maximumAge:0});
});
function getVisitorId(){
  // Random, non-identifying session ID. It is not a device fingerprint.
  const key="atmos_session_id";
  let id=sessionStorage.getItem(key);
  if(!id){id=crypto.randomUUID();sessionStorage.setItem(key,id);}
  return id;
}
