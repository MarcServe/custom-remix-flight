import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";

export interface KanbanItem {
  id: string;
  title: string;
  status: string;
  company?: string;
  amount?: number;
  closeDate?: string;
}

interface KanbanBoardProps {
  items: KanbanItem[];
  columns: { id: string; title: string }[];
  onStatusChange: (itemId: string, newStatus: string) => void;
  onItemClick?: (item: KanbanItem) => void;
}

export function KanbanBoard({
  items,
  columns,
  onStatusChange,
  onItemClick,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      return;
    }

    const activeItem = items.find((item) => item.id === active.id);
    const overColumn = columns.find((col) => col.id === over.id);

    if (activeItem && overColumn && activeItem.status !== overColumn.id) {
      onStatusChange(activeItem.id, overColumn.id);
    }

    setActiveId(null);
  };

  const activeItem = activeId ? items.find((item) => item.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((column) => {
          const columnItems = items.filter((item) => item.status === column.id);
          return (
            <KanbanColumn
              key={column.id}
              id={column.id}
              title={column.title}
              count={columnItems.length}
              items={columnItems.map((item) => item.id)}
            >
              {columnItems.map((item) => (
                <KanbanCard
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  company={item.company}
                  amount={item.amount}
                  closeDate={item.closeDate}
                  onClick={() => onItemClick?.(item)}
                />
              ))}
            </KanbanColumn>
          );
        })}
      </div>
      
      <DragOverlay>
        {activeItem ? (
          <KanbanCard
            id={activeItem.id}
            title={activeItem.title}
            company={activeItem.company}
            amount={activeItem.amount}
            closeDate={activeItem.closeDate}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
