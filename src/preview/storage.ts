import { authStore } from '@/api/auth';
import { HOME_TAB_KEY } from '@/components/ll/screens/Home';
import { STARRED_KEY } from '@/components/ll/screens/Home/MultiPassList';
import kvdb from '@/kvdb';
import { PARK_KEY } from '@/providers/ParkProvider';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type StoredState = {
  tab: string | undefined;
  parkId: string;
  starredIds: string[];
};

// Starts every preview from the same saved state: a logged-in guest, the
// requested tab and park, and a favorite attraction.
export function resetStoredState({ tab, parkId, starredIds }: StoredState) {
  kvdb.clear();

  authStore.setData({
    swid: '{PREVIEW-GUEST}',
    accessToken: 'preview-access-token',
    expires: Date.now() + MS_PER_DAY,
  });

  kvdb.setDaily(PARK_KEY, parkId);
  kvdb.set(STARRED_KEY, starredIds);

  if (tab) {
    kvdb.set(HOME_TAB_KEY, tab);
  }
}
