import { getItemIcon, categoryTypeMap } from './IconManager';
import { parseItemText } from './aiParser';

export default async function AIPNIDGenerator(description, itemsLibrary = [], existingNodes = [], existingEdges = [], setSelectedItem, setChatMessages) {
    if (!description) return { nodes: existingNodes, edges: existingEdges };

    // AI-powered parsing
    const parsed = await parseItemText(description);
    if (!parsed) return { nodes: existingNodes, edges: existingEdges };

    const { Name, Category, Type } = parsed;

    // Normalize values
    const normName = (Name || '').trim();
    const normCategory = (Category || 'Equipment').trim();
    const normType = (Type || 'Generic').trim();

    // Check if item exists
    const match = itemsLibrary.find(item =>
        item.Name?.toLowerCase() === normName.toLowerCase() &&
        item.Category?.toLowerCase() === normCategory.toLowerCase() &&
        item.Type?.toLowerCase() === normType.toLowerCase()
    );

    const item = match || {
        Name: normName,
        Category: normCategory,
        Type: normType,
        id: `ai-${Date.now()}-${Math.random()}`
    };

    const label = `${item.Code || ''}${item.Code ? ' - ' : ''}${item.Name || normName}`;

    const newNode = {
        id: item.id,
        position: { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 },
        data: {
            label,
            item,
            icon: getItemIcon(item),
        },
        type: categoryTypeMap[normCategory] || 'scalableIcon',
    };

    if (typeof setSelectedItem === 'function') setSelectedItem(item);

    // Send AI response to chatbox
    if (typeof setChatMessages === 'function') {
        setChatMessages(prev => [...prev, {
            sender: 'AI',
            message: `Parsed Item: Name=${item.Name}, Category=${item.Category}, Type=${item.Type}`
        }]);
    }

    return {
        nodes: [...existingNodes, newNode],
        edges: [...existingEdges],
    };
}
