import Link from "next/link";
import { Fragment } from "react";

const TOKEN = /((?:^|(?<=[^\p{L}\p{N}_&@#]))[#@][\p{L}\p{N}_]{2,50})/gu;

/** Renders user text with #hashtags and @mentions linked. Text is rendered as React nodes, never as HTML. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(TOKEN);
  return (
    <p className={className} style={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
      {parts.map((part, i) => {
        if (/^#[\p{L}\p{N}_]{2,50}$/u.test(part)) {
          return (
            <Link key={i} href={`/hashtag/${encodeURIComponent(part.slice(1).toLowerCase())}`} className="font-medium text-accent hover:underline">
              {part}
            </Link>
          );
        }
        if (/^@[a-zA-Z0-9_]{3,20}$/.test(part)) {
          return (
            <Link key={i} href={`/u/${part.slice(1).toLowerCase()}`} className="font-medium text-accent hover:underline">
              {part}
            </Link>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </p>
  );
}
