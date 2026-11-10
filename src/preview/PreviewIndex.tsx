import Screen from '@/components/Screen';
import ChevronRightIcon from '@/icons/ChevronRightIcon';

type PreviewLink = {
  label: string;

  // The query string that shows it.
  query: string;
};

type PreviewSection = {
  title: string;
  links: PreviewLink[];
};

const SECTIONS: PreviewSection[] = [
  {
    title: 'Lightning Lane',
    links: [
      {
        label: 'Home: Lightning Lane list',
        query: 'app=ll',
      },
      {
        label: 'Home: Times Guide',
        query: 'app=ll&tab=Times',
      },
      {
        label: 'Home: Plans',
        query: 'app=ll&tab=Plans',
      },
      {
        label: 'Book a Lightning Lane',
        query: 'app=ll&screen=book',
      },
      {
        label: 'Book: no reservations available',
        query: 'app=ll&screen=book&scenario=sold-out',
      },
      {
        label: 'Book: no eligible guests',
        query: 'app=ll&screen=book&scenario=ineligible',
      },
      {
        label: 'Book: no guests found',
        query: 'app=ll&screen=book&scenario=empty',
      },
      {
        label: 'Modify party',
        query: 'app=ll&screen=modify-party',
      },
      {
        label: 'Select return time',
        query: 'app=ll&screen=return-time',
      },
      {
        label: 'Booking details: Lightning Lane',
        query: 'app=ll&screen=booking',
      },
      {
        label: 'Booking details: just booked',
        query: 'app=ll&screen=new-booking',
      },
      {
        label: 'Booking details: DAS',
        query: 'app=ll&screen=booking&id=DAS',
      },
      {
        label: 'Booking details: boarding group',
        query: 'app=ll&screen=booking&id=BG',
      },
      {
        label: 'Booking details: dining',
        query: 'app=ll&screen=booking&id=RES',
      },
      {
        label: 'Change booking time',
        query: 'app=ll&screen=change-time',
      },
      {
        label: 'Book new return time',
        query: 'app=ll&screen=new-return-time',
      },
      {
        label: 'Cancel guests',
        query: 'app=ll&screen=cancel',
      },
      {
        label: 'Your Day',
        query: 'app=ll&screen=your-day',
      },
      {
        label: 'Party selection',
        query: 'app=ll&screen=party',
      },
      {
        label: 'DAS parties',
        query: 'app=ll&screen=das',
      },
      {
        label: 'DAS selection',
        query: 'app=ll&screen=das-selection',
      },
      {
        label: 'DAS experiences',
        query: 'app=ll&screen=das-experiences',
      },
      {
        label: 'Disneyland (no advance booking)',
        query: 'app=ll&resort=DLR',
      },
    ],
  },
  {
    title: 'Virtual queue',
    links: [
      {
        label: 'Queues',
        query: 'app=vq',
      },
      {
        label: 'Choose party',
        query: 'app=vq&screen=party',
      },
      {
        label: 'Join queue: open now',
        query: 'app=vq&screen=join',
      },
      {
        label: 'Join queue: opens later',
        query: 'app=vq&screen=join&id=upcoming-queue',
      },
      {
        label: 'Boarding group obtained',
        query: 'app=vq&screen=result',
      },
      {
        label: 'No boarding group',
        query: 'app=vq&screen=no-result',
      },
    ],
  },
  {
    title: 'States',
    links: [
      {
        label: 'Nothing to show',
        query: 'app=ll&scenario=empty',
      },
      {
        label: 'Requests fail',
        query: 'app=ll&scenario=error',
      },
      {
        label: 'Loading forever',
        query: 'app=ll&scenario=loading',
      },
      {
        label: 'No virtual queues',
        query: 'app=vq&scenario=empty',
      },
    ],
  },
  {
    title: 'Before the app',
    links: [
      {
        label: 'Disclaimer',
        query: 'app=disclaimer',
      },
      {
        label: 'Login',
        query: 'app=login',
      },
      {
        label: 'News',
        query: 'app=news',
      },
    ],
  },
  {
    title: 'Design system',
    links: [
      {
        label: 'Building blocks',
        query: 'app=kit',
      },
    ],
  },
];

// Lists everything the preview can show.
export default function PreviewIndex() {
  return (
    <Screen title="BG1 preview">
      {SECTIONS.map(section => (
        <section key={section.title}>
          <h2 className="section-title">{section.title}</h2>
          <div className="list">
            {section.links.map(link => (
              <a className="row" href={`?${link.query}`} key={link.query}>
                <span className="row-title">{link.label}</span>
                <ChevronRightIcon className="text-muted" />
              </a>
            ))}
          </div>
        </section>
      ))}
    </Screen>
  );
}
