export const DEFAULT_PONY_CAPACITY = 1000; // 1,000 Love units per day

export interface BadgeSectionBlock {
  id: string;
  type: 'text' | 'image';
  content: string; // text content or image URL
}

export interface CustomStatus {
  id: string;
  name: string;
  multiplier: number;
  color: string;
  price?: number; // Cost in Love units to purchase status
  badgeIcon?: string; // Optional badge emoji icon
  badgeTitle?: string; // Title for the badge
  specialPageContent?: string; // Deprecated - replaced by rows
  allowMagicAndAccounting?: boolean; // Checkbox permission: Allows user to see magic on graph & see accounting section
  badgeRows?: {
    left: BadgeSectionBlock;
    right: BadgeSectionBlock;
  }[]; // Admin-editable rows of text/images in 2 columns
}

export type ConnectionType = 
  | 'friendship' 
  | 'magical-resonance' 
  | 'love-channel' 
  | 'sisterhood' 
  | 'hive-nexus'
  | 'brotherhood'
  | 'custom';

export interface LoveSplitAllocation {
  recipientId: string; // Target pony id or 'reservoir'
  amount: number; // Love units per day allocated
}

export interface SpeciesOption {
  id: string;
  name: string;
  createdAt?: string;
}

export interface ElementOption {
  id: string;
  name: string;
  createdAt?: string;
}

export interface LocationOption {
  id: string;
  name: string;
  code?: string;
  createdAt?: string;
}

export interface PonyNode {
  id: string;
  name: string;
  species: string;
  element: string;
  location: string;
  color: string;
  accentColor?: string;
  avatarIcon: string;
  notes: string;
  tags?: string[];
  
  // Position in the network web
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  
  // Love Harvesting metrics (Editable)
  loveRatePerDay: number; // Base love units yielded per day (Total Capacity = 1000)
  startDate: string; // YYYY-MM-DD set date
  customDaysOverride?: number | null; // Optional manual override for days active
  resonanceMultiplier?: number;
  status: string; // References CustomStatus id or name
  
  // 4 Main Love Ledger Values
  totalOverallLove?: number; // Total overall love harvested + received + gifted
  currentLoveTotal?: number; // Current spendable love total balance
  totalLoveSpent?: number;   // Total love spent (purchases, gifts sent)
  totalLoveGiven?: number;   // Total love given to other ponies as gifts

  // Purchased Status Badges
  purchasedBadges?: string[]; // Badges unlocked by purchasing statuses
  acceptedBadges?: string[];  // Badges user has clicked 'Accept' on the special page

  // Allocations
  loveSplits?: LoveSplitAllocation[];
  isCustomSplits?: boolean; // Set to true when user manually adjusts splits
  targetRecipientId?: string | null;

  // Custom key-value pairs stored at this node
  customData?: Record<string, string>;

  // Admin privileges & Reservoir interactions
  isAdmin?: boolean;
  isOriginalAdmin?: boolean;
  ownerId?: string; // UID of the user who owns/connected this pony
  isMainPony?: boolean; // Set to true if this is the user's designated main pony
  payoutPercentage?: number; // % of general reservoir income
  treatsReceived?: number;   // total love units received from reservoir treats

  // Secret fields & viewer permissions
  secretSpecies?: string;
  secretElement?: string;
  secretLocation?: string;
  secretFavoriteTreat?: string;
  secretHobby?: string;
  secretPersonality?: string;
  secretMagicalAffinity?: string;
  secretFriendshipLevel?: string;
  secretCutieMark?: string;
  secretBackstory?: string;
  secretNotes?: string;
  allowedViewerPonyIds?: string[];

  // Extended Profile
  favoriteTreat?: string;
  hobby?: string;
  personality?: string;
  backstory?: string;
  magicalAffinity?: string;
  friendshipLevel?: string;
  cutieMark?: string; // Emoji or image URL
  cutieMarkMeaning?: string;
  residence?: string;
  
  // Custom Profile Theme (Unlocked via Store)
  profileTextColor?: string;
  profileBorderColor?: string;
  profileBgImage?: string;

  // Profile update rate-limiting & Firestore accrual tracking
  lastProfileUpdateAt?: string;
  lastAccruedDate?: string;
  updatedAt?: string;
}

export interface WebConnection {
  id: string;
  source: string; // pony id
  target: string; // pony id
  connectionType: ConnectionType;
  strength: number; // 1 to 5
  notes?: string;
  startDate?: string; // Specific start date for this individual relationship (YYYY-MM-DD)
  customDaysOverride?: number | null;
}

export interface PonyLoveFlowStats {
  pony: PonyNode;
  dailyProduced: number;
  totalProduced: number;
  dailyReceived: number;
  totalReceived: number;
  allocatedDaily: number;
  unallocatedDaily: number;
  donors: {
    donor: PonyNode;
    daily: number;
    total: number;
  }[];
  splits: {
    recipient: PonyNode | null;
    recipientId: string;
    amount: number;
  }[];
}

export interface InBetweenFlow {
  fromPony: PonyNode;
  toPony: PonyNode;
  dailyRate: number;
  totalHarvested: number;
  relationshipStartDate?: string;
  relationshipDays?: number;
}

export interface NetworkMetrics {
  totalPonies: number;
  totalConnections: number;
  totalLovePerDay: number;
  totalSpendableLove: number;
  totalOverallLove: number;
  totalMagicalPower: number; // in Mega-Thaums (MT)
  networkResonanceBonus: number;
  averageYieldPerPony: number;
  highestYieldPony: { name: string; rate: number } | null;
  topRecipientPony: { name: string; icon: string; receivedDaily: number; totalReceived: number } | null;
}

export interface HarvestTimePoint {
  date: string;
  timestamp: number;
  dailyLove: number;
  cumulativeLove: number;
  magicalPower: number;
}

export interface EditableHeaders {
  appTitle: string;
  appSubtitle: string;
  webTitle: string;
  analyticsTitle: string;
  matrixTitle: string;
  flowsTitle: string;
  colName: string;
  colSpeciesElement: string;
  colLoveDay: string;
  colStatus: string;
  colStartDate: string;
  colDays: string;
  colTotal: string;
  colRecipient: string;
  colActions: string;
  cardInflow: string;
  cardHarvested: string;
  cardOverall: string;
  cardMagicalPower: string;
  cardConversion: string;
  destinationScopeLabel?: string;
}

export type DestinationFilterScope = 'all' | 'general' | 'transfers' | string;
