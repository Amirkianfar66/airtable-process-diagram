// src/components/IconSelector.jsx
import PipeIcon from '../icon/Pipe';
import InlineItemIcon from '../icon/InlineItem';
import ValveIcon from '../icon/Valve';
import InstrumentIcon from '../icon/Instrument';
import EquipmentIcon from '../icon/Equipment';

const iconMap = {
  Pipe: PipeIcon,
  'Inline item': InlineItemIcon,
  Valve: ValveIcon,
  Instrument: InstrumentIcon,
  Equipment: EquipmentIcon,
};

const IconSelector = ({ category }) => {
  const IconComponent = iconMap[category];
  return IconComponent ? <IconComponent /> : null;
};

export default IconSelector;
