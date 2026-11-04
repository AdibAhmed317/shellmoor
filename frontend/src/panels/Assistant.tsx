import { Fragment, useEffect, useRef, useState } from 'react';
import { ArrowUp, Copy, GitBranch, Play, ServerCrash, Sparkles, SquareTerminal, TriangleAlert, Wand } from 'lucide-react';
import { useSettings } from '../store/settings';
import { openSettings } from '../store/ui';
import { useWorkspace } from '../store/workspace';
import { confirm, toast } from '../store/overlays';
import { copyText } from '../backend';
import { terminals } from '../components/Terminal';
import { Badge, Button, EmptyState, IconButton, Toolbar, cx } from '../ui';

// TODO(backend): send prompts (plus the context the user allowed in Settings › AI) to the configured
// provider from Go, stream tokens back as events. The replies below are canned demo answers.
type Message = { id: number; role: 'user' | 'assistant'; text: string };

const replies: [RegExp, string][] = [
  [/error|explain|fail/i, "The last run of `go test ./...` failed in **TestRefund**: the handler returned 500 instead of 200.\n\nThe payments service reads `REFUND_API_URL`, which isn't set in your test environment, so the HTTP client errors before the refund is recorded. Set it for the test run:\n\n```\nREFUND_API_URL=http://localhost:9090 go test ./internal/payments -run TestRefund -v\n```\n\nOr mock the client in `refund_test.go` so the test doesn't need the service."],
  [/diff|summar|commit/i, "**3 files changed**, 11 insertions, 4 deletions.\n\n- `src/App.tsx`: adds a mount effect that logs on startup. Looks like leftover debugging; consider removing before committing.\n- `src/store/workspace.ts`: persists tabs and regenerates ids on restore.\n- `old/legacy.ts`: deleted.\n\nSuggested message:\n\n```\ngit commit -m \"Persist workspace layout across launches\"\n```"],
  [/slow|prod-db|cpu|disk|memory/i, "**prod-db** is running hot: CPU around 60–70% and the disk is **81% full** (812 of 1000 GB). Autovacuum is the second-busiest process, which usually means a large table is bloated.\n\nCheck which tables take the space:\n\n```\npsql -U postgres -c \"select relname, pg_size_pretty(pg_total_relation_size(relid)) from pg_stat_user_tables order by pg_total_relation_size(relid) desc limit 10\"\n```\n\nAnd find what's filling the disk outside the database:\n\n```\nsudo du -xh / --max-depth=2 | sort -rh | head -20\n```"],
  [/.*/, 'Here’s a command for that:\n\n```\nfind . -type f -size +100M -exec ls -lh {} + | sort -k5 -rh | head -20\n```\n\nIt lists the 20 largest files over 100 MB below the current folder, biggest first.'],
];

const suggestions = [
  { icon: TriangleAlert, label: 'Explain the last error' },
  { icon: Wand, label: 'Generate a command to find large files' },
  { icon: GitBranch, label: 'Summarise my git diff' },
  { icon: ServerCrash, label: 'Why is prod-db slow?' },
];

// Inserts into a terminal in the current tab without pressing Enter, after explicit confirmation.
async function runCommand(command: string) {
  const ok = await confirm({ title: 'Run this command?', message: command, confirmLabel: 'Insert into Terminal' });
  if (!ok) return;
  const ws = useWorkspace.getState();
  const tab = ws.tabs.find((t) => t.id === ws.activeTabId)!;
  const ids = [tab.activePanelId, ...terminals.keys()];
  const target = ids.map((id) => terminals.get(id)).find(Boolean);
  if (target) {
    target.write(command);
    toast('Inserted into terminal', { description: 'Review it, then press Enter to run.' });
  } else {
    copyText(command);
    toast('Copied to clipboard', { description: 'Open a terminal to run it.' });
  }
}

// Minimal rendering: **bold**, `code`, and fenced code blocks with Copy / Run.
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/```\n?([\s\S]*?)```/).map((part, i) =>
        i % 2 ? (
          <div key={i} className="group my-2 overflow-hidden rounded-lg border border-border bg-bg">
            <pre className="overflow-x-auto px-3 py-2 font-mono text-xs leading-5 text-text">{part.trim()}</pre>
            <div className="flex gap-1 border-t border-border px-1.5 py-1">
              <Button variant="ghost" icon={Play} className="!h-6" onClick={() => runCommand(part.trim())}>Run</Button>
              <Button variant="ghost" icon={Copy} className="!h-6" onClick={() => (copyText(part.trim()), toast('Copied'))}>Copy</Button>
            </div>
          </div>
        ) : (
          <Fragment key={i}>
            {part.replace(/^\n+|\n+$/g, '').split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((s, j) =>
              s.startsWith('**') ? <strong key={j} className="font-semibold">{s.slice(2, -2)}</strong>
              : s.startsWith('`') ? <code key={j} className="rounded bg-text/10 px-1 font-mono text-[12px]">{s.slice(1, -1)}</code>
              : <span key={j} className="whitespace-pre-wrap">{s}</span>,
            )}
          </Fragment>
        ),
      )}
    </>
  );
}

let nextId = 1;

export default function Assistant() {
  const { aiEnabled, aiProvider, aiModel, aiKeyConfigured, aiShareTerminal, aiShareFiles } = useSettings();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Braces matter: scrollTo returns a Promise in current Chromium, and an effect must not return one.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, thinking]);

  if (!aiEnabled) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <EmptyState icon={Sparkles} title="AI Assistant is off" body="Optional: connect your own provider to explain errors, generate commands and summarise changes. Shellmoor works fully without it." />
        <Button variant="primary" onClick={() => openSettings('ai')}>Set Up AI…</Button>
      </div>
    );
  }

  const needsKey = aiProvider !== 'ollama' && !aiKeyConfigured;

  const send = (text: string) => {
    if (!text.trim() || thinking) return;
    setMessages((m) => [...m, { id: nextId++, role: 'user', text: text.trim() }]);
    setInput('');
    setThinking(true);
    setTimeout(() => {
      const reply = replies.find(([re]) => re.test(text))![1];
      setMessages((m) => [...m, { id: nextId++, role: 'assistant', text: reply }]);
      setThinking(false);
    }, 900);
  };

  return (
    <div className="flex h-full flex-col">
      <Toolbar>
        <Sparkles size={14} className="text-accent" />
        <span className="font-medium">Assistant</span>
        <span className="truncate font-mono text-[11px] text-muted">{aiModel}</span>
        <span className="flex-1" />
        {messages.length > 0 && <Button variant="ghost" onClick={() => setMessages([])}>New Chat</Button>}
      </Toolbar>

      {needsKey && (
        <div className="flex items-center gap-2 border-b border-border bg-warning/10 px-3 py-1.5 text-xs text-warning">
          <TriangleAlert size={13} />
          <span className="flex-1">No API key yet. Showing demo answers.</span>
          <button className="font-semibold hover:underline" onClick={() => openSettings('ai')}>Add Key</button>
        </div>
      )}

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center pt-8 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
              <Sparkles size={24} />
            </div>
            <div className="text-[15px] font-semibold">How can I help?</div>
            <p className="mt-1 text-muted">Ask about errors, commands, your code or your servers.</p>
            <div className="mt-5 grid w-full grid-cols-1 gap-2 @lg:grid-cols-2">
              {suggestions.map((s) => (
                <button key={s.label} onClick={() => send(s.label)} className="flex items-center gap-2.5 rounded-xl border border-border px-3 py-2.5 text-left hover:bg-text/5">
                  <s.icon size={15} className="shrink-0 text-accent" />
                  <span className="text-xs">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.map((m) => (
              <div key={m.id} className={cx('flex', m.role === 'user' && 'justify-end')}>
                <div className={cx('max-w-[85%] leading-relaxed', m.role === 'user' ? 'rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-bg' : 'text-text')}>
                  {m.role === 'user' ? m.text : <Rich text={m.text} />}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex items-center gap-1.5 text-muted">
                {[0, 150, 300].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${d}ms` }} />)}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 px-4 pb-3">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-text/4 p-1.5 pl-3.5 focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/20">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) (e.preventDefault(), send(input));
              }}
              placeholder="Ask anything…"
              className="max-h-32 min-h-7 flex-1 resize-none bg-transparent py-1 text-text outline-none placeholder:text-muted/70"
            />
            <IconButton icon={ArrowUp} label="Send (Enter)" disabled={!input.trim() || thinking} className="!rounded-full !bg-accent !text-bg disabled:!bg-text/15" onClick={() => send(input)} />
          </div>
          <div className="mt-1.5 flex items-center gap-2 px-1 text-[11px] text-muted">
            <span>Shares:</span>
            <Badge tone={aiShareTerminal ? 'accent' : 'neutral'}><SquareTerminal size={10} className="mr-1" />terminal {aiShareTerminal ? 'on' : 'off'}</Badge>
            <Badge tone={aiShareFiles ? 'accent' : 'neutral'}>files {aiShareFiles ? 'on' : 'off'}</Badge>
            <span className="flex-1" />
            <span>Commands always ask before running</span>
          </div>
        </div>
      </div>
    </div>
  );
}
