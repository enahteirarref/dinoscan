
export interface Fossil {
  id: string;
  name: string;
  era: string;
  classification: string;
  length: string;
  rarity: 'Common' | 'Rare' | 'Legendary';
  matchConfidence: number;
  description: string;
  note: string;
  imageUrl: string;
  timestamp: string;
  location?: {
    lat: number;
    lng: number;
  };
}

export interface Fact {
  id: string;
  title: string;
  content: string;
  icon: string;
  color: string;
}
