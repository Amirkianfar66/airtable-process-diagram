import React, { useEffect, useRef, useState } from 'react';

/**
 * GroupDetailCard
 * - Default export
 * - Shows members of a group
 * - Tries to resolve human-friendly labels for Airtable-linked node ids
 * - Preferred usage: parent passes `allItems` map (id -> normalized item)
 * - Fallback: component will fetch missing item records from Airtable and cache them
 */
export default function GroupDetailCard({
  node,
  childrenNodes = [],
  childrenLabels = [],
  allItems = {},
  startAddItemToGroup,
  onAddItem,
  onRemoveItem,
  onChange,
  onDelete
}) {
  const groupId = node?.id;
  const [manualAddId, setManualAddId] = useState('');

  // Local cache (memory) for fetched items across renders
  const itemsCacheRef = useRef(new Map());
  // State for resolved items fetched by this component
  const [resolvedItems, setResolvedItems] = useState({});

  // Helper to normalize a raw Airtable record fields into the shape we want
  const normalizeFields = (fields = {}) => ({
    Code: fields['Item Code'] || fields['Code'] || '',
    Name: fields['Name'] || '',
    'Category Item Type': fields['Category Item Type'] || fields['Category'] || ''
  });

  // Effect: fetch any unknown children node ids that are likely Airtable record ids
  useEffect(() => {
    if (!Array.isArray(childrenNodes) || childrenNodes.length === 0) return;

    const idsToFetch = childrenNodes
      .map(n => n.id)
      .filter(id => {
        if (!id) return false;
        // Skip synthetic labels (these are created inside this component)
        if (String(id).startsWith(`${groupId}-lbl-`)) return false;
        // If parent already provided the item, skip
        if (allItems && allItems[id]) return false;
        // If we've resolved it already in state, skip
        if (resolvedItems && resolvedItems[id]) return false;
        // If we have it in our in-memory cache, skip (we'll still copy it into resolvedItems for render consistency)
        if (itemsCacheRef.current.has(id)) return false;
        return true;
      });

    if (idsToFetch.length === 0) return;

    (async () => {
      try {
        const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
        const token = import.meta.env.VITE_AIRTABLE_TOKEN;
        const itemsTableId = import.meta.env.VITE_AIRTABLE_ITEMS_TABLE_ID;
        if (!baseId || !token || !itemsTableId) {
          console.warn('GroupDetailCard: missing Airtable env vars (VITE_AIRTABLE_BASE_ID, VITE_AIRTABLE_TOKEN, VITE_AIRTABLE_ITEMS_TABLE_ID)');
          // create placeholders so we don't retry forever
          const placeholders = {};
          idsToFetch.forEach(id => placeholders[id] = { Code: '', Name: id, 'Category Item Type': '' });
          setResolvedItems(prev => ({ ...prev, ...placeholders }));
          return;
        }

        await Promise.all(idsToFetch.map(async (id) => {
          try {
            const url = `https://api.airtable.com/v0/${baseId}/${itemsTableId}/${id}`;
            const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) {
              // fallback: treat id as a label
              const fallback = { Code: '', Name: id, 'Category Item Type': '' };
              itemsCacheRef.current.set(id, fallback);
              setResolvedItems(prev => ({ ...prev, [id]: fallback }));
              return;
            }
            const rec = await res.json();
            const normalized = normalizeFields(rec.fields || {});
            itemsCacheRef.current.set(id, normalized);
            setResolvedItems(prev => ({ ...prev, [id]: normalized }));
          } catch (err) {
            console.error('GroupDetailCard: failed to fetch item', id, err);
            const fallback = { Code: '', Name: id, 'Category Item Type': '' };
            itemsCacheRef.current.set(id, fallback);
            setResolvedItems(prev => ({ ...prev, [id]: fallback }));
          }
        }));
      } catch (err) {
        console.error('GroupDetailCard: error resolving children ids', err);
      }
    })();

  }, [childrenNodes, allItems, resolvedItems, groupId]);

  // Build the normalized `display` array used for rendering
  const display = (Array.isArray(childrenNodes) && childrenNodes.length > 0)
    ? childrenNodes.map(n => {
        const id = n.id;
        const itemFromNode = n.data?.item;
        const itemFromAll = allItems?.[id];
        const itemFromResolved = resolvedItems?.[id] || itemsCacheRef.current.get(id);
        const item = itemFromNode || itemFromAll || itemFromResolved;

        const label = n.displayLabel ?? n.data?.label ?? (
          item
            ? `${item.Code || ''}${item.Code && item.Name ? ' - ' : ''}${item.Name || ''}`.trim()
            : id
        );

        return {
          id,
          label,
          category: item?.['Category Item Type'] || item?.Category || ''
        };
      })
    : (Array.isArray(childrenLabels) && childrenLabels.length > 0)
      ? childrenLabels.map((lbl, i) => ({ id: `${groupId}-lbl-${i}`, label: lbl }))
      : (Array.isArray(node?.data?.children)
          ? node.data.children.map((lbl, i) => ({ id: `${groupId}-lbl-${i}`, label: lbl }))
          : []);

  return (
    <div style={{
      background: '#fff',
      borderRadius: '10px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      padding: '20px',
      margin: '16px',
      maxWidth: '350px',
      fontFamily: 'sans-serif'
    }}>
      <section>
        <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: 6, marginBottom: 12 }}>
          Group: {node?.data?.label || node?.id}
        </h3>

        <div style={{ marginBottom: 12 }}>
          <button onClick={() => startAddItemToGroup?.(groupId)} style={{ marginRight: 8 }}>
            Start: click a node to add
          </button>

          <input
            placeholder="node id to add"
            value={manualAddId}
            onChange={(e) => setManualAddId(e.target.value)}
            style={{ padding: '6px 8px', marginRight: 8, width: 160 }}
          />
          <button
            onClick={() => { if (manualAddId && onAddItem) { onAddItem(manualAddId); setManualAddId(''); } }}
            style={{ marginRight: 8 }}
          >
            Add by id
          </button>

          <button onClick={() => onDelete?.(groupId)} style={{ color: 'red' }}>
            Delete group
          </button>
        </div>

        <div style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>
          Members ({display.length})
        </div>

        <div style={{ maxHeight: 300, overflowY: 'auto', borderTop: '1px solid #eee', paddingTop: 8 }}>
          {display.length === 0 ? (
            <div style={{ color: '#999' }}>No children</div>
          ) : (
            display.map(ch => (
              <div key={ch.id} style={{
                padding: '8px 0',
                borderBottom: '1px dashed #f0f0f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{ch.label}</div>
                  {ch.category && <div style={{ fontSize: 12, color: '#777' }}>{ch.category}</div>}
                </div>

                {/* Remove only works if we have a real node id */}
                {onRemoveItem && !(String(ch.id).startsWith(`${groupId}-lbl-`)) ? (
                  <button onClick={() => onRemoveItem(ch.id)} style={{ fontSize: 12 }}>Remove</button>
                ) : (
                  <button style={{ fontSize: 12, opacity: 0.5 }} disabled>Remove</button>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
