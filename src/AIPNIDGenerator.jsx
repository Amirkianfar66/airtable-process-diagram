import { getItemIcon, categoryTypeMap } from './IconManager';
import { parseItemText } from './aiParser';

export default async function AIPNIDGenerator(description, itemsLibrary = [], existingNodes = [], existingEdges = [], setSelectedItem, setChatMessages) {
    if (!description) return { nodes: existingNodes, edges: existingEdges };

    // AI-powered parsing
    const parsed = await parseItemText(description);
    if (!parsed) return { nodes: existingNodes, edges: existingEdges };

    const Name = (parsed?.Name || description).trim();
    const Category = (parsed?.Category && parsed.Category !== '' ? parsed.Category : 'Equipment').trim();
    const Type = (parsed?.Type && parsed.Type !== '' ? parsed.Type : 'Generic').trim();

    // Check if item exists
    const match = itemsLibrary.find(item =>
        item.Name?.toLowerCase() === Name.toLowerCase() &&
        item.Category?.toLowerCase() === Category.toLowerCase() &&
        item.Type?.toLowerCase() === Type.toLowerCase()
    );

    const item = match || { Name, Category, Type, id: `ai-${Date.now()}-${Math.random()}` };
    const label = `${item.Code || ''}${item.Code ? ' - ' : ''}${item.Name}`;

    const newNode = {
        id: item.id,
        position: { x: Math.random() * 600 + 100, y: Math.random() * 400 + 100 },
        data: {
            label,
            item,
            icon: getItemIcon(item),
        },
        type: categoryTypeMap[Category] || 'scalableIcon',
    };

    if (typeof setSelectedItem === 'function') setSelectedItem(item);

    // Send AI response to chatbox
    if (typeof setChatMessages === 'function') {
        setChatMessages(prev => [...prev, {
            sender: 'AI',
            message: `AI Parsed: Name=${item.Name}, Category=${item.Category}, Type=${item.Type}`
        }]);
    }

    return {
        nodes: [...existingNodes, newNode],
        edges: [...existingEdges],
    };
}
