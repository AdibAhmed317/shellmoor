import { Fragment } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { useWorkspace, type LayoutNode, type PanelKind } from '../store/workspace';
import { panels } from '../panels/registry';

// Recursively renders a tab's layout tree as nested resizable groups.
export default function LayoutView({ node, activePanelId }: { node: LayoutNode; activePanelId: string }) {
  const { focusPanel, splitPanel, closePanel, setPanelKind } = useWorkspace();

  if (node.type === 'panel') {
    const Component = panels[node.kind].component;
    const active = node.id === activePanelId;
    const btn = 'px-1.5 text-muted hover:text-accent';
    return (
      <div
        onMouseDown={() => focusPanel(node.id)}
        className={`flex h-full w-full flex-col overflow-hidden rounded-md border ${active ? 'border-accent/50' : 'border-border'}`}
      >
        <div className="flex h-7 shrink-0 items-center gap-1 border-b border-border bg-surface px-2 text-xs">
          <select
            value={node.kind}
            onChange={(e) => setPanelKind(node.id, e.target.value as PanelKind)}
            className="cursor-pointer bg-transparent text-text outline-none"
          >
            {Object.entries(panels).map(([kind, p]) => (
              <option key={kind} value={kind} className="bg-surface">
                {p.label}
              </option>
            ))}
          </select>
          <span className="flex-1" />
          <button className={btn} title="Split right (Ctrl+Shift+D)" onClick={() => splitPanel(node.id, 'horizontal', node.kind)}>
            ◫
          </button>
          <button className={btn} title="Split down (Ctrl+Shift+E)" onClick={() => splitPanel(node.id, 'vertical', node.kind)}>
            ⬓
          </button>
          <button className={btn} title="Close panel (Ctrl+Shift+W)" onClick={() => closePanel(node.id)}>
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <Component panelId={node.id} />
        </div>
      </div>
    );
  }

  const separator = node.direction === 'horizontal' ? 'w-1' : 'h-1';
  return (
    <Group orientation={node.direction} className="h-full w-full">
      {node.children.map((child, i) => (
        <Fragment key={child.id}>
          {i > 0 && <Separator className={`${separator} transition-colors hover:bg-accent/40`} />}
          <Panel minSize={80}>
            <LayoutView node={child} activePanelId={activePanelId} />
          </Panel>
        </Fragment>
      ))}
    </Group>
  );
}
