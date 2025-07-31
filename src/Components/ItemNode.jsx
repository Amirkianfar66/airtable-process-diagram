import { Handle, Position } from 'reactflow';
import CategoryIcons from '../icons'; // This is your SVG icon map

const ItemNode = ({ data }) => {
  const Icon = CategoryIcons[data.category] || (() => <div style={{ fontSize: 24 }}>❓</div>);

  return (
    <div style={{ textAlign: 'center', padding: 5, minWidth: 100 }}>
      {/* Incoming connection handle */}
      <Handle type="target" position={Position.Top} style={{ background: '#1e90ff' }} />

      {/* Icon box */}
      <div style={{ padding: 4, border: `2px solid ${data.color || 'gray'}`, borderRadius: 8, background: 'white' }}>
        <Icon size={60} />
      </div>

      {/* Label under icon */}
      <div style={{ fontSize: 10, marginTop: 4 }}>{data.label}</div>

      {/* Outgoing connection handle */}
      <Handle type="source" position={Position.Bottom} style={{ background: '#1e90ff' }} />
    </div>
  );
};

export default ItemNode;
