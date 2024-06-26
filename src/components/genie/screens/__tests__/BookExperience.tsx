import {
  booking,
  donald,
  genie,
  hm,
  mickey,
  minnie,
  offer,
  pluto,
  wdw,
} from '@/__fixtures__/genie';
import { RequestError } from '@/api/client';
import { Nav } from '@/contexts/Nav';
import { RebookingProvider } from '@/contexts/Rebooking';
import { displayTime } from '@/datetime';
import { ping } from '@/ping';
import { TODAY, click, loading, screen, see, setTime } from '@/testing';

import BookExperience from '../BookExperience';

jest.mock('@/ping');
jest.mock('@/timesync');
setTime('09:00');
const errorMock = jest.spyOn(console, 'error');

const mockClickResponse = async (
  clientMethod: jest.MockedFunction<any>,
  buttonText: string,
  status: number
) => {
  const error =
    status >= 0
      ? new RequestError({ ok: status === 200, status, data: {} })
      : new Error();
  errorMock.mockImplementationOnce(() => null);
  clientMethod.mockRejectedValueOnce(error);
  click(buttonText);
  await loading();
};

const mockBook = (status: number) =>
  mockClickResponse(genie.book, 'Book Lightning Lane', status);

const mockMakeRes = (status: number) =>
  mockClickResponse(genie.experiences, 'Check Availability', status);

async function clickModify() {
  click('Modify');
  await see.screen('Modify Party');
}

async function clickConfirm() {
  click('Confirm Party');
  await see.screen('Lightning Lane');
}

const hmPrebooking = {
  ...hm,
  flex: { available: false, enrollmentStartTime: '07:00:00' },
};

async function renderComponent({
  available = true,
  modify = false,
}: {
  available?: boolean;
  modify?: boolean;
} = {}) {
  const rebooking = {
    current: modify ? booking : undefined,
    begin: jest.fn(),
    end: jest.fn(),
  };
  wdw.render(
    <RebookingProvider value={rebooking}>
      <Nav>
        <BookExperience experience={available ? hm : hmPrebooking} />
      </Nav>
    </RebookingProvider>
  );
  await loading();
}

describe('BookExperience', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('performs successful booking', async () => {
    await renderComponent({ available: false });
    click('Check Availability');
    await loading();
    see(displayTime(offer.start.time));
    see(displayTime(offer.end.time));
    await clickModify();
    click(mickey.name, 'checkbox');
    await clickConfirm();
    see.no(mickey.name);
    see(minnie.name);
    click('Book Lightning Lane');
    await loading();
    see('Your Lightning Lane');
    see(hm.name);
    expect(ping).toHaveBeenCalledTimes(1);
    expect(genie.guests).toHaveBeenCalledTimes(1);
    expect(genie.book).toHaveBeenCalledTimes(1);
    expect(genie.cancelBooking).toHaveBeenLastCalledWith(
      booking.guests.filter(g => g.id === mickey.id)
    );
  });

  it('removes offer-ineligible guests from selected party', async () => {
    genie.offer.mockResolvedValueOnce({
      ...offer,
      guests: {
        eligible: [minnie],
        ineligible: [mickey, pluto].map(g => ({
          ...g,
          ineligibleReason: 'TOO_EARLY_FOR_PARK_HOPPING',
        })),
      },
    });
    await renderComponent();
    see(minnie.name);
    see.no(mickey.name);
    await clickModify();
    screen.getByRole('checkbox', { checked: true });
    expect(see(mickey.name)).toHaveTextContent('TOO EARLY FOR PARK HOPPING');
    expect(see(pluto.name)).toHaveTextContent('TOO EARLY FOR PARK HOPPING');
  });

  const newOffer = {
    id: 'new_offer',
    start: { date: TODAY, time: '10:05:00' },
    end: { date: TODAY, time: '11:05:00' },
    active: true,
    changed: true,
    guests: {
      eligible: [mickey, minnie, pluto],
      ineligible: [],
    },
    experience: hm,
  };

  it('refreshes offer when Refresh button clicked', async () => {
    await renderComponent();
    see(displayTime(offer.start.time));
    genie.offer.mockResolvedValueOnce(newOffer);
    click('Refresh Offer');
    await loading();
    see(displayTime(newOffer.start.time));
    see.no('Return time has been changed');
  });

  it('refreshes offer when someone added to party', async () => {
    await renderComponent();
    see(displayTime(offer.start.time));
    genie.offer.mockResolvedValueOnce(newOffer);
    await clickModify();
    click(mickey.name, 'checkbox');
    await clickConfirm();
    see.no(mickey.name);
    await clickModify();
    click(mickey.name, 'checkbox');
    await clickConfirm();
    await loading();
    see(mickey.name);
    see(displayTime(newOffer.start.time));
  });

  it("doesn't request offer when party modified before enrollment opens", async () => {
    genie.offer.mockClear();
    await renderComponent({ available: false });
    await clickModify();
    click(mickey.name);
    await clickConfirm();
    expect(genie.offer).not.toHaveBeenCalled();
  });

  it('shows prebooking screen even if no eligible guests', async () => {
    genie.guests.mockResolvedValueOnce({
      eligible: [],
      ineligible: [
        { ...mickey, ineligibleReason: 'INVALID_PARK_ADMISSION' },
        { ...minnie, ineligibleReason: 'INVALID_PARK_ADMISSION' },
      ],
    });
    await renderComponent({ available: false });
    see('07:00:00');
    see('Ineligible Guests');
    see(mickey.name);
    see(minnie.name);
    expect(screen.getAllByText('INVALID PARK ADMISSION')).toHaveLength(2);
    see('Check Availability', 'button');
  });

  it('shows "No Guests Found" when no guests loaded', async () => {
    genie.guests.mockResolvedValueOnce({ eligible: [], ineligible: [] });
    await renderComponent();
    see('No Guests Found');

    click('Refresh Party');
    await loading();
    see(mickey.name);
  });

  it('shows "No Eligible Guests" when no eligible guests loaded', async () => {
    genie.guests.mockResolvedValueOnce({
      eligible: [],
      ineligible: [donald],
    });
    await renderComponent();
    see('No Eligible Guests');
    expect(see(donald.name)).toHaveTextContent(
      donald.ineligibleReason.replace(/_/g, ' ')
    );
  });

  it('shows "No Reservations Available" when no/invalid offer', async () => {
    genie.offer.mockRejectedValueOnce(
      new RequestError({ ok: false, status: 410, data: {} })
    );
    await renderComponent();
    see('No Reservations Available');

    genie.offer.mockResolvedValueOnce({ ...offer, active: false });
    click('Refresh Offer');
    await loading();
    see('No Reservations Available');
  });

  it('flashes error message when booking fails', async () => {
    await renderComponent();
    await mockBook(410);
    see('Offer expired');
    await mockBook(0);
    see('Network request failed');
    await mockBook(-1);
    see('Unknown error occurred');
  });

  it('flashes error message when enrollment not open or enrollment check fails', async () => {
    genie.experiences.mockResolvedValueOnce([
      { ...hm, flex: { available: false } },
    ]);
    await renderComponent({ available: false });
    click('Check Availability');
    await loading();
    see('Reservations not open yet');
    await mockMakeRes(0);
    see('Network request failed');
    await mockMakeRes(-1);
    see('Unknown error occurred');
  });

  it('limits offers to maxPartySize', async () => {
    const { maxPartySize } = genie;
    (genie as any).maxPartySize = 2;

    await renderComponent();
    expect(genie.offer).toHaveBeenLastCalledWith(
      hm,
      [mickey, minnie],
      undefined
    );
    see('Party size restricted');

    await clickModify();
    click(pluto.name);
    see('Maximum party size: 2');

    (genie as any).maxPartySize = maxPartySize;
  });

  it('can modify an existing reservation', async () => {
    await renderComponent({ modify: true });
    expect(genie.guests).not.toHaveBeenCalled();
  });
});
