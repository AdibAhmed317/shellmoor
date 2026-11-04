import { Fragment, useState, type DragEvent } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { Columns2, GripVertical, Pencil, Rows2, X } from 'lucide-react';
import { contextMenu, prompt } from '../store/overlays';
import { keyLabel } from '../commands';
import { useWorkspace, type DragPayload, type DropZone, type LayoutNode, type PanelNode } from '../store/workspace';
import { useProfiles } from '../store/profiles';
import { dragSource, endDrag, useUi } from '../store/ui';
import { panels, paneTitle } from '../panels/registry';
import { IconButton } from '../ui';

const zoneRect: Record<DropZone, string> = {
  left: 'inset-y-1.5 left-1.5 w-[calc(50%-6px)]',
  right: 'inset-y-1.5 right-1.5 w-[calc(50%-6px)]',
  top: 'inset-x-1.5 top-1.5 h-[calc(50%-6px)]',
  bottom: 'inset-x-1.5 bottom-1.5 h-[calc(50%-6px)]',
  center: 'inset-1.5',
};

// Covers a pane while something is dragged. It sits above iframes, xterm and Monaco,
// which would otherwise swallow the drag events, and previews where the drop will land.
// Mounted only during a drag, so each drag starts with no zone highlighted.
function DropOverlay({ node, payload }: { node: PanelNode; payload: DragPayload }) {
  const activeTabId = useWorkspace((s) => s.activeTabId);
  const drop = useWorkspace((s) => s.drop);
  const [zone, setZone] = useState<DropZone | null>(null);

  if (payload.type === 'pane' && payload.panelId === node.id) return null;
  if (payload.type === 'tab' && payload.tabId === activeTabId) return null;

  const pick = (e: DragEvent<HTMLDivElement>): DropZone => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const [edge, dist] = (
      [['left', x], ['right', 1 - x], ['top', y], ['bottom', 1 - y]] as [DropZone, number][]
    ).reduce((a, b) => (b[1] < a[1] ? b : a));
    // Only panes can swap, so other drags always dock to the nearest edge.
    return dist < 0.3 || payload.type !== 'pane' ? edge : 'center';
  };

  return (
    <div
      className="absolute inset-0 z-20"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setZone(pick(e));
      }}
      onDragLeave={() => setZone(null)}
      onDrop={(e) => {
        e.preventDefault();
        drop(payload, node.id, pick(e));
        endDrag();
      }}
    >
      {zone && (
        <div className={`pointer-events-none absolute flex items-center justify-center rounded-lg border-2 border-accent/70 bg-accent/15 text-xs font-medium text-accent backdrop-blur-[1px] transition-all duration-100 ${zoneRect[zone]}`}>
          {zone === 'center' ? 'Swap' : `Dock ${zone}`}
        </div>
      )}
    </div>
  );
}

// Recursively renders a tab's layout tree as nested resizable groups.
// Panes are floating cards; a lone pane gets no header, split panes get a slim one you can drag.
export default function LayoutView({ node, activePanelId, split }: { node: LayoutNode; activePanelId: string; split: boolean }) {
  const { focusPanel, splitPanel, closePanel } = useWorkspace();
  const dragging = useUi((s) => s.drag);
  useProfiles((s) => s.profiles); // pane titles show profile names

  if (node.type === 'panel') {
    const { component: Component, icon: Icon } = panels[node.kind];
    const focused = node.id === activePanelId;
    const isSource = dragging?.type === 'pane' && dragging.panelId === node.id;
    return (
      <div
        data-pane-id={node.id} // used by keyboard focus navigation
        onMouseDown={() => focusPanel(node.id)}
        className={`card relative flex h-full w-full flex-col overflow-hidden rounded-xl transition-[border-color,opacity] ${isSource ? 'opacity-40' : ''}`}
        style={split && focused ? { borderColor: 'color-mix(in oklab, var(--color-accent) 55%, transparent)' } : undefined}
      >
        {split && (
          <div
            {...dragSource({ type: 'pane', panelId: node.id })}
            onContextMenu={(e) =>
              contextMenu(e, [
                { label: 'Split Right', icon: Columns2, shortcut: keyLabel('KeyD'), onSelect: () => splitPanel(node.id, 'horizontal') },
                { label: 'Split Down', icon: Rows2, shortcut: keyLabel('KeyE'), onSelect: () => splitPanel(node.id, 'vertical') },
                'separator',
                {
                  label: 'Rename Pane…', icon: Pencil,
                  onSelect: async () => {
                    const name = await prompt({ title: 'Rename Pane', value: paneTitle(node), confirmLabel: 'Rename' });
                    if (name) useWorkspace.getState().renamePanel(node.id, name);
                  },
                },
                { label: 'Close Pane', icon: X, shortcut: keyLabel('KeyW'), onSelect: () => closePanel(node.id) },
              ])
            }
            title="Drag to move this pane"
            className={`group flex h-8 shrink-0 cursor-grab items-center gap-2 border-b border-border pl-1.5 pr-1.5 text-xs transition-colors active:cursor-grabbing ${focused ? 'text-text' : 'text-muted'}`}
          >
            <GripVertical size={12} className="text-muted/50 group-hover:text-muted" />
            <Icon size={13} strokeWidth={1.9} className={focused ? 'text-accent' : ''} />
            <span className="flex-1 truncate font-medium">{paneTitle(node)}</span>
            <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
              <IconButton icon={Columns2} size={13} label="Split right" className="!h-6 !w-6" onClick={() => splitPanel(node.id, 'horizontal')} />
              <IconButton icon={Rows2} size={13} label="Split down" className="!h-6 !w-6" onClick={() => splitPanel(node.id, 'vertical')} />
              <IconButton icon={X} size={13} label="Close pane" className="!h-6 !w-6" onClick={() => closePanel(node.id)} />
            </div>
          </div>
        )}
        {/* @container lets panels adapt to the pane's width, not the window's. */}
        <div className="@container min-h-0 flex-1">
          <Component panelId={node.id} profileId={node.profileId} extensionId={node.extensionId} />
        </div>
        {dragging && <DropOverlay node={node} payload={dragging} />}
      </div>
    );
  }

  // Separators are an invisible 8px gutter with a grabber that appears on hover.
  const horizontal = node.direction === 'horizontal';
  return (
    <Group orientation={node.direction} className="h-full w-full">
      {node.children.map((child, i) => (
        <Fragment key={child.id}>
          {i > 0 && (
            <Separator className={`group flex items-center justify-center ${horizontal ? 'w-2' : 'h-2'}`}>
              <div className={`rounded-full bg-text/40 opacity-0 transition-opacity group-hover:opacity-100 ${horizontal ? 'h-10 w-1' : 'h-1 w-10'}`} />
            </Separator>
          )}
          <Panel minSize={160}>
            <LayoutView node={child} activePanelId={activePanelId} split={split} />
          </Panel>
        </Fragment>
      ))}
    </Group>
  );
}
