// The land that groups experiences which don't belong to a real land.
const MISCELLANEOUS_LAND_NAME = 'Miscellaneous';

type Land = {
  name: string;
  park?: {
    name: string;
  };
};

type LandLineProps = {
  land: Land;
};

// Shows where an experience is, as "Land ⦁ Park". A location without a park is
// itself a park, so only its name is shown.
export default function LandLine({ land }: LandLineProps) {
  const park = land.park ?? land;
  const landName = land.park ? land.name : '';
  const hasLandName = landName !== '' && landName !== MISCELLANEOUS_LAND_NAME;

  return (
    <div>
      {hasLandName && (
        <>
          {landName}{' '}
          <span className="mx-0.5" aria-label="in">
            ⦁
          </span>{' '}
        </>
      )}
      {park.name}
    </div>
  );
}
