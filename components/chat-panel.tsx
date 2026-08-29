"use client";

import dynamic from "next/dynamic";

/**
 * Mount the SDK in the browser only.
 *
 * `@truefoundry/trueforge-ui` is client-only. A "use client" component is still
 * server-rendered by Next, and the SDK cannot survive that: it resolves the theme from
 * localStorage (so SSR emits light and the client hydrates dark) and initialises its
 * store during the render, which ends in "Maximum update depth exceeded / the result of
 * getSnapshot should be cached". `ssr: false` skips the server pass entirely.
 */
const ChatPanelImpl = dynamic(() => import("./chat-panel-impl"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading chat…
    </div>
  ),
});

export function ChatPanel({
  agentName,
  variant,
}: {
  agentName: string;
  variant?: "split" | "full";
}) {
  return <ChatPanelImpl agentName={agentName} variant={variant} />;
}
