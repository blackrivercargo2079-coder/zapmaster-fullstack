
export enum ContactStatus {
  VALID = 'VALID',
  INVALID = 'INVALID',
  UNKNOWN = 'UNKNOWN',
  BLOCKED = 'BLOCKED'
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  tags: string[];
  status: ContactStatus;
  lastInteraction?: Date;
}

export interface Account {
  id: string;
  name: string;
  instanceName?: string; 
  phoneNumber: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'SCANNING';
  connectionType?: 'QR_CODE' | 'API';
  
  // Z-API Specifics
  zApiUrl?: string; // A URL completa com token
  zApiClientToken?: string; // Token de segurança extra (Client-Token)
  zApiId?: string;
  zApiToken?: string;

  battery?: number;
  avatarUrl?: string;
  updatedAt?: Date;
}

export interface SystemSettings {
  apiUrl: string;
  apiToken: string;
  webhookUrl?: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'COMPLETED';
  sent: number;
  total: number;
  banners: string[]; // Base64 or URLs
  message: string;
  ctaText?: string;
  ctaLink?: string;
  unsubscribeEnabled: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent' | 'system';
  text: string;
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  contactId: string;
  contactName: string;
  lastMessage: string;
  unreadCount: number;
  messages: ChatMessage[];
}
