// Module-level store for the pixel height of the element a drag started on.
// Drag events don't expose source dimensions, so timeline drops use this to
// preserve the dragged block's duration when it lands on a new time slot.
let dragSourceHeight = 0;

export function setDragSourceHeight(height: number): void {
  dragSourceHeight = height;
}

export function getDragSourceHeight(): number {
  return dragSourceHeight;
}

// Custom MIME types so timeline drop targets can distinguish intention tasks,
// schedule blocks, and time logs dragged from different UI surfaces.
export const TASK_DRAG_MIME = 'application/x-intent-scheduler-task';
export const BLOCK_DRAG_MIME = 'application/x-intent-scheduler-block';
export const LOG_DRAG_MIME = 'application/x-intent-scheduler-log';
