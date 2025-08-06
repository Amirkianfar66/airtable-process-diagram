// src/Components/IconSelector.jsx
import Pipe from 'src/Icons/Pipe';
import InlineItem from 'src/Icons/InlineItem';
import Valven from 'src/Icons/Valve';
import Instrument from 'src/Icons/Instrument';
import Equipment from 'src/Icons/Equipment';

const iconMap = {
  Pipe: Pipe,
  'Inline item': InlineItem,
  Valve: Valve,
  Instrument: Instrument,
  Equipment: Equipment,
};

const IconSelector = ({ category }) => {
  const IconComponent = iconMap[category];
  return IconComponent ? <IconComponent /> : null;
};

export default IconSelector;
