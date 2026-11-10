import { CSSProperties, useState } from 'react';

import Alert from '@/components/Alert';
import Button from '@/components/Button';
import FloatingButton from '@/components/FloatingButton';
import GuestList, { Guest } from '@/components/GuestList';
import Screen from '@/components/Screen';
import Select from '@/components/Select';
import Spinner from '@/components/Spinner';
import TimeBoard from '@/components/TimeBoard';
import useFlash from '@/hooks/useFlash';
import CheckmarkIcon from '@/icons/CheckmarkIcon';
import ChevronRightIcon from '@/icons/ChevronRightIcon';
import RefreshIcon from '@/icons/RefreshIcon';

const SPINNER_DEMO_MS = 1500;

// The preview's own class names are left out of the stylesheet, so the few
// layout rules this page needs are inline.
const WRAPPING_ROW: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
};

const TWO_COLUMNS: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
};

const GUESTS: Guest[] = [
  {
    id: 'mickey',
    name: 'Mickey Mouse',
  },
  {
    id: 'minnie',
    name: 'Minnie Mouse',
  },
  {
    id: 'pluto',
    name: 'Pluto',
  },
];

const SORT_OPTIONS = new Map([
  [
    'priority',
    {
      text: 'Priority',
    },
  ],
  [
    'standby',
    {
      text: 'Standby',
    },
  ],
  [
    'soonest',
    {
      text: 'Soonest',
    },
  ],
]);

// Every shared building block on one page, for checking the design system
// without clicking through the app.
export default function Kit() {
  const [flashElem, flash] = useFlash();
  const [isLoading, setIsLoading] = useState(false);
  const [sortType, setSortType] = useState('priority');
  const [selectedIds, setSelectedIds] = useState(new Set(['mickey']));

  function showSpinner() {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), SPINNER_DEMO_MS);
  }

  function toggleGuest(guest: Guest) {
    const toggledIds = new Set(selectedIds);

    if (toggledIds.has(guest.id)) {
      toggledIds.delete(guest.id);
    } else {
      toggledIds.add(guest.id);
    }

    setSelectedIds(toggledIds);
  }

  return (
    <Screen
      title="Building blocks"
      buttons={
        <Button title="Refresh" onClick={showSpinner}>
          <RefreshIcon />
        </Button>
      }
    >
      <h2 className="section-title">Buttons</h2>
      <div style={WRAPPING_ROW}>
        <Button variant="primary">Primary</Button>
        <Button>Secondary</Button>
        <Button variant="quiet">Quiet</Button>
        <Button variant="danger">Danger</Button>
        <Button disabled>Disabled</Button>
        <Button type="small">Small</Button>
        <Button type="small" variant="primary">
          Small primary
        </Button>
      </div>
      <Button type="full" className="mt-3">
        Full width
      </Button>

      <h2 className="section-title">Badges</h2>
      <div style={WRAPPING_ROW}>
        <span className="badge">Default</span>
        <span className="badge badge-solid">
          <CheckmarkIcon className="w-4" />
          Solid
        </span>
        <span className="badge badge-muted">Muted</span>
        <span className="badge badge-danger">Danger</span>
      </div>

      <h2 className="section-title">Grouped list</h2>
      <ul className="list">
        <li className="row">
          <span className="row-title">Plain row</span>
          <span className="row-detail">Detail</span>
        </li>
        <li>
          <button className="row" onClick={() => flash('Row tapped')}>
            <span className="row-title">Row that opens something</span>
            <ChevronRightIcon className="text-muted" />
          </button>
        </li>
        <li className="row">
          <span className="row-title">
            Row with an action
            <span className="row-detail block">Second line of detail</span>
          </span>
          <Button type="small">Change</Button>
        </li>
      </ul>

      <h2 className="section-title">Card</h2>
      <div className="card">
        <h3 className="mt-0">Card title</h3>
        <p className="note mb-0">
          A card holds one self-contained piece of content. Secondary copy uses
          the note class.
        </p>
      </div>

      <h2 className="section-title">Alerts</h2>
      <Alert title="Title only" className="mt-0" />
      <Alert title="Title and details">
        <p>Details explain what happened and what to do about it.</p>
      </Alert>

      <h2 className="section-title">Form controls</h2>
      <div style={TWO_COLUMNS}>
        <label className="field">
          <span className="field-label">Select</span>
          <Select
            options={SORT_OPTIONS}
            selected={sortType}
            onChange={setSortType}
            title="Sort By"
            className="w-full"
          />
        </label>
        <label className="field">
          <span className="field-label">Text input</span>
          <input className="input" placeholder="Placeholder" />
        </label>
      </div>
      <div style={WRAPPING_ROW} className="mt-4">
        <input type="checkbox" defaultChecked aria-label="Checked" />
        <input type="checkbox" aria-label="Unchecked" />
        <input type="radio" name="kit" defaultChecked aria-label="Selected" />
        <input type="radio" name="kit" aria-label="Not selected" />
      </div>

      <h2 className="section-title">Guest list</h2>
      <GuestList
        guests={GUESTS}
        selectable={{
          isSelected: guest => selectedIds.has(guest.id),
          onToggle: toggleGuest,
          limit: 2,
        }}
        conflicts={{
          pluto: 'NOT_IN_PARK',
        }}
      />

      <h2 className="section-title">Time board</h2>
      <TimeBoard label="Next queue opening" time="13:00:00" />

      <h2 className="section-title">Feedback</h2>
      <div style={WRAPPING_ROW}>
        <Button onClick={() => flash('Queue not open yet')}>
          Show message
        </Button>
        <Button onClick={() => flash('Network request failed', 'error')}>
          Show error
        </Button>
        <Button onClick={showSpinner}>Show spinner</Button>
      </div>
      <p className="empty-state">An empty state says what is going on.</p>

      <FloatingButton onClick={() => flash('Primary action')}>
        Primary action
      </FloatingButton>
      {isLoading && <Spinner />}
      {flashElem}
    </Screen>
  );
}
