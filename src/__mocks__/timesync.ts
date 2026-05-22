export const syncTime = jest.fn(async () => undefined);
export const now = () => Date.now();
export class SyncFailed extends Error {}
