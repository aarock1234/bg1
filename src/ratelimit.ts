export class RateLimitExceeded extends Error {
  readonly name = 'RateLimitExceeded';
}

export class RateLimit {
  protected lastRequestTime = 0;
  protected requestCount = 0;
  protected limitExceededTime = 0;

  constructor(protected requestsPerSecond = 0) {}

  enforce() {
    const now = Math.floor(performance.now() / 1000);
    if (this.lastRequestTime !== now) {
      this.lastRequestTime = now;
      this.requestCount = 0;
    }
    if (++this.requestCount > this.requestsPerSecond) {
      this.limitExceededTime = now;
    }
    if (this.limitExceededTime > 0) throw new RateLimitExceeded();
  }
}
