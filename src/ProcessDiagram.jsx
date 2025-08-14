useEffect(() => {
    const savedLayout = localStorage.getItem('diagram-layout');
    if (savedLayout) {
        const parsed = JSON.parse(savedLayout);
        setNodes(parsed.nodes || []);
        setEdges(parsed.edges || []);
        setDefaultLayout(parsed);
    } else {
        fetchData().then(items => {
            const grouped = {};
            items.forEach(item => {
                const { Unit, SubUnit = item['Sub Unit'], ['Category Item Type']: Category, Sequence = 0, Name, ['Item Code']: Code } = item;
                if (!Unit || !SubUnit) return;
                if (!grouped[Unit]) grouped[Unit] = {};
                if (!grouped[Unit][SubUnit]) grouped[Unit][SubUnit] = [];
                grouped[Unit][SubUnit].push({ Category, Sequence, Name, Code, fullData: item });
            });

            const newNodes = [];
            const newEdges = [];
            let idCounter = 1;
            let unitX = 0;
            const unitWidth = 5000;
            const unitHeight = 3000;
            const subUnitHeight = unitHeight / 9;

            Object.entries(grouped).forEach(([unit, subUnits]) => {
                newNodes.push({
                    id: `unit-${unit}`,
                    position: { x: unitX, y: 0 },
                    data: { label: unit },
                    style: { width: unitWidth, height: unitHeight, backgroundColor: 'transparent', border: '4px solid #444', zIndex: 0 },
                    draggable: false,
                    selectable: false,
                });

                Object.entries(subUnits).forEach(([subUnit, items], index) => {
                    const yOffset = index * subUnitHeight;

                    newNodes.push({
                        id: `sub-${unit}-${subUnit}`,
                        position: { x: unitX + 10, y: yOffset + 10 },
                        data: { label: subUnit },
                        style: { width: unitWidth - 20, height: subUnitHeight - 20, backgroundColor: 'transparent', border: '2px dashed #aaa', zIndex: 1 },
                        draggable: false,
                        selectable: false,
                    });

                    items.sort((a, b) => (a.Sequence || 0) - (b.Sequence || 0));
                    let itemX = unitX + 40;
                    const itemY = yOffset + 20;

                    items.forEach(item => {
                        const id = `item-${idCounter++}`;
                        const IconComponent = categoryIcons[item.Category];
                        newNodes.push({
                            id,
                            position: { x: itemX, y: itemY },
                            data: {
                                label: `${item.Code || ''} - ${item.Name || ''}`,
                                icon: IconComponent ? <IconComponent style={{ width: 20, height: 20 }} /> : null,
                                scale: 1,
                                fullData: item.fullData
                            },
                            type: item.Category === 'Equipment' ? 'equipment' : (item.Category === 'Pipe' ? 'pipe' : 'scalableIcon'),
                            sourcePosition: 'right',
                            targetPosition: 'left',
                        });
                        itemX += 160 + 30;
                    });
                });
                unitX += unitWidth + 100;
            });

            setNodes(newNodes);
            setEdges(newEdges);
            setDefaultLayout({ nodes: newNodes, edges: newEdges });
            localStorage.setItem('diagram-layout', JSON.stringify({ nodes: newNodes, edges: newEdges }));
        }).catch(err => console.error(err));
    }
}, []);
