// src/components/IconSelector.jsx
import PipeIcon from 'src/Icons/Pipe';
import InlineItemIcon from 'src/Icons/InlineItem';
import ValveIcon from 'src/Icons/Valve';
import InstrumentIcon from 'src/Icons/Instrument';
import EquipmentIcon from 'src/Icons/Equipment';

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
