let dragSourceHeight = 0;

export function setDragSourceHeight(height: number): void {
  dragSourceHeight = height;
}

export function getDragSourceHeight(): number {
  return dragSourceHeight;
}

export const TASK_DRAG_MIME = 'application/x-intent-scheduler-task';
export const BLOCK_DRAG_MIME = 'application/x-intent-scheduler-block';
