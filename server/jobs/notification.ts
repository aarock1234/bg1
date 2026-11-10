import type { ResortId } from '@/api/resort';
import { HOSTS } from '@/config';
import { formatTime } from '@/datetime';

import type { PushMessage } from '../push/notify';
import { type Job, type JobOutcome, JobStatus } from './job';

// The page on BG1's own site that runs each resort's Lightning Lane app.
const APP_PATHS: Record<ResortId, string> = {
  WDW: '/wdw',
  DLR: '/dlr',
};

// The return time's hour and minute, from a YYYY-MM-DDTHH:MM:SS time.
function returnTime(start: string): string {
  const [, time = ''] = start.split('T');
  const [hour, minute] = time.split(':');

  return formatTime(`${hour}:${minute}`);
}

// Words the notification that tells the guest how their search ended.
export function outcomeNotification(
  job: Pick<Job, 'resortId' | 'experienceName'>,
  outcome: JobOutcome
): PushMessage {
  const url = `${HOSTS.HOME}${APP_PATHS[job.resortId]}`;

  if (outcome.status === JobStatus.BOOKED) {
    const { experienceName, start } = outcome.result;

    return {
      title: 'Lightning Lane booked',
      body: `${experienceName} at ${returnTime(start)}`,
      url,
    };
  }

  const title =
    outcome.status === JobStatus.EXPIRED
      ? 'Lightning Lane search ended'
      : 'Lightning Lane search stopped';

  return {
    title,
    body: `${job.experienceName}: ${outcome.failure.message}`,
    url,
  };
}
