export default function CustomItemNode({ data }) {
    return (
        <div style={{ background: 'transparent', padding: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            {data.icon && data.icon}
            <span
                style={{
                    color: data.color || '#000',
                    fontSize: data.fontSize || 40,   // <-- read from data
                    fontWeight: data.fontWeight || 'normal', // optional
                    fontFamily: data.fontFamily || 'Arial, sans-serif', // optional
                }}
            >
                {data.label}
            </span>
        </div>
    );
}
