// Looks up the device's current position. Rejects when the position is
// unavailable or the user doesn't allow the lookup.
export function geolocate(
  options: PositionOptions = {}
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      position => {
        resolve(position);
      },
      error => {
        reject(new Error(error.message));
      },
      options
    );
  });
}
