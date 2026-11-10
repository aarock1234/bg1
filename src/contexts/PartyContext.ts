import { createContext } from 'react';

import { Guest, Guests } from '@/api/ll';

import { Theme } from './ThemeContext';

type PartyPark = {
  name: string;
  theme: Theme;
};

type PartyExperience = {
  name: string;
  park: PartyPark;
};

export interface Party extends Guests {
  selected: Guest[];
  setSelected: (guests: Guest[]) => void;
  experience: PartyExperience;
}

export default createContext<Party>({
  eligible: [],
  ineligible: [],
  selected: [],
  setSelected: () => null,
  experience: {
    name: '',
    park: {
      name: '',
      theme: {
        bg: '',
        text: '',
        color: '',
      },
    },
  },
});
