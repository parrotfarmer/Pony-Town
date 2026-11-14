import { PonyNode, WebConnection, CustomStatus, EditableHeaders } from '../types/pony';

export const INITIAL_PONIES: PonyNode[] = [];
export const INITIAL_CONNECTIONS: WebConnection[] = [];

export const DEFAULT_STATUSES: CustomStatus[] = [
  { 
    id: 'active', 
    name: 'Active', 
    multiplier: 1.0, 
    color: '#10b981', 
    price: 0, 
    badgeIcon: '✨',
    badgeTitle: 'Active Harmony',
    specialPageContent: 'Welcome to the Active Harmony tier! Ponies with this tier operate at steady baseline resonance, gathering daily love flows and connecting harmoniously within the network.'
  },
  { 
    id: 'resting', 
    name: 'Resting', 
    multiplier: 0.35, 
    color: '#94a3b8', 
    price: 0, 
    badgeIcon: '🌙',
    badgeTitle: 'Gentle Slumber',
    specialPageContent: 'Resting tier allows a pony to recharge their magical aura at reduced capacity while conserving love reserves for future friendship surges.'
  },
  { 
    id: 'overdrive', 
    name: 'Overdrive', 
    multiplier: 1.6, 
    color: '#ef4444', 
    price: 250, 
    badgeIcon: '⚡',
    badgeTitle: 'Electric Overdrive',
    specialPageContent: 'The Overdrive tier unlocks elevated love frequencies! Ponies holding this tier channel 1.6x multiplier love flows to their network and shine with electric vitality.'
  },
  { 
    id: 'transcendent', 
    name: 'Transcendent', 
    multiplier: 2.2, 
    color: '#f59e0b', 
    price: 500, 
    badgeIcon: '👑',
    badgeTitle: 'Crown of Transcendence',
    specialPageContent: 'The pinnacle of magical resonance. Holders of the Transcendent Crown channel extraordinary 2.2x love multipliers, presiding over the matrix with radiant benevolence.'
  },
];

export const DEFAULT_HEADERS: EditableHeaders = {
  appTitle: 'Pony Love Harvest & Network Matrix',
  appSubtitle: 'Interactive Love Web • Live Harvest Analytics & Recipient Flows',
  webTitle: 'Pony Network Web',
  analyticsTitle: '',
  matrixTitle: '',
  flowsTitle: '',
  colName: 'Pony Name & Icon',
  colSpeciesElement: 'Species & Element',
  colLoveDay: 'Love / Day',
  colStatus: 'Status / Multiplier',
  colStartDate: 'Set Start Date',
  colDays: 'Days Giving Love',
  colTotal: 'Total Harvested',
  colRecipient: 'Love Flowing To',
  colActions: 'Actions',
  cardInflow: 'LOVE RATE',
  cardHarvested: 'CURRENT LOVE',
  cardOverall: 'TOTAL OVER ALL',
  cardMagicalPower: 'Total Magical Power',
  cardConversion: 'Conversion Matrix',
  destinationScopeLabel: 'Love Destination Scope:',
};
