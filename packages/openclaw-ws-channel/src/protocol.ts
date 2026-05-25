// HTTP types matching the bridge server's API contract
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
