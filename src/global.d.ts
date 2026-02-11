import type * as StreamerbotClientModule from "@streamerbot/client";

type StreamerbotClientConstructor =
  typeof StreamerbotClientModule.StreamerbotClient;

declare global {
  interface Window {
    StreamerbotClient: StreamerbotClientConstructor;
  }

  const StreamerbotClient: StreamerbotClientConstructor;
}

export {};
