export interface ChatCitation {
  type: "country" | "crisis";
  iso3: string;
  crisisId?: string;
  label: string;
}

export interface ChatResponse {
  message: string;
  focusIso3?: string;
  citations: ChatCitation[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: ChatCitation[];
  focusIso3?: string;
}
