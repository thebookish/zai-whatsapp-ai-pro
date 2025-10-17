export type ProUser = {
  id: string;
  email?: string;
  whatsappPhoneNumber?: string;
  proSubscriptionStatus: string;
};

export type InboundWhatsApp = {
  From?: string;
  To?: string;
  Body?: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
};

export type MatchReport = {
  id: string;
  title: string;
  text: string;
  url?: string;
  teamId?: string;
  embedding?: number[];
  createdAt?: string;
};

export type Player = {
  id: string;
  name: string;
  position: string;
  teamId: string;
  strengths: string;
  stats?: Record<string, number>;
  embedding?: number[];
  createdAt?: string;
};

export type Team = {
  id: string;
  name: string;
  division: string;
  formation: string;
  style: string;
  keyPlayers?: string[];
  embedding?: number[];
  createdAt?: string;
};

export type Coach = {
  id: string;
  name: string;
  teamId: string;
  experience: string;
  philosophy: string;
  embedding?: number[];
  createdAt?: string;
};
