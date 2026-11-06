import Markdown from "react-markdown";
import { safeNoteLink } from "./safe-note-link";

/** react-markdown passes its syntax tree node, which must not reach the DOM. */
function domProps<Props extends { node?: unknown }>(props: Props) {
  const { node, ...rest } = props;
  void node;
  return rest;
}

/**
 * Raw HTML is never rendered and links keep only http and https addresses.
 * Images are left out so a note can't load tracking pixels from other sites.
 */
export function NoteMarkdown({ content }: { content: string }) {
  return (
    <div className="flex flex-col gap-2 text-sm wrap-anywhere [&_:not(pre)>code]:rounded-sm [&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:font-mono">
      <Markdown
        disallowedElements={["img"]}
        unwrapDisallowed
        urlTransform={safeNoteLink}
        components={{
          h1: (props) => (
            <h3 {...domProps(props)} className="text-lg font-semibold" />
          ),
          h2: (props) => (
            <h3 {...domProps(props)} className="text-lg font-semibold" />
          ),
          h3: (props) => <h4 {...domProps(props)} className="font-semibold" />,
          ul: (props) => <ul {...domProps(props)} className="list-disc pl-5" />,
          ol: (props) => (
            <ol {...domProps(props)} className="list-decimal pl-5" />
          ),
          a: (props) => (
            <a
              {...domProps(props)}
              className="underline underline-offset-4"
              target="_blank"
              rel="noopener noreferrer"
            />
          ),
          pre: (props) => (
            <pre
              {...domProps(props)}
              className="overflow-x-auto rounded-md bg-code p-3 font-mono text-xs text-code-foreground"
            />
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}
