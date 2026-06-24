export type CartItem = { 
  id: number; 
  title: string; 
  price: string; 
  qty: number; 
  img: string; 
  customizations?: string; 
  addons?: { id: string; title: string; price: number; type: string; drinkId?: string; qty?: number }[];
  basePrice?: number;
  specialInstructions?: string;
};

export type MenuItem = { 
  id?: string; 
  category?: string; 
  categories?: string[];
  title: string; 
  price: string; 
  desc: string; 
  img: string; 
  icon?: string; 
  ingredients?: string; 
  prepTime?: string; 
  available?: boolean;
  sizes?: { label: string; price: string; protein?: string; carbs?: string; fats?: string }[];
  originalPrice?: string;
  showOptionsOnCard?: boolean;
  allowFriesAndDrink?: boolean;
  allowSauces?: boolean;
  sauces?: string[];
  comboItems?: string[];
};

export type MenuCategory = { id: string; name: string; order: number };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
