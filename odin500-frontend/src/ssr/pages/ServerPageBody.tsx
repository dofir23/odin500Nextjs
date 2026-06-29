import { renderServerPageBody } from './renderServerPageBody';
import { resolveServerPageHeading } from './resolveServerPageHeading';

type ServerPageBodyProps = {
  pathname: string;
  data?: unknown;
};

/**
 * Full server-rendered page body — heading, description, tables, and SVG charts in HTML.
 */
export function ServerPageBody({ pathname, data = null }: ServerPageBodyProps) {
  const { title, description } = resolveServerPageHeading(pathname);
  const body = renderServerPageBody(pathname, data);

  return (
    <article className="ssr-page-content" data-ssr-primary>
      <header className="ssr-page-content__header px-4 pt-6 pb-2">
        <h1 className="text-xl font-bold leading-tight md:text-2xl">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">{description}</p>
        ) : null}
      </header>
      {body ? (
        <div className="ssr-page-content__inner space-y-6 overflow-x-auto px-4 pb-6">{body}</div>
      ) : null}
    </article>
  );
}
