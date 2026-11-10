import { z } from 'zod';

import { type Auth, ReauthNeeded } from '@/api/auth';

// The Disney login the app hands over, as it keeps it in the browser.
export const disneyLoginSchema = z.object({
  swid: z.string().min(1),
  accessToken: z.string().min(1),
  expires: z.number().int().positive(),
  refreshToken: z.string().min(1).optional(),
  refreshExpires: z.number().int().positive().optional(),
});

export type DisneyLogin = z.infer<typeof disneyLoginSchema>;

// Serves one guest's login to a Disney client. Once Disney rejects the login
// it stays unusable, because the server has no way to log in again.
export function loginAuth(login: DisneyLogin): Auth {
  let isRejected = false;

  return {
    getData() {
      if (isRejected || login.expires <= Date.now()) {
        throw new ReauthNeeded();
      }

      return {
        swid: login.swid,
        accessToken: login.accessToken,
      };
    },

    deleteData() {
      isRejected = true;
    },
  };
}
