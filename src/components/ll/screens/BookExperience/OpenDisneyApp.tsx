import type { ResortId } from '@/api/resort';

import { disneyAppLink } from './disney-app';

type OpenDisneyAppProps = {
  resortId: ResortId;

  // Whether this is the thing to do next on the screen, drawn as its one
  // primary button.
  isPrimary?: boolean;
};

// A button that opens the resort's Disney app, with a quiet link to the store
// for a phone that doesn't have it. Opening an app's own link leaves BG1 open
// behind it, so the link is followed in place.
export default function OpenDisneyApp(props: OpenDisneyAppProps) {
  const { resortId, isPrimary = false } = props;
  const app = disneyAppLink(resortId);
  const variant = isPrimary ? 'btn-primary' : 'btn-secondary';

  return (
    <div className="mt-3">
      <a href={app.openUrl} className={`btn ${variant} btn-full`}>
        Open the {app.name}
      </a>
      <p className="note mt-2 mb-0 text-center">
        Don't have it?{' '}
        <a href={app.storeUrl} target="_blank" rel="noreferrer">
          Get the {app.name}
        </a>
      </p>
    </div>
  );
}
