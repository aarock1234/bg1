import {
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  time,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

const timestampOptions = {
  withTimezone: true,
};

// One search for a Lightning Lane that the server runs for a guest. The jsonb
// columns are typed where they are read: server/jobs/job.ts validates every
// row.
export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // SHA-256 hashes of the token that authorizes requests about this job and
    // of the Disney account it books for.
    tokenHash: text('token_hash').notNull(),
    accountHash: text('account_hash').notNull(),

    status: text('status').notNull(),
    resortId: text('resort_id').notNull(),
    experienceId: text('experience_id').notNull(),
    experienceName: text('experience_name').notNull(),
    guests: jsonb('guests').notNull(),

    // The park date to book for and the return times the guest accepts, on
    // the resort's clock.
    bookingDate: date('booking_date').notNull(),
    earliest: time('earliest').notNull(),
    latest: time('latest').notNull(),

    // The guest's Disney login, encrypted. It is removed when the job ends.
    encryptedLogin: text('encrypted_login'),
    loginExpiresAt: timestamp('login_expires_at', timestampOptions).notNull(),

    attemptCount: integer('attempt_count').notNull().default(0),
    lastAttempt: jsonb('last_attempt'),
    result: jsonb('result'),
    failureCode: text('failure_code'),
    failureMessage: text('failure_message'),
    pushSubscription: jsonb('push_subscription'),

    // Which server instance is running the job, and until when its claim
    // holds unless it renews it.
    leaseOwner: text('lease_owner'),
    leaseExpiresAt: timestamp('lease_expires_at', timestampOptions),

    createdAt: timestamp('created_at', timestampOptions).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', timestampOptions).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', timestampOptions),
  },
  table => [
    index('jobs_status_lease_expires_at_index').on(
      table.status,
      table.leaseExpiresAt
    ),
    index('jobs_account_hash_status_index').on(table.accountHash, table.status),
  ]
);
