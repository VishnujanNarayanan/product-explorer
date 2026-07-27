import { Logger } from '@nestjs/common';
import { ScraperService } from './scraper.service';

/**
 * `onModuleInit` fills the navigation tree on first boot. It used to `await` that scrape
 * unguarded, so any failure to launch a browser aborted module initialisation and the entire
 * API refused to start — including every endpoint that never scrapes. These tests pin down
 * that a scrape failure is survivable and that the behaviour can be switched off.
 */
describe('ScraperService startup scrape', () => {
  const originalFlag = process.env.SCRAPE_ON_STARTUP;

  /** Enough of the service to drive onModuleInit without the Nest container. */
  function makeService(overrides: {
    count?: () => Promise<number>;
    scrape?: () => Promise<unknown>;
  }) {
    const service = Object.create(ScraperService.prototype) as ScraperService;

    Object.defineProperty(service, 'logger', {
      value: { log: jest.fn(), error: jest.fn(), warn: jest.fn() } as unknown as Logger,
      writable: true,
    });
    Object.defineProperty(service, 'navigationRepo', {
      value: { count: overrides.count ?? jest.fn().mockResolvedValue(0) },
      writable: true,
    });
    service.scrapeAndSaveNavigation =
      (overrides.scrape as ScraperService['scrapeAndSaveNavigation']) ??
      jest.fn().mockResolvedValue([]);

    return service;
  }

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.SCRAPE_ON_STARTUP;
    else process.env.SCRAPE_ON_STARTUP = originalFlag;
  });

  it('scrapes when the navigation table is empty', async () => {
    delete process.env.SCRAPE_ON_STARTUP;
    const scrape = jest.fn().mockResolvedValue([]);
    const service = makeService({ count: jest.fn().mockResolvedValue(0), scrape });

    await service.onModuleInit();

    expect(scrape).toHaveBeenCalled();
  });

  it('does not scrape when navigation is already populated', async () => {
    delete process.env.SCRAPE_ON_STARTUP;
    const scrape = jest.fn();
    const service = makeService({ count: jest.fn().mockResolvedValue(6), scrape });

    await service.onModuleInit();

    expect(scrape).not.toHaveBeenCalled();
  });

  // The regression that broke CI: no Chromium on the runner meant the app would not boot.
  it('survives a scrape that cannot launch a browser', async () => {
    delete process.env.SCRAPE_ON_STARTUP;
    const scrape = jest.fn().mockRejectedValue(new Error('Failed to launch browser'));
    const service = makeService({ count: jest.fn().mockResolvedValue(0), scrape });

    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });

  it('survives the database being unreachable at boot', async () => {
    delete process.env.SCRAPE_ON_STARTUP;
    const service = makeService({
      count: jest.fn().mockRejectedValue(new Error('connection refused')),
    });

    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });

  it('skips entirely when SCRAPE_ON_STARTUP is false', async () => {
    process.env.SCRAPE_ON_STARTUP = 'false';
    const count = jest.fn();
    const scrape = jest.fn();
    const service = makeService({ count, scrape });

    await service.onModuleInit();

    expect(count).not.toHaveBeenCalled();
    expect(scrape).not.toHaveBeenCalled();
  });
});
