import { use } from 'react';

import { Offer } from '@/api/ll';
import Alert from '@/components/Alert';
import Button from '@/components/Button';
import ClientsContext from '@/contexts/ClientsContext';
import NavContext from '@/contexts/NavContext';

import OverlappingPlans from '../../OverlappingPlans';
import { ReturnTimeCard } from '../../ReturnTime';
import SelectReturnTime from '../SelectReturnTime';
import PartyList from './PartyList';

type OfferDetailsProps = {
  offer: Offer;
  onOfferChange: (offer: Offer) => void;
};

function ChangeTimeButton({ offer, onOfferChange }: OfferDetailsProps) {
  const { goTo } = use(NavContext);

  function selectReturnTime(): void {
    goTo(<SelectReturnTime offer={offer} onOfferChange={onOfferChange} />);
  }

  return (
    <Button type="small" onClick={selectReturnTime}>
      Change
    </Button>
  );
}

// Shows the return time being offered and who it would be booked for.
export default function OfferDetails({
  offer,
  onOfferChange,
}: OfferDetailsProps) {
  const { timeSelect } = use(ClientsContext).ll.rules;

  return (
    <>
      <ReturnTimeCard
        {...offer}
        button={
          timeSelect && (
            <ChangeTimeButton offer={offer} onOfferChange={onOfferChange} />
          )
        }
      />
      {offer.changed && <Alert title="Return Time Changed" />}
      <OverlappingPlans offer={offer} />
      <PartyList />
    </>
  );
}
