
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DraggableWidgetProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  editMode?: boolean;
}

export function DraggableWidget({ id, children, className, editMode = false }: DraggableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
        ref={setNodeRef} 
        style={style} 
        className={cn(
            "relative group h-full", 
            editMode && "ring-2 ring-indigo-500/20 rounded-[2rem] bg-white",
            className
        )}
    >
      {/* Drag Handle - Only Valid in Edit Mode */}
      {editMode && (
          <div 
            {...attributes} 
            {...listeners}
            className="absolute top-4 right-4 z-50 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm cursor-grab active:cursor-grabbing hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors"
          >
             <GripVertical className="w-5 h-5" />
          </div>
      )}
      
      {/* Render Content */}
      <div className={cn("h-full", editMode && "pointer-events-none")}>{children}</div>
    </div>
  );
}
