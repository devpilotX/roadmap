'use client';

/**
 * MoneyScripts | the eight scripts from Part 17.7, and any version you have made.
 *
 * A version never overwrites the original. Where one exists it is shown first and
 * the Part 17.7 wording is kept underneath it, unchanged, so the two can be read
 * against each other.
 */

import { EmptyState, Section } from '@/components/ui/Basics';
import { useToast } from '@/components/ToastProvider';
import type { ScriptDef, ScriptsPayload, ScriptVersion } from './types';

function ScriptCard({ script, versions }: { script: ScriptDef; versions: ScriptVersion[] }) {
  const { toast, toastError } = useToast();
  const mine = versions
    .filter((v) => v.script_code === script.code)
    .sort((a, b) => b.version - a.version);
  const latest = mine[0] ?? null;
  const body = latest ? latest.body : script.body;

  return (
    <details className="scriptcard">
      <summary className="scriptcard__head">
        <span className="offercard__code">{script.code}</span>
        <strong className="grow">{latest ? latest.title : script.title}</strong>
        <span className="badge badge--outline">{script.channel}</span>
        {latest ? (
          <span className="badge badge--blue">{`Your version ${latest.version}`}</span>
        ) : (
          <span className="badge badge--outline">The original</span>
        )}
      </summary>
      <div className="scriptcard__body stack-sm">
        <pre className="scriptbody">{body}</pre>
        <div className="row">
          <button
            type="button"
            className="btn btn--sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(body);
                toast(`${script.code} copied.`, 'ok');
              } catch {
                toastError(
                  'This browser would not let the page write to the clipboard. Select the text and copy it by hand.'
                );
              }
            }}
          >
            Copy
          </button>
        </div>
        {latest ? (
          <details className="acc">
            <summary className="acc__summary">
              The original from Part 17.7, kept unchanged
            </summary>
            <div className="acc__body">
              <pre className="scriptbody">{script.body}</pre>
            </div>
          </details>
        ) : null}
      </div>
    </details>
  );
}

export function MoneyScripts({ scripts }: { scripts: ScriptsPayload }) {
  const list = scripts.scripts ?? [];
  const versions = scripts.versions ?? [];
  const subs = Object.entries(scripts.substitutions ?? {});

  return (
    <Section
      title="The eight scripts"
      lede="Read them out loud once before the first message of the hour."
    >
      {list.length ? (
        <div>
          {list.map((s) => (
            <ScriptCard key={s.code} script={s} versions={versions} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No scripts"
          body="The eight scripts come from Part 17.7 of final.md. Run npm run setup."
        />
      )}

      {subs.length ? (
        <div className="card">
          <p className="card__label">What to replace before you send it</p>
          <ul className="measure">
            {subs.map(([token, meaning]) => (
              <li key={token}>{`${token} is ${meaning}`}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {scripts.note ? <p className="text-sm muted measure">{scripts.note}</p> : null}
    </Section>
  );
}

export default MoneyScripts;
