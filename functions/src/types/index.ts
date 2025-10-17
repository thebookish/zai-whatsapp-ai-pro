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
  embedding?: number[]; // stored by seeder
  createdAt?: string;
};
