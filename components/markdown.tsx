import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * The one place prose is rendered.
 *
 * A build's `summary` is markdown because prose is genuinely the content there — the
 * rationale for a diff and the caveats around it do not survive being flattened into
 * columns. Everything else in this app is structured and rendered by components.
 *
 * Styled explicitly rather than through a typography plugin: the surrounding pages set
 * their own rhythm, and a generic prose stylesheet fought it — headings twice the size
 * of the section labels beside them, and its own idea of what a link looks like.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="min-w-0 text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h3 className="mt-6 mb-2 font-heading text-base font-semibold first:mt-0">
              {children}
            </h3>
          ),
          h2: ({ children }) => (
            <h3 className="mt-6 mb-2 font-heading text-base font-semibold first:mt-0">
              {children}
            </h3>
          ),
          h3: ({ children }) => (
            <h4 className="mt-5 mb-1.5 text-sm font-semibold first:mt-0">{children}</h4>
          ),
          p: ({ children }) => <p className="my-2.5 text-muted-foreground">{children}</p>,
          ul: ({ children }) => (
            <ul className="my-2.5 list-disc space-y-1 pl-5 text-muted-foreground">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2.5 list-decimal space-y-1 pl-5 text-muted-foreground">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-0.5">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2 hover:no-underline"
            >
              {children}
            </a>
          ),
          code: ({ children, className }) =>
            // A fenced block arrives with a language class; an inline span does not.
            className ? (
              <code className={className}>{children}</code>
            ) : (
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.8125rem] text-foreground">
                {children}
              </code>
            ),
          pre: ({ children }) => (
            // Its own scroll container: a long command must not widen the page.
            <pre className="my-3 overflow-x-auto rounded-xl border bg-muted/50 p-3 font-mono text-xs leading-relaxed">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-primary pl-4 text-muted-foreground">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b px-2 py-1.5 text-xs font-semibold">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border-b px-2 py-1.5 text-muted-foreground">{children}</td>
          ),
          hr: () => <hr className="my-5" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
