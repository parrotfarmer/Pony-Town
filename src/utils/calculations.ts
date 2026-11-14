import { 
  PonyNode, 
  WebConnection, 
  NetworkMetrics, 
  HarvestTimePoint, 
  CustomStatus,
  PonyLoveFlowStats,
  InBetweenFlow,
  LoveSplitAllocation,
  DestinationFilterScope,
  DEFAULT_PONY_CAPACITY
} from '../types/pony';

// Small bounded caches for high-frequency local computations
const utcDateMsCache = new Map<string, number>();
function getUtcMidnightMs(dateStr: string): number {
  const key = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  let cached = utcDateMsCache.get(key);
  if (cached !== undefined) return cached;
  cached = new Date(key + 'T00:00:00Z').getTime();
  if (utcDateMsCache.size > 500) {
    utcDateMsCache.clear();
  }
  utcDateMsCache.set(key, cached);
  return cached;
}

function makePairKey(a: string, b: string): string {
  return a < b ? `${a}--${b}` : `${b}--${a}`;
}

function buildConnectionIndex(connections: WebConnection[] = []) {
  const adjMap = new Map<string, Set<string>>();
  const connPairMap = new Map<string, WebConnection>();

  for (let i = 0; i < connections.length; i++) {
    const c = connections[i];
    if (c.source !== c.target) {
      let setA = adjMap.get(c.source);
      if (!setA) {
        setA = new Set<string>();
        adjMap.set(c.source, setA);
      }
      setA.add(c.target);

      let setB = adjMap.get(c.target);
      if (!setB) {
        setB = new Set<string>();
        adjMap.set(c.target, setB);
      }
      setB.add(c.source);
    }
    const key = makePairKey(c.source, c.target);
    if (!connPairMap.has(key)) {
      connPairMap.set(key, c);
    }
  }

  return { adjMap, connPairMap };
}

function memoizeByRef<TArgs extends readonly unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
  maxEntries = 16
): (...args: TArgs) => TResult {
  const cache: { args: TArgs; result: TResult }[] = [];
  return (...args: TArgs): TResult => {
    for (let i = 0; i < cache.length; i++) {
      const entry = cache[i];
      if (entry.args.length === args.length) {
        let match = true;
        for (let j = 0; j < args.length; j++) {
          if (entry.args[j] !== args[j]) {
            match = false;
            break;
          }
        }
        if (match) return entry.result;
      }
    }
    const result = fn(...args);
    cache.unshift({ args, result });
    if (cache.length > maxEntries) cache.pop();
    return result;
  };
}

export function calculateDaysActive(
  startDate: string,
  targetDate: string = new Date().toISOString().split('T')[0],
  customOverride?: number | null
): number {
  if (customOverride !== undefined && customOverride !== null && customOverride >= 0) {
    return customOverride;
  }
  if (!startDate) return 1;

  const start = getUtcMidnightMs(startDate);
  const end = getUtcMidnightMs(targetDate);

  if (isNaN(start) || isNaN(end)) return 1;
  const diffDays = Math.floor((end - start) / 86400000);
  // Count up from creation date to true current date / target date.
  // If target date is same as creation date, displays as 1. Clamps to minimum 1.
  return Math.max(1, diffDays + 1);
}

export function getPonyStatusMultiplier(pony: PonyNode, statuses?: CustomStatus[]): number {
  if (!statuses || !pony.status) return 1.0;
  const lowerStatus = pony.status.toLowerCase();
  for (let i = 0; i < statuses.length; i++) {
    const s = statuses[i];
    if (s.id === pony.status || s.name.toLowerCase() === lowerStatus) {
      return typeof s.multiplier === 'number' && s.multiplier > 0 ? s.multiplier : 1.0;
    }
  }
  return 1.0;
}

export function hasMagicAndAccountingAccess(
  pony?: PonyNode | null,
  statuses?: CustomStatus[],
  isAdmin?: boolean
): boolean {
  if (isAdmin) return true;
  if (!pony || !statuses) return false;
  const purchasedIds = new Set(pony.purchasedBadges || []);
  if (pony.status) purchasedIds.add(pony.status);
  return statuses.some(s => (purchasedIds.has(s.id) || purchasedIds.has(s.name)) && Boolean(s.allowMagicAndAccounting));
}

export function calculatePonyDailyRate(
  pony: PonyNode,
  statuses?: CustomStatus[]
): number {
  const statusMult = getPonyStatusMultiplier(pony, statuses);

  const baseRate = pony.loveRatePerDay !== undefined && pony.loveRatePerDay !== null 
    ? pony.loveRatePerDay 
    : DEFAULT_PONY_CAPACITY;

  const resMult = pony.resonanceMultiplier !== undefined ? pony.resonanceMultiplier : 1.0;
  return Number((baseRate * resMult * statusMult).toFixed(1));
}

export function calculatePonyAccumulatedLove(
  pony: PonyNode,
  targetDate: string = new Date().toISOString().split('T')[0],
  statuses?: CustomStatus[],
  liveTick?: number
): number {
  if (pony.totalOverallLove !== undefined && pony.totalOverallLove !== null) {
    return Math.round(pony.totalOverallLove);
  }
  const days = calculateDaysActive(pony.startDate, targetDate, pony.customDaysOverride);
  const dailyRate = calculatePonyDailyRate(pony, statuses);
  // Add live pulse bonus: each 10s tick harvests (dailyRate / 8640) love units
  const liveBonus = liveTick ? liveTick * (dailyRate / 8640) : 0;
  return Math.round(days * dailyRate + liveBonus);
}

/**
 * Finds all connected neighbor pony IDs for a given pony.
 */
export function getConnectedPonyIds(ponyId: string, connections: WebConnection[]): string[] {
  const neighbors = new Set<string>();
  for (let i = 0; i < connections.length; i++) {
    const c = connections[i];
    if (c.source === ponyId && c.target !== ponyId) neighbors.add(c.target);
    if (c.target === ponyId && c.source !== ponyId) neighbors.add(c.source);
  }
  return Array.from(neighbors);
}

function getNormalizedPonySplitsWithConnectedSet(
  pony: PonyNode,
  dailyCapacity: number,
  connectedSet: Set<string> | null
): LoveSplitAllocation[] {
  const generalFundShare = Math.round(dailyCapacity / 2);
  const allocatablePool = Math.max(0, dailyCapacity - generalFundShare);

  if (pony.loveSplits && pony.loveSplits.length > 0) {
    let currentTotal = 0;
    const validSplits: LoveSplitAllocation[] = [];

    for (let i = 0; i < pony.loveSplits.length; i++) {
      const split = pony.loveSplits[i];
      if (!split.recipientId || split.recipientId === 'reservoir' || split.amount <= 0) continue;
      if (connectedSet && !connectedSet.has(split.recipientId)) continue;
      const allowedAmount = Math.min(split.amount, Math.max(0, allocatablePool - currentTotal));
      if (allowedAmount > 0) {
        validSplits.push({
          recipientId: split.recipientId,
          amount: allowedAmount,
        });
        currentTotal += allowedAmount;
      }
    }
    return validSplits;
  }

  if (pony.targetRecipientId && pony.targetRecipientId !== 'reservoir') {
    return [{
      recipientId: pony.targetRecipientId,
      amount: allocatablePool,
    }];
  }

  return [];
}

/**
 * Gets normalized splits for a pony.
 * Rule:
 * 1. 50% of daily capacity (e.g. 500 of 1,000) automatically flows to the General Fund.
 * 2. The remaining 50% (e.g. 500) is the allocatable pool, divided evenly across connected neighbors!
 *    e.g. For 2 connected ponies, each gets 250 (50% of the 500 allocatable pool).
 * 3. If no connections exist, 100% flows to the General Fund.
 */
export function getNormalizedPonySplits(
  pony: PonyNode,
  statuses?: CustomStatus[],
  connections?: WebConnection[]
): LoveSplitAllocation[] {
  const dailyCapacity = calculatePonyDailyRate(pony, statuses);
  const connectedSet = connections ? new Set(getConnectedPonyIds(pony.id, connections)) : null;
  return getNormalizedPonySplitsWithConnectedSet(pony, dailyCapacity, connectedSet);
}

/**
 * Computes detailed Love Flow and Recipient stats for every pony, supporting multi-split flows.
 * Runs in O(N + E) with pre-indexed lookups and caches identical call inputs.
 */
export const calculateLoveFlowStats = memoizeByRef(function calculateLoveFlowStatsImpl(
  ponies: PonyNode[],
  targetDate: string = new Date().toISOString().split('T')[0],
  statuses?: CustomStatus[],
  connections: WebConnection[] = [],
  livePulseTick?: number
): PonyLoveFlowStats[] {
  const { adjMap, connPairMap } = buildConnectionIndex(connections);
  const ponyMap = new Map<string, PonyNode>();
  const producedMap = new Map<string, { daily: number; total: number; mult: number }>();
  const splitsByPony = new Map<string, LoveSplitAllocation[]>();

  for (let i = 0; i < ponies.length; i++) {
    const p = ponies[i];
    ponyMap.set(p.id, p);
    const mult = getPonyStatusMultiplier(p, statuses);
    const daily = calculatePonyDailyRate(p, statuses);
    const total = calculatePonyAccumulatedLove(p, targetDate, statuses, livePulseTick);
    producedMap.set(p.id, { daily, total, mult });
    const connectedSet = adjMap.get(p.id) || new Set<string>();
    splitsByPony.set(p.id, getNormalizedPonySplitsWithConnectedSet(p, daily, connectedSet));
  }

  // Single O(N + E) pass to aggregate donors per recipient
  const donorsByRecipient = new Map<
    string,
    { donors: { donor: PonyNode; daily: number; total: number }[]; rawDailyReceived: number; rawTotalReceived: number }
  >();

  for (let i = 0; i < ponies.length; i++) {
    const donor = ponies[i];
    const donorSplits = splitsByPony.get(donor.id) || [];
    for (let j = 0; j < donorSplits.length; j++) {
      const split = donorSplits[j];
      if (!split.recipientId || split.recipientId === donor.id || split.amount <= 0) continue;
      const recipientProd = producedMap.get(split.recipientId);
      if (!recipientProd) continue;

      const conn = connPairMap.get(makePairKey(donor.id, split.recipientId));
      const relStartDate = conn?.startDate || targetDate;
      const relDays = calculateDaysActive(relStartDate, targetDate, conn?.customDaysOverride);
      const totalSentToMe = Math.round(split.amount * relDays);

      let entry = donorsByRecipient.get(split.recipientId);
      if (!entry) {
        entry = { donors: [], rawDailyReceived: 0, rawTotalReceived: 0 };
        donorsByRecipient.set(split.recipientId, entry);
      }

      entry.donors.push({
        donor,
        daily: Math.round(split.amount * recipientProd.mult),
        total: totalSentToMe,
      });
      entry.rawDailyReceived += split.amount;
      entry.rawTotalReceived += totalSentToMe;
    }
  }

  return ponies.map(pony => {
    const prod = producedMap.get(pony.id) || { daily: 0, total: 0, mult: 1.0 };
    const mySplits = splitsByPony.get(pony.id) || [];
    let allocatedDaily = 0;
    const splitDetails = mySplits.map(s => {
      allocatedDaily += s.amount;
      return {
        recipient: ponyMap.get(s.recipientId) || null,
        recipientId: s.recipientId,
        amount: s.amount,
      };
    });
    const unallocatedDaily = Math.max(0, prod.daily - allocatedDaily);
    const incoming = donorsByRecipient.get(pony.id);

    return {
      pony,
      dailyProduced: prod.daily,
      totalProduced: prod.total,
      dailyReceived: incoming ? Math.round(incoming.rawDailyReceived * prod.mult) : 0,
      totalReceived: incoming ? Math.round(incoming.rawTotalReceived * prod.mult) : 0,
      allocatedDaily,
      unallocatedDaily,
      donors: incoming ? incoming.donors : [],
      splits: splitDetails,
    };
  });
});

/**
 * Returns all active in-between flows from Pony A to Pony B across all splits.
 */
export const getInBetweenFlows = memoizeByRef(function getInBetweenFlowsImpl(
  ponies: PonyNode[],
  targetDate: string = new Date().toISOString().split('T')[0],
  statuses?: CustomStatus[],
  connections: WebConnection[] = []
): InBetweenFlow[] {
  const { adjMap, connPairMap } = buildConnectionIndex(connections);
  const ponyMap = new Map(ponies.map(p => [p.id, p]));
  const flows: InBetweenFlow[] = [];

  for (let i = 0; i < ponies.length; i++) {
    const fromPony = ponies[i];
    const daily = calculatePonyDailyRate(fromPony, statuses);
    const connectedSet = adjMap.get(fromPony.id) || new Set<string>();
    const splits = getNormalizedPonySplitsWithConnectedSet(fromPony, daily, connectedSet);

    for (let j = 0; j < splits.length; j++) {
      const split = splits[j];
      if (!split.recipientId || split.recipientId === 'reservoir' || split.amount <= 0) continue;
      const toPony = ponyMap.get(split.recipientId);
      if (toPony) {
        const conn = connPairMap.get(makePairKey(fromPony.id, toPony.id));
        const relStartDate = conn?.startDate || targetDate;
        const relDays = calculateDaysActive(relStartDate, targetDate, conn?.customDaysOverride);
        const totalSent = Math.round(split.amount * relDays);
        const recipientMult = getPonyStatusMultiplier(toPony, statuses);

        flows.push({
          fromPony,
          toPony,
          dailyRate: Math.round(split.amount * recipientMult),
          totalHarvested: Math.round(totalSent * recipientMult),
          relationshipStartDate: relStartDate,
          relationshipDays: relDays,
        });
      }
    }
  }

  return flows;
});

/**
 * Calculates metrics scoped by destination.
 */
export const calculateScopedMetrics = memoizeByRef(function calculateScopedMetricsImpl(
  ponies: PonyNode[],
  connections: WebConnection[],
  _loveToPowerRatio: number = 1.0,
  targetDate: string = new Date().toISOString().split('T')[0],
  statuses?: CustomStatus[],
  scope: DestinationFilterScope = 'all',
  liveTick?: number,
  archivedLove: number = 0,
  reservoirDeductions: number = 0
): {
  inflowDaily: number;
  totalSpendable: number;
  totalOverall: number;
  magicalPower: number;
  scopeLabel: string;
} {
  if (scope === 'all') {
    let inflowDaily = 0;
    let totalSpendable = 0;
    let totalOverall = archivedLove;
    for (let i = 0; i < ponies.length; i++) {
      const p = ponies[i];
      inflowDaily += calculatePonyDailyRate(p, statuses);
      const overall = p.totalOverallLove || calculatePonyAccumulatedLove(p, targetDate, statuses, liveTick);
      totalOverall += overall;
      totalSpendable += (p.currentLoveTotal !== undefined ? p.currentLoveTotal : (overall - (p.totalLoveSpent || 0)));
    }
    return {
      inflowDaily: Math.round(inflowDaily),
      totalSpendable: Math.round(totalSpendable),
      totalOverall: Math.round(totalOverall),
      magicalPower: Math.round(totalOverall), // 1 love = 1 thaum
      scopeLabel: 'Total Network',
    };
  }

  if (scope === 'transfers') {
    const flows = getInBetweenFlows(ponies, targetDate, statuses, connections);
    let inflowDaily = 0;
    let totalHarvested = 0;
    for (let i = 0; i < flows.length; i++) {
      inflowDaily += flows[i].dailyRate;
      totalHarvested += flows[i].totalHarvested;
    }
    return {
      inflowDaily: Math.round(inflowDaily),
      totalSpendable: Math.round(totalHarvested),
      totalOverall: Math.round(totalHarvested),
      magicalPower: Math.round(totalHarvested), // 1 love = 1 thaum
      scopeLabel: 'Pony Network',
    };
  }

  if (scope === 'general') {
    const { adjMap } = buildConnectionIndex(connections);
    let inflowDaily = 0;
    let totalOverall = 0;
    let totalSpendable = 0;
    let storePurchasesInflow = 0;
    let totalPayoutPct = 0;

    for (let i = 0; i < ponies.length; i++) {
      const p = ponies[i];
      const daily = calculatePonyDailyRate(p, statuses);
      const overall = p.totalOverallLove || calculatePonyAccumulatedLove(p, targetDate, statuses, liveTick);
      const splits = getNormalizedPonySplitsWithConnectedSet(p, daily, adjMap.get(p.id) || new Set<string>());
      let allocatedDaily = 0;
      for (let j = 0; j < splits.length; j++) allocatedDaily += splits[j].amount;
      const unallocatedDaily = Math.max(0, daily - allocatedDaily);
      const ratio = daily > 0 ? unallocatedDaily / daily : 1;
      inflowDaily += unallocatedDaily;

      const genShare = Math.round(overall * ratio);
      totalOverall += genShare;
      totalSpendable += genShare;
      storePurchasesInflow += (p.totalLoveSpent || 0);
      totalPayoutPct += (p.payoutPercentage || 0);
    }

    totalOverall += storePurchasesInflow + archivedLove;
    totalSpendable += storePurchasesInflow + archivedLove;

    const payoutFactor = Math.max(0, 1 - (totalPayoutPct / 100));
    const netInflowDaily = inflowDaily * payoutFactor;
    const netTotalOverall = (totalOverall - reservoirDeductions) * payoutFactor;

    return {
      inflowDaily: Math.round(netInflowDaily),
      totalSpendable: Math.round(netTotalOverall),
      totalOverall: Math.round(netTotalOverall),
      magicalPower: Math.round(netTotalOverall),
      scopeLabel: 'General Reservoir',
    };
  }

  const targetPony = ponies.find(p => p.id === scope);
  if (!targetPony) {
    let inflowDaily = 0;
    let totalHarvested = archivedLove;
    for (let i = 0; i < ponies.length; i++) {
      const p = ponies[i];
      inflowDaily += calculatePonyDailyRate(p, statuses);
      totalHarvested += calculatePonyAccumulatedLove(p, targetDate, statuses, liveTick);
    }
    return {
      inflowDaily: Math.round(inflowDaily),
      totalSpendable: Math.round(totalHarvested),
      totalOverall: Math.round(totalHarvested),
      magicalPower: Math.round(totalHarvested),
      scopeLabel: 'Total Network',
    };
  }

  const { adjMap } = buildConnectionIndex(connections);
  let inflowDaily = 0;

  for (let i = 0; i < ponies.length; i++) {
    const donor = ponies[i];
    if (donor.id === targetPony.id) continue;
    const donorDaily = calculatePonyDailyRate(donor, statuses);
    const splits = getNormalizedPonySplitsWithConnectedSet(donor, donorDaily, adjMap.get(donor.id) || new Set<string>());
    const match = splits.find(s => s.recipientId === targetPony.id);
    if (match && match.amount > 0) {
      inflowDaily += match.amount;
    }
  }

  const recipientMultiplier = getPonyStatusMultiplier(targetPony, statuses);
  const netInflowDaily = Math.round(inflowDaily * recipientMultiplier);
  const netTotalOverall = Math.round(targetPony.totalOverallLove || 0);
  const netTotalSpendable = Math.round(targetPony.currentLoveTotal || (netTotalOverall - (targetPony.totalLoveSpent || 0)));

  return {
    inflowDaily: netInflowDaily,
    totalSpendable: netTotalSpendable,
    totalOverall: netTotalOverall,
    magicalPower: netTotalOverall,
    scopeLabel: `${targetPony.name} (Total Inflow)`,
  };
});

export const calculateNetworkMetrics = memoizeByRef(function calculateNetworkMetricsImpl(
  ponies: PonyNode[],
  connections: WebConnection[],
  _loveToPowerRatio: number = 3.5,
  targetDate: string = new Date().toISOString().split('T')[0],
  statuses?: CustomStatus[],
  liveTick?: number
): NetworkMetrics {
  const totalPonies = ponies.length;
  const totalConnections = connections.length;

  if (totalPonies === 0) {
    return {
      totalPonies: 0,
      totalConnections: 0,
      totalLovePerDay: 0,
      totalSpendableLove: 0,
      totalOverallLove: 0,
      totalMagicalPower: 0,
      networkResonanceBonus: 1.0,
      averageYieldPerPony: 0,
      highestYieldPony: null,
      topRecipientPony: null,
    };
  }

  const { adjMap } = buildConnectionIndex(connections);
  let totalLovePerDay = 0;
  let totalOverallLove = 0;
  let totalSpendableLove = 0;
  let highestYieldPony: { name: string; rate: number } | null = null;

  const receivedMap = new Map<string, { daily: number; total: number }>();
  const ponyMap = new Map<string, PonyNode>();

  for (let i = 0; i < ponies.length; i++) {
    const pony = ponies[i];
    ponyMap.set(pony.id, pony);
    const dailyRate = calculatePonyDailyRate(pony, statuses);
    const overall = pony.totalOverallLove || calculatePonyAccumulatedLove(pony, targetDate, statuses, liveTick);
    const spendable = pony.currentLoveTotal !== undefined ? pony.currentLoveTotal : (overall - (pony.totalLoveSpent || 0));

    totalLovePerDay += dailyRate;
    totalOverallLove += overall;
    totalSpendableLove += spendable;

    if (!highestYieldPony || dailyRate > highestYieldPony.rate) {
      highestYieldPony = { name: pony.name, rate: dailyRate };
    }

    const splits = getNormalizedPonySplitsWithConnectedSet(pony, dailyRate, adjMap.get(pony.id) || new Set<string>());
    for (let j = 0; j < splits.length; j++) {
      const split = splits[j];
      const ratio = dailyRate > 0 ? split.amount / dailyRate : 0;
      const accumSent = Math.round(overall * ratio);
      const current = receivedMap.get(split.recipientId) || { daily: 0, total: 0 };
      receivedMap.set(split.recipientId, {
        daily: current.daily + split.amount,
        total: current.total + accumSent,
      });
    }
  }

  let topRecipientPony: { name: string; icon: string; receivedDaily: number; totalReceived: number } | null = null;

  receivedMap.forEach((val, recipientId) => {
    const recPony = ponyMap.get(recipientId);
    if (recPony && (!topRecipientPony || val.daily > topRecipientPony.receivedDaily)) {
      topRecipientPony = {
        name: recPony.name,
        icon: recPony.avatarIcon,
        receivedDaily: val.daily,
        totalReceived: val.total,
      };
    }
  });

  const totalMagicalPower = Math.round(totalOverallLove); // 1 love = 1 thaum
  const averageYieldPerPony = Number((totalLovePerDay / totalPonies).toFixed(1));

  return {
    totalPonies,
    totalConnections,
    totalLovePerDay: Math.round(totalLovePerDay),
    totalSpendableLove: Math.round(totalSpendableLove),
    totalOverallLove: Math.round(totalOverallLove),
    totalMagicalPower,
    networkResonanceBonus: 1.0,
    averageYieldPerPony,
    highestYieldPony,
    topRecipientPony,
  };
});

export const generateHarvestTimeline = memoizeByRef(function generateHarvestTimelineImpl(
  ponies: PonyNode[],
  connections: WebConnection[],
  _loveToPowerRatio: number = 1.0,
  daysSpan: number = 30,
  referenceDateStr: string = new Date().toISOString().split('T')[0],
  statuses?: CustomStatus[],
  scope: DestinationFilterScope = 'all'
): HarvestTimePoint[] {
  const points: HarvestTimePoint[] = [];
  const refDateMs = new Date(referenceDateStr + 'T23:59:59Z').getTime();

  const totalHours = daysSpan * 24;
  const stepHours = daysSpan <= 7 ? 1 : (daysSpan <= 30 ? 2 : 6);

  // Pre-compute invariant per-pony / per-flow structures ONCE outside the time loop
  const { adjMap, connPairMap } = buildConnectionIndex(connections);

  if (scope === 'all') {
    const entries = ponies
      .map(pony => ({
        startMs: pony.startDate ? getUtcMidnightMs(pony.startDate) : NaN,
        dailyRate: calculatePonyDailyRate(pony, statuses),
      }))
      .filter(e => !isNaN(e.startMs));

    for (let h = totalHours; h >= 0; h -= stepHours) {
      const pointMs = refDateMs - h * 3600000;
      const pointDate = new Date(pointMs);
      const dateStr = pointDate.toISOString().slice(0, 10) + ' ' + String(pointDate.getUTCHours()).padStart(2, '0') + ':00';

      let dailyLove = 0;
      let cumulativeLove = 0;
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        if (pointMs >= e.startMs) {
          dailyLove += e.dailyRate;
          cumulativeLove += Math.max(0, ((pointMs - e.startMs) / 86400000) * e.dailyRate);
        }
      }

      const roundedCum = Math.round(cumulativeLove);
      points.push({
        date: dateStr,
        timestamp: pointMs,
        dailyLove: Math.round(dailyLove),
        cumulativeLove: roundedCum,
        magicalPower: roundedCum,
      });
    }
    return points;
  }

  if (scope === 'transfers') {
    const flows = getInBetweenFlows(ponies, referenceDateStr, statuses, connections).map(f => ({
      dailyRate: f.dailyRate,
      relStartMs: f.relationshipStartDate ? getUtcMidnightMs(f.relationshipStartDate) : NaN,
    }));

    for (let h = totalHours; h >= 0; h -= stepHours) {
      const pointMs = refDateMs - h * 3600000;
      const pointDate = new Date(pointMs);
      const dateStr = pointDate.toISOString().slice(0, 10) + ' ' + String(pointDate.getUTCHours()).padStart(2, '0') + ':00';

      let dailyLove = 0;
      let cumulativeLove = 0;
      for (let i = 0; i < flows.length; i++) {
        const f = flows[i];
        dailyLove += f.dailyRate;
        if (!isNaN(f.relStartMs)) {
          cumulativeLove += Math.max(0, ((pointMs - f.relStartMs) / 86400000) * f.dailyRate);
        }
      }

      const roundedCum = Math.round(cumulativeLove);
      points.push({
        date: dateStr,
        timestamp: pointMs,
        dailyLove: Math.round(dailyLove),
        cumulativeLove: roundedCum,
        magicalPower: roundedCum,
      });
    }
    return points;
  }

  if (scope === 'general') {
    const entries = ponies
      .map(pony => {
        const startMs = pony.startDate ? getUtcMidnightMs(pony.startDate) : NaN;
        const dailyRate = calculatePonyDailyRate(pony, statuses);
        const splits = getNormalizedPonySplitsWithConnectedSet(pony, dailyRate, adjMap.get(pony.id) || new Set<string>());
        let allocated = 0;
        for (let i = 0; i < splits.length; i++) allocated += splits[i].amount;
        const unallocated = Math.max(0, dailyRate - allocated);
        return { startMs, unallocated };
      })
      .filter(e => !isNaN(e.startMs));

    for (let h = totalHours; h >= 0; h -= stepHours) {
      const pointMs = refDateMs - h * 3600000;
      const pointDate = new Date(pointMs);
      const dateStr = pointDate.toISOString().slice(0, 10) + ' ' + String(pointDate.getUTCHours()).padStart(2, '0') + ':00';

      let dailyLove = 0;
      let cumulativeLove = 0;
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        if (pointMs >= e.startMs) {
          dailyLove += e.unallocated;
          cumulativeLove += Math.max(0, ((pointMs - e.startMs) / 86400000) * e.unallocated);
        }
      }

      const roundedCum = Math.round(cumulativeLove);
      points.push({
        date: dateStr,
        timestamp: pointMs,
        dailyLove: Math.round(dailyLove),
        cumulativeLove: roundedCum,
        magicalPower: roundedCum,
      });
    }
    return points;
  }

  // Specific pony scope
  const targetPony = ponies.find(p => p.id === scope);
  const targetStartMs = targetPony?.startDate ? getUtcMidnightMs(targetPony.startDate) : NaN;
  const targetDailyRate = targetPony ? calculatePonyDailyRate(targetPony, statuses) : 0;

  const incomingLinks: { relStartMs: number; amount: number }[] = [];
  for (let i = 0; i < ponies.length; i++) {
    const donor = ponies[i];
    if (donor.id === scope) continue;
    const donorDaily = calculatePonyDailyRate(donor, statuses);
    const splits = getNormalizedPonySplitsWithConnectedSet(donor, donorDaily, adjMap.get(donor.id) || new Set<string>());
    const match = splits.find(s => s.recipientId === scope);
    if (match && match.amount > 0) {
      const conn = connPairMap.get(makePairKey(donor.id, scope));
      const effectiveDateStr = conn?.startDate || referenceDateStr;
      const relStartMs = effectiveDateStr ? getUtcMidnightMs(effectiveDateStr) : NaN;
      if (!isNaN(relStartMs)) {
        incomingLinks.push({ relStartMs, amount: match.amount });
      }
    }
  }

  for (let h = totalHours; h >= 0; h -= stepHours) {
    const pointMs = refDateMs - h * 3600000;
    const pointDate = new Date(pointMs);
    const dateStr = pointDate.toISOString().slice(0, 10) + ' ' + String(pointDate.getUTCHours()).padStart(2, '0') + ':00';

    let dailyLove = 0;
    let cumulativeLove = 0;

    if (targetPony && !isNaN(targetStartMs) && pointMs >= targetStartMs) {
      cumulativeLove += Math.max(0, ((pointMs - targetStartMs) / 86400000) * targetDailyRate);
    }

    for (let i = 0; i < incomingLinks.length; i++) {
      const link = incomingLinks[i];
      if (pointMs >= link.relStartMs) {
        dailyLove += link.amount;
        cumulativeLove += Math.max(0, ((pointMs - link.relStartMs) / 86400000) * link.amount);
      }
    }

    const roundedCum = Math.round(cumulativeLove);
    points.push({
      date: dateStr,
      timestamp: pointMs,
      dailyLove: Math.round(dailyLove),
      cumulativeLove: roundedCum,
      magicalPower: roundedCum,
    });
  }

  return points;
});

/**
 * Formats Magical Power in Thaums using proper SI prefixes:
 * Kilo, Mega, Giga, Tera, Peta, Exa.
 */
export function formatThaumPower(thaums: number): { value: string; unit: string; full: string } {
  const abs = Math.abs(thaums);
  if (abs >= 1e18) return { value: (thaums / 1e18).toFixed(2), unit: 'Exa-Thaums', full: `${(thaums / 1e18).toFixed(2)} Exa-Thaums` };
  if (abs >= 1e15) return { value: (thaums / 1e15).toFixed(2), unit: 'Peta-Thaums', full: `${(thaums / 1e15).toFixed(2)} Peta-Thaums` };
  if (abs >= 1e12) return { value: (thaums / 1e12).toFixed(2), unit: 'Tera-Thaums', full: `${(thaums / 1e12).toFixed(2)} Tera-Thaums` };
  if (abs >= 1e9)  return { value: (thaums / 1e9).toFixed(2),  unit: 'Giga-Thaums', full: `${(thaums / 1e9).toFixed(2)} Giga-Thaums` };
  if (abs >= 1e6)  return { value: (thaums / 1e6).toFixed(2),  unit: 'Mega-Thaums', full: `${(thaums / 1e6).toFixed(2)} Mega-Thaums` };
  if (abs >= 1e3)  return { value: (thaums / 1e3).toFixed(2),  unit: 'Kilo-Thaums', full: `${(thaums / 1e3).toFixed(2)} Kilo-Thaums` };
  return { value: thaums.toLocaleString(), unit: 'Thaums', full: `${thaums.toLocaleString()} Thaums` };
}

export function formatLoveNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(2) + 'B';
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(2) + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

export type PonySortKey =
  | 'name_asc'
  | 'name_desc'
  | 'dailyReceived_asc'
  | 'dailyReceived_desc'
  | 'totalReceived_asc'
  | 'totalReceived_desc'
  | 'totalLoved_asc'
  | 'totalLoved_desc'
  | 'dailyProduced_asc'
  | 'dailyProduced_desc'
  | 'lovedBy_asc'
  | 'lovedBy_desc';

export const PONY_SORT_OPTIONS: { value: PonySortKey; label: string }[] = [
  { value: 'name_asc', label: 'Name (A-Z)' },
  { value: 'name_desc', label: 'Name (Z-A)' },
  { value: 'dailyReceived_asc', label: 'Lowest Daily Received' },
  { value: 'dailyReceived_desc', label: 'Highest Daily Received' },
  { value: 'totalReceived_asc', label: 'Lowest Total Received' },
  { value: 'totalReceived_desc', label: 'Highest Total Received' },
  { value: 'totalLoved_asc', label: 'Lowest Total Loved / Produced' },
  { value: 'totalLoved_desc', label: 'Highest Total Loved / Produced' },
  { value: 'dailyProduced_asc', label: 'Lowest Daily Capacity' },
  { value: 'dailyProduced_desc', label: 'Highest Daily Capacity' },
  { value: 'lovedBy_asc', label: 'Lowest Loved By Total (Donors)' },
  { value: 'lovedBy_desc', label: 'Highest Loved By Total (Donors)' },
];

export const sortPonies = memoizeByRef(function sortPoniesImpl(
  ponies: PonyNode[],
  sortKey: PonySortKey,
  connections: WebConnection[] = [],
  statuses?: CustomStatus[],
  targetDate: string = new Date().toISOString().split('T')[0],
  liveTick?: number,
  _reservoirDeductions: number = 0
): PonyNode[] {
  if (!ponies || ponies.length === 0) return [];

  // Fast path when sorting strictly by name (avoids flow/metrics calculation completely)
  if (sortKey === 'name_asc') {
    return [...ponies].sort((a, b) => a.name.localeCompare(b.name));
  }
  if (sortKey === 'name_desc') {
    return [...ponies].sort((a, b) => b.name.localeCompare(a.name));
  }

  // Reuses single O(N + E) pass + memoization cache
  const flowStats = calculateLoveFlowStats(ponies, targetDate, statuses, connections, liveTick);
  const metricsMap = new Map<string, {
    dailyReceived: number;
    totalReceived: number;
    totalLoved: number;
    dailyProduced: number;
    lovedBy: number;
  }>();

  for (let i = 0; i < flowStats.length; i++) {
    const stat = flowStats[i];
    metricsMap.set(stat.pony.id, {
      dailyReceived: stat.dailyReceived,
      totalReceived: Math.round(stat.pony.totalOverallLove || 0),
      totalLoved: stat.totalProduced,
      dailyProduced: stat.dailyProduced,
      lovedBy: stat.donors.length,
    });
  }

  const sorted = [...ponies];

  sorted.sort((a, b) => {
    const ma = metricsMap.get(a.id)!;
    const mb = metricsMap.get(b.id)!;

    switch (sortKey) {
      case 'dailyReceived_asc':
        return ma.dailyReceived - mb.dailyReceived || a.name.localeCompare(b.name);
      case 'dailyReceived_desc':
        return mb.dailyReceived - ma.dailyReceived || a.name.localeCompare(b.name);
      case 'totalReceived_asc':
        return ma.totalReceived - mb.totalReceived || a.name.localeCompare(b.name);
      case 'totalReceived_desc':
        return mb.totalReceived - ma.totalReceived || a.name.localeCompare(b.name);
      case 'totalLoved_asc':
        return ma.totalLoved - mb.totalLoved || a.name.localeCompare(b.name);
      case 'totalLoved_desc':
        return mb.totalLoved - ma.totalLoved || a.name.localeCompare(b.name);
      case 'dailyProduced_asc':
        return ma.dailyProduced - mb.dailyProduced || a.name.localeCompare(b.name);
      case 'dailyProduced_desc':
        return mb.dailyProduced - ma.dailyProduced || a.name.localeCompare(b.name);
      case 'lovedBy_asc':
        return ma.lovedBy - mb.lovedBy || a.name.localeCompare(b.name);
      case 'lovedBy_desc':
        return mb.lovedBy - ma.lovedBy || a.name.localeCompare(b.name);
      default:
        return a.name.localeCompare(b.name);
    }
  });

  return sorted;
});

export function filterPoniesBySearch(ponies: PonyNode[], query: string): PonyNode[] {
  if (!query || !query.trim()) return ponies;
  const q = query.toLowerCase().trim();
  return ponies.filter(p => {
    const customMatches = Object.entries(p.customData || {}).some(
      ([k, v]) => k.toLowerCase().includes(q) || v.toLowerCase().includes(q)
    );
    return (
      p.name.toLowerCase().includes(q) ||
      p.species.toLowerCase().includes(q) ||
      p.element.toLowerCase().includes(q) ||
      p.location.toLowerCase().includes(q) ||
      p.notes.toLowerCase().includes(q) ||
      (p.secretSpecies && p.secretSpecies.toLowerCase().includes(q)) ||
      (p.secretElement && p.secretElement.toLowerCase().includes(q)) ||
      (p.secretNotes && p.secretNotes.toLowerCase().includes(q)) ||
      customMatches
    );
  });
}

export function getUserMainPony(ponies: PonyNode[], userId?: string): PonyNode | undefined {
  if (!userId) return undefined;
  let fallback: PonyNode | undefined;
  for (let i = 0; i < ponies.length; i++) {
    const p = ponies[i];
    if (p.ownerId === userId) {
      if (p.isMainPony) return p;
      if (!fallback) fallback = p;
    }
  }
  return fallback;
}


