// ✅ CustomItemNode.js
export default function CustomItemNode({ data }) {
  return (
    <div style={{ background: 'transparent', padding: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
      {data.icon && data.icon}
      <span style={{ color: '#000', fontSize: 12 }}>{data.label}</span>
    </div>
  );
}
