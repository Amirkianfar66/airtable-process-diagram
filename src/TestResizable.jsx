// src/TestResizable.jsx
import React from 'react';
import { ResizableBox } from 'react-resizable';
import 'react-resizable/css/styles.css'; // ✅ You must import this

export default function TestResizable() {
    return (
        <div style={{ padding: '20px' }}>
            <ResizableBox
                width={200}
                height={200}
                minConstraints={[100, 100]}
                maxConstraints={[300, 300]}
                resizeHandles={['se']}
            >
                <div style={{ width: '100%', height: '100%', background: '#f0f0f0' }}>
                    Resize me!
                </div>
            </ResizableBox>
        </div>
    );
}
