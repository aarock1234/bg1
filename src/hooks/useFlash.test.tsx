import Flash from '@/components/Flash';
import { act, click, render, see } from '@/testing';

import useFlash from './useFlash';

jest.useFakeTimers();

// An error is told apart from an alert by its icon, which is the only one
// drawn in the accent color.
const ERROR_ICON_CLASS = 'text-danger';

function flashIcon(message: string) {
  return see(message).querySelector('svg');
}

describe('Flash', () => {
  it('shows alert message', () => {
    render(<Flash message="hi" type="alert" />);
    expect(see('hi')).toHaveRole('alert');
    expect(flashIcon('hi')).not.toHaveClass(ERROR_ICON_CLASS);
  });

  it('shows error message', () => {
    render(<Flash message="oops" type="error" />);
    expect(see('oops')).toHaveRole('alert');
    expect(flashIcon('oops')).toHaveClass(ERROR_ICON_CLASS);
  });

  it('renders null when no message', () => {
    const { container } = render(<Flash message="" type="alert" />);
    expect(container).toBeEmptyDOMElement();
  });
});

function UseFlashExample() {
  const [flashElem, flash] = useFlash();
  return (
    <div>
      {flashElem}
      <button onClick={() => flash('hi')}>Alert</button>
      <button onClick={() => flash('oops', 'error')}>Error</button>
    </div>
  );
}

describe('useFlash()', () => {
  it('flashes message when triggered', async () => {
    render(<UseFlashExample />);
    see.no('hi');
    see.no('oops');

    click('Alert');
    expect(flashIcon('hi')).not.toHaveClass(ERROR_ICON_CLASS);

    click('Error');
    expect(flashIcon('oops')).toHaveClass(ERROR_ICON_CLASS);
    act(() => {
      jest.runOnlyPendingTimers();
    });
    see.no('oops');
  });
});
