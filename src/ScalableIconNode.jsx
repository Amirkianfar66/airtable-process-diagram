// ...your imports and component code

export default function ScalableIconNode({ id, data }) {
    // your existing state, handlers, scaling logic, etc.

    return (
        <div
            style={{
                position: 'relative',
                width: baseSize * (data.scaleX || 1),
                height: baseSize * (data.scaleY || 1),
                pointerEvents: 'all',
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Scaled icon, which includes its own handles */}
            <div
                style={{
                    transform: `scale(${data.scaleX || 1}, ${data.scaleY || 1})`,
                    transformOrigin: 'top left',
                    width: baseSize,
                    height: baseSize,
                    pointerEvents: 'none',
                }}
            >
                {data.icon}
            </div>

            {/* Your existing control buttons */}
            {visible && (
                <div style={/* your existing styling */}>
                    {/* buttons */}
                </div>
            )}

            {/* <-- REMOVE Handles from here! They are inside the icon now --> */}
        </div>
    );
}
