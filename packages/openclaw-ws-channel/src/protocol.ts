// WebSocket wire protocol between client apps and the embedded WS server

export type InboundWsFrame = {
  type: "message";
  sessionId: string;
  text: string;
};

export type OutboundWsFrame =
  | { type: "reply"; sessionId: string; text: string }
  | { type: "error"; message: string };

// Used by inbound.ts — generated from an InboundWsFrame on arrival
export type InboundQueueMessage = {
  messageId: string;
  sessionId: string;
  text: string;
};
