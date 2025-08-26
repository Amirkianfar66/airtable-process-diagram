// UnitLayoutEditor.jsx
import React from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

export default function UnitLayoutEditor({ unitLayoutOrder, setUnitLayoutOrder }) {
  
  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const { source, destination, type } = result;

    const newLayout = Array.from(unitLayoutOrder);

    if (type === 'row') {
      // reorder rows
      const [movedRow] = newLayout.splice(source.index, 1);
      newLayout.splice(destination.index, 0, movedRow);
    } else if (type === 'unit') {
      // reorder units inside a row
      const rowIndex = parseInt(source.droppableId.split('-')[1]);
      const row = Array.from(newLayout[rowIndex]);
      const [movedUnit] = row.splice(source.index, 1);
      row.splice(destination.index, 0, movedUnit);
      newLayout[rowIndex] = row;
    }

    setUnitLayoutOrder(newLayout);
  };

  const handleUnitChange = (rowIndex, colIndex, value) => {
    const newLayout = [...unitLayoutOrder];
    newLayout[rowIndex][colIndex] = value;
    setUnitLayoutOrder(newLayout);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="rows" type="row">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps}>
            {unitLayoutOrder.map((row, rowIndex) => (
              <Draggable key={rowIndex} draggableId={`row-${rowIndex}`} index={rowIndex}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    style={{ display: 'flex', gap: 10, marginBottom: 10, ...provided.draggableProps.style }}
                  >
                    <div {...provided.dragHandleProps} style={{ cursor: 'grab' }}>☰</div>
                    <Droppable droppableId={`row-${rowIndex}`} type="unit" direction="horizontal">
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} style={{ display: 'flex', gap: 10 }}>
                          {row.map((unit, colIndex) => (
                            <Draggable key={colIndex} draggableId={`unit-${rowIndex}-${colIndex}`} index={colIndex}>
                              {(provided) => (
                                <input
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  value={unit}
                                  onChange={(e) => handleUnitChange(rowIndex, colIndex, e.target.value)}
                                  style={{ width: 120, textAlign: 'center' }}
                                />
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
