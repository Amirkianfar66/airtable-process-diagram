import React from 'react';
import {
  EquipmentIcon,
  PipeIcon,
  InstrumentIcon,
  InlineValveIcon,
  ElectricalIcon,
} from '../Icons';

const categoryToIcon = {
  Equipment: EquipmentIcon,
  Pipe: PipeIcon,
  Instrument: InstrumentIcon,
  'Inline Valve': InlineValveIcon,
  Electrical: ElectricalIcon,
};

export default function ItemNode({ data }) {
  const { label, category } = data;
  const IconComponent = categoryToIcon[category] || (() => <div>❓</div>);

  return (
    <div style={{ textAlign: 'center', padding: 5 }}>
      <IconComponent />
      <div style={{ fontSize: 12 }}>{label}</div>
    </div>
  );
}
