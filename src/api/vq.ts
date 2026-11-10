import { JsonOK, JsonResponse } from '@/fetch';

import { APP_VERSION, ApiClient, RequestError } from './client';
import { InvalidId, Park, ResortId } from './resort';

const STATUS_UNAUTHORIZED = 401;
const STATUS_SERVER_ERROR = 500;

type QueueFields = {
  name: string;
  isAcceptingJoins: boolean;
  isAcceptingPartyCreation: boolean;
  nextScheduledOpenTime: string | null;
  nextScheduledPartyCreationOpenTime: string | null;
  maxPartySize: number;
  categoryContentId?: 'attraction' | 'character' | 'special-event';
};

export type Queue = QueueFields & {
  id: string;
  park?: Park;
};

export type ApiQueue = QueueFields & {
  queueId: string;
  tabContentId?: string;
};

export type Guest = {
  id: string;
  name: string;
  primary: boolean;
  preselected: boolean;
  avatarImageUrl?: string;
};

type ApiGuest = {
  guestId: string;
  firstName?: string;
  lastName?: string;
  isPrimaryGuest?: boolean;
  isPreselected?: boolean;
  avatarImageUrl?: string;
};

export type Position = {
  queueId: string;
  guestIds: string[];
  boardingGroup: number;
  queuedAt: number;
};

type JoinQueueConflictType =
  'NO_PARK_PASS' | 'NOT_IN_PARK' | 'REDEEM_LIMIT_REACHED';

type JoinQueueConflict = {
  conflictType: JoinQueueConflictType;
  guestIds: string[];
};

export type JoinQueueConflicts = Record<string, JoinQueueConflictType>;

// The outcome of trying to join a queue. `boardingGroup` is null when the
// party didn't get in, either because the queue closed or because of the
// listed guest conflicts.
export type JoinQueueResult = {
  boardingGroup: number | null;
  conflicts: JoinQueueConflicts;
  closed: boolean;
};

type GetQueuesResponse = {
  queues?: ApiQueue[];
};

type GetLinkedGuestsResponse = {
  responseStatus: 'OK';
  guests: ApiGuest[];
};

type JoinQueueResponse =
  | {
      responseStatus: 'OK';
      queues: Queue[];
      guests: ApiGuest[];
      positions: Position[];
    }
  | {
      responseStatus: 'INVALID_GUEST' | 'CLOSED_QUEUE';
      conflicts: JoinQueueConflict[];
    };

type VQRequest =
  | {
      resource: 'getQueues';
    }
  | {
      resource: 'getLinkedGuests';
      data: {
        queueId: string;
        requestType: 'REVIEW' | 'CHANGE';
      };
    }
  | {
      resource: 'joinQueue';
      data: {
        queueId: string;
        guestIds: string[];
      };
      sensorData: true;
    };

// Orders the primary guest first, then preselected guests, then by name.
export function sortGuests(guests: Guest[]): Guest[] {
  return [...guests].sort((a, b) => {
    return (
      Number(b.primary) - Number(a.primary) ||
      Number(b.preselected) - Number(a.preselected) ||
      a.name.localeCompare(b.name)
    );
  });
}

function toGuest(apiGuest: ApiGuest): Guest {
  const firstName = apiGuest.firstName ?? '';
  const lastName = apiGuest.lastName ?? '';

  return {
    id: apiGuest.guestId,
    name: `${firstName} ${lastName}`.trim(),
    primary: !!apiGuest.isPrimaryGuest,
    preselected: !!apiGuest.isPreselected,
    avatarImageUrl: apiGuest.avatarImageUrl,
  };
}

function conflictsByGuestId(
  conflicts: JoinQueueConflict[],
  requestedGuestIds: string[]
): JoinQueueConflicts {
  const conflictsByGuestId: JoinQueueConflicts = {};

  for (const conflict of conflicts) {
    for (const guestId of conflict.guestIds) {
      if (requestedGuestIds.includes(guestId)) {
        conflictsByGuestId[guestId] = conflict.conflictType;
      }
    }
  }

  return conflictsByGuestId;
}

// The virtual queue service answers some requests, such as joining a closed
// queue, with a client error status and a regular response body.
function isAnswer(response: JsonResponse): boolean {
  const { status } = response;

  return (
    status > 0 && status < STATUS_SERVER_ERROR && status !== STATUS_UNAUTHORIZED
  );
}

export class VQClient extends ApiClient {
  protected static origins: Record<ResortId, string> = {
    WDW: 'https://vqguest-svc-wdw.wdprapps.disney.com',
    DLR: 'https://vqguest-svc.wdprapps.disney.com',
  };

  async getQueues(): Promise<Queue[]> {
    const response = await this.post<GetQueuesResponse>({
      resource: 'getQueues',
    });
    const { queues } = response.data ?? {};

    if (!Array.isArray(queues)) {
      throw new RequestError(response);
    }

    return queues.flatMap(apiQueue => this.queue(apiQueue) ?? []);
  }

  async getQueue(queue: Pick<Queue, 'id'>): Promise<Queue> {
    const queues = await this.getQueues();
    const currentQueue = queues.find(({ id }) => id === queue.id);

    if (!currentQueue) {
      throw new Error('Queue not found');
    }

    return currentQueue;
  }

  async getLinkedGuests(queue: Pick<Queue, 'id'>): Promise<Guest[]> {
    const { data } = await this.post<GetLinkedGuestsResponse>({
      resource: 'getLinkedGuests',
      data: {
        queueId: queue.id,
        requestType: 'REVIEW',
      },
    });

    return sortGuests(data.guests.map(toGuest));
  }

  async joinQueue(
    queue: Pick<Queue, 'id'>,
    guests: Pick<Guest, 'id'>[]
  ): Promise<JoinQueueResult> {
    const guestIds = guests.map(guest => guest.id);
    const response = await this.post<JoinQueueResponse>({
      resource: 'joinQueue',
      data: {
        queueId: queue.id,
        guestIds,
      },
      sensorData: true,
    });
    const { data } = response;

    switch (data.responseStatus) {
      case 'OK': {
        const position = data.positions.find(({ queueId, guestIds: ids }) => {
          return queueId === queue.id && ids.some(id => guestIds.includes(id));
        });

        if (!position) {
          throw new RequestError(response);
        }

        return {
          boardingGroup: position.boardingGroup,
          conflicts: {},
          closed: false,
        };
      }
      case 'INVALID_GUEST':
      case 'CLOSED_QUEUE':
        return {
          boardingGroup: null,
          conflicts: conflictsByGuestId(data.conflicts, guestIds),
          closed: data.responseStatus === 'CLOSED_QUEUE',
        };
      default:
        throw new RequestError(response);
    }
  }

  // Returns undefined for a queue that isn't listed in Disney's own app.
  protected queue(apiQueue: ApiQueue): Queue | undefined {
    const { queueId, tabContentId, ...fields } = apiQueue;

    if (!tabContentId || !fields.categoryContentId) {
      return undefined;
    }

    const queue: Queue = {
      ...fields,
      id: queueId,
    };
    const [parkId = ''] = tabContentId.split(';');

    try {
      queue.park = this.resort.park(parkId);
    } catch (error) {
      if (!(error instanceof InvalidId)) {
        throw error;
      }
    }

    return queue;
  }

  protected async post<T>(request: VQRequest): Promise<JsonOK<T>> {
    const { resource, ...apiRequest } = request;

    try {
      return await this.request<T>({
        ...apiRequest,
        path: `/application/v1/guest/${resource}`,
        headers: {
          'x-vq-guest-app-version': APP_VERSION,
        },
      });
    } catch (error) {
      if (error instanceof RequestError && isAnswer(error.response)) {
        return {
          ok: true,
          status: error.response.status,
          data: error.response.data as T,
        };
      }

      throw error;
    }
  }
}
