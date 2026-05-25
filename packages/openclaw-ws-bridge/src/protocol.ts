// WS frame types (external app ↔ bridge)
export type WsMessageFrame = { type: "message"; sessionId: string; text: string };
export type WsCloseFrame = { type: "close"; sessionId: string };
export type WsInboundFrame = WsMessageFrame | WsCloseFrame;

export type WsReplyFrame = { type: "reply"; sessionId: string; text: string };
export type WsErrorFrame = { type: "error"; sessionId: string; message: string };
export type WsOutboundFrame = WsReplyFrame | WsErrorFrame;

// HTTP types (channel plugin ↔ bridge)
export type InboundQueueMessage = {
  messageId: string;
  sessionId: string;
  text: string;
  cursor: number;
};

export type PollResponse = {
  messages: InboundQueueMessage[];
  cursor: number;
};

export type OutboundBody = {
  accountId: string;
  sessionId: string;
  text: string;
  messageId: string;
};

export type ErrorResponse = { error: string };
export type OkResponse = { ok: true };
