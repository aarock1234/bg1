import { useCallback, useState } from 'react';

import { geolocate } from '@/geolocate';

const GEOLOCATE_OPTIONS: PositionOptions = {
  maximumAge: 15_000,
  timeout: 2000,
};

// A latitude and longitude pair.
export type Coords = readonly [number, number];

function isSamePlace(
  coords: Coords | undefined,
  latitude: number,
  longitude: number
): boolean {
  if (!coords) {
    return false;
  }

  return coords[0] === latitude && coords[1] === longitude;
}

// Provides the device's last known coordinates and a function that looks them
// up again. The coordinates are undefined when the device can't be located.
export default function useCoords(): [Coords | undefined, () => Promise<void>] {
  const [coords, setCoords] = useState<Coords>();

  const updateCoords = useCallback(async () => {
    try {
      const position = await geolocate(GEOLOCATE_OPTIONS);
      const { latitude, longitude } = position.coords;

      // Keeping the same array when the device hasn't moved avoids needless
      // work in components that depend on the coordinates.
      setCoords(previousCoords =>
        isSamePlace(previousCoords, latitude, longitude)
          ? previousCoords
          : [latitude, longitude]
      );
    } catch {
      setCoords(undefined);
    }
  }, []);

  return [coords, updateCoords];
}
