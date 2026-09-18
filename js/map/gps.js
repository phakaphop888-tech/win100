export function watchGps({ onChange, onError, enableHighAccuracy = true }) {
  if (!navigator.geolocation) {
    onError?.(new Error("gps_denied"));
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (pos) => {
      onChange({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
        at: Date.now(),
      });
    },
    () => onError?.(new Error("gps_denied")),
    { enableHighAccuracy, maximumAge: 4000, timeout: 12000 }
  );
  return () => navigator.geolocation.clearWatch(id);
}

export function getCurrentGps() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("gps_denied"));
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => reject(new Error("gps_denied")),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}
