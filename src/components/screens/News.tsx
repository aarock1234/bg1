import { siteUrl } from '@/config';

import Screen from '../Screen';

export default function News() {
  return (
    <Screen title="BG1 News">
      <iframe
        src={siteUrl('news.html')}
        sandbox=""
        className="absolute inset-0 w-full h-full"
      />
    </Screen>
  );
}
