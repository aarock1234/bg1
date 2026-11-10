import { use } from 'react';

import TabsContext, { TabDef } from '@/contexts/TabContext';

export default function TabButton<N extends string>({ name, icon }: TabDef<N>) {
  const { active, changeTab } = use(TabsContext);

  if (!changeTab) {
    return null;
  }

  const isActive = active?.name === name;

  return (
    <button
      className="tab"
      aria-current={isActive ? 'page' : undefined}
      onClick={() => changeTab(name)}
    >
      <div>{icon}</div>
      <div>{name}</div>
    </button>
  );
}
