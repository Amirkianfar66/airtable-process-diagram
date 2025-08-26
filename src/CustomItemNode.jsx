// ✅ CustomItemNode.js
export default function CustomItemNode({ data }) {
    return (
        <div
            style={{
                position: 'relative',          // needed for absolute label positioning
                width: '100%',
                height: '100%',
                background: 'transparent',
            }}
        >
            {/* Icon (if any) */}
            {data.icon && (
                <div
                    style={{
                        position: 'absolute',
                        top: data.iconOffsetY || 0,
                        left: data.iconOffsetX || 0,
                    }}
                >
                    {data.icon}
                </div>
            )}

            {/* Label */}
            <span
                style={{
                    position: 'absolute',
                    top: data.offsetY || 0,          // vertical offset
                    left: data.offsetX || 0,         // horizontal offset
                    color: data.color || '#000',     // text color
                    fontSize: data.fontSize || 40,   // text size
                    fontWeight: data.fontWeight || 'normal',  // bold, etc.
                    fontFamily: data.fontFamily || 'Arial, sans-serif',
                    whiteSpace: 'nowrap',            // prevent wrapping
                }}
            >
                {data.label}
            </span>
        </div>
    );
}
