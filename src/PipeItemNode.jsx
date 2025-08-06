// PipeItemNode.jsx
import { Handle, Position } from 'reactflow';
import PipeIcon from './Icons/PipeIcon';

const PipeItemNode = ({ data }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: 6,
        border: '1px solid #00acc1',
        borderRadius: 4,
        background: '#e0f7fa',
      }}
    >
      <PipeIcon />
      <strong>{data.label}</strong>

      {/* Handles for flow direction */}
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Left} />
    </div>
  );
};

export default PipeItemNode;
