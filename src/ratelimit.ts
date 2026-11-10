const MS_PER_SECOND = 1000;

export class RateLimitExceeded extends Error {
  readonly name = 'RateLimitExceeded';
}

// Guards against runaway request loops. Once more requests than allowed are
// made within one second, every later request is refused until the page is
// reloaded.
export class RateLimit {
  protected currentSecond = 0;
  protected requestCount = 0;
  protected isExceeded = false;

  constructor(protected requestsPerSecond = 0) {}

  enforce(): void {
    const second = Math.floor(performance.now() / MS_PER_SECOND);

    if (second !== this.currentSecond) {
      this.currentSecond = second;
      this.requestCount = 0;
    }

    this.requestCount += 1;

    if (this.requestCount > this.requestsPerSecond) {
      this.isExceeded = true;
    }

    if (this.isExceeded) {
      throw new RateLimitExceeded();
    }
  }
}
