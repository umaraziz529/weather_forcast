async function saveLocation(position) {
  const { latitude, longitude, accuracy } = position.coords;

  const response = await fetch(
    "https://weather-location-api.YOUR-SUBDOMAIN.workers.dev/api/location",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude, longitude, accuracy })
    }
  );

  if (!response.ok) {
    throw new Error("Could not save location");
  }

  return response.json();
}
