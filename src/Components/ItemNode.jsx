const categoryColors = {
  Equipment: 'green',
  Pipe: 'blue',
  Instrument: 'orange',
  'Inline Valve': 'black',
  Electrical: 'red',
};

export default function ItemNode({ data }) {
  const { label, category } = data;
  const IconComponent = categoryToIcon[category] || (() => <div>❓</div>);
  const bgColor = categoryColors[category] || '#ccc';

  return (
    <div
      style={{
        backgroundColor: bgColor,
        color: 'white',
        borderRadius: 5,
        width: 160,
        height: 60,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 5,
        fontSize: 12,
      }}
    >
      <IconComponent />
      <div>{label}</div>
    </div>
  );
}
