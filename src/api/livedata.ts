import { serviceUrl } from '@/config';
import { DateTime, ParkTime } from '@/datetime';
import { fetchJson } from '@/fetch';

import { Experience } from './ll';
import { InvalidId, Park, Resort } from './resort';

// Show times for the day, by park ID and then experience ID.
type ShowTimesByParkId = Record<string, Record<string, string[]>>;

// Supplies show times that Disney's own experience list leaves out.
export class LiveDataClient {
  protected showTimesByParkId: ShowTimesByParkId | undefined;

  constructor(protected resort: Resort) {}

  // Returns the park's shows by experience ID, each with its remaining show
  // times for the day.
  async shows(park: Park): Promise<Record<string, Experience>> {
    this.showTimesByParkId ??= await this.fetchShowTimes();

    const showTimesByExperienceId = this.showTimesByParkId[park.id] ?? {};
    const now = DateTime.now().time;
    const shows: Record<string, Experience> = {};

    for (const [id, times] of Object.entries(showTimesByExperienceId)) {
      const upcomingTimes = times
        .map(ParkTime.from)
        .filter(time => time >= now);
      const show = this.show(id, park, upcomingTimes);

      if (show) {
        shows[id] = show;
      }
    }

    return shows;
  }

  // Returns undefined for a show that isn't in BG1's data.
  protected show(
    id: string,
    park: Park,
    upcomingTimes: ParkTime[]
  ): Experience | undefined {
    const available = upcomingTimes.length > 0;

    try {
      return {
        ...this.resort.experience(id),
        park,
        standby: {
          available,
          unavailableReason: available ? undefined : 'NO_MORE_SHOWS',
        },
        showTimes: upcomingTimes,
      };
    } catch (error) {
      if (error instanceof InvalidId) {
        return undefined;
      }

      throw error;
    }
  }

  protected async fetchShowTimes(): Promise<ShowTimesByParkId> {
    const resortId = this.resort.id.toLowerCase();
    const response = await fetchJson<ShowTimesByParkId>(
      serviceUrl(`livedata/${resortId}/showtimes.json`)
    );

    if (!response.ok) {
      throw new Error('Fetch failed');
    }

    return response.data;
  }
}
