import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { PonyNode, WebConnection, ConnectionType, CustomStatus } from '../types/pony';
import { calculatePonyDailyRate, getNormalizedPonySplits, calculateLoveFlowStats, getUserMainPony } from '../utils/calculations';
import { 
  Sparkles, 
  Plus, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Link2, 
  Unlink, 
  Trash2, 
  Edit3,
  Eye,
  AlertTriangle,
  LayoutGrid,
  ChevronDown,
  Layers,
  Check
} from 'lucide-react';
import { AdminConfirmModal } from './AdminConfirmModal';
import { useSettings } from '../context/SettingsContext';

interface NetworkWebProps {
  ponies: PonyNode[];
  connections: WebConnection[];
  selectedPonyId: string | null;
  onSelectPony: (id: string | null) => void;
  onUpdatePony: (pony: PonyNode) => void;
  onUpdatePonies?: (updatedPonies: PonyNode[]) => void;
  onDeletePony: (id: string) => void;
  onCreateConnection: (sourceId: string, targetId: string, type?: ConnectionType) => void;
  onDeleteConnection: (connId: string) => void;
  onOpenAddModal: (initialPos?: { x: number; y: number }) => void;
  onOpenFullDetailModal: (ponyId: string) => void;
  searchQuery: string;
  targetDate: string;
  statuses: CustomStatus[];
  livePulseTick?: number;
  webTitle: string;
  onUpdateWebTitle: (title: string) => void;
  isLayoutLocked?: boolean;
  currentUserPonyId?: string;
  currentUserId?: string;
  isAdmin?: boolean;
  isSimulatingNonAdmin?: boolean;
  canAddPony?: boolean;
  centerTrigger?: number;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  ponyId: string | null;
  canvasX: number;
  canvasY: number;
}

interface FlowBeamGeometry {
  key: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  distance: number;
  sIdx: number;
}

const FlowParticlesLayer: React.FC<{
  enabled: boolean;
  beams: FlowBeamGeometry[];
  connectionStyle: 'lines' | 'circle';
}> = React.memo(({ enabled, beams, connectionStyle }) => {
  const [animationTick, setAnimationTick] = useState(0);

  useEffect(() => {
    if (!enabled || beams.length === 0) {
      setAnimationTick(0);
      return;
    }

    let animId: number | null = null;
    let lastUpdate = performance.now();

    const animate = (now: number) => {
      if (typeof document !== 'undefined' && document.hidden) {
        animId = null;
        return;
      }
      const deltaMs = now - lastUpdate;
      if (deltaMs >= 33) {
        const step = 0.015 * (deltaMs / 16.67);
        lastUpdate = now;
        setAnimationTick(prev => (prev + step) % 1);
      }
      animId = requestAnimationFrame(animate);
    };

    const handleVisibility = () => {
      if (!document.hidden && animId === null) {
        lastUpdate = performance.now();
        animId = requestAnimationFrame(animate);
      }
    };

    if (typeof document === 'undefined' || !document.hidden) {
      animId = requestAnimationFrame(animate);
    }
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (animId !== null) cancelAnimationFrame(animId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, beams.length]);

  if (!enabled || beams.length === 0) return null;

  return (
    <g className="pointer-events-none">
      {beams.map((b) => {
        if (b.distance <= 30) return null;
        const particleT = (animationTick + b.sIdx * 0.3) % 1;
        let px: number;
        let py: number;

        if (connectionStyle === 'circle') {
          const midX = (b.fromX + b.toX) / 2;
          const midY = (b.fromY + b.toY) / 2;
          const r = b.distance / 2;
          const angle0 = Math.atan2(b.fromY - midY, b.fromX - midX);
          const curAngle = angle0 + Math.PI * particleT;
          px = midX + r * Math.cos(curAngle);
          py = midY + r * Math.sin(curAngle);
        } else {
          px = b.fromX + (b.toX - b.fromX) * particleT;
          py = b.fromY + (b.toY - b.fromY) * particleT;
        }

        return (
          <circle
            key={`particle-${b.key}`}
            cx={px}
            cy={py}
            r={4}
            fill="#ffffff"
            filter="url(#glow-filter)"
          />
        );
      })}
    </g>
  );
});

export const NetworkWeb: React.FC<NetworkWebProps> = ({
  ponies,
  connections,
  selectedPonyId,
  onSelectPony,
  onUpdatePony,
  onUpdatePonies,
  onDeletePony,
  onCreateConnection,
  onDeleteConnection,
  onOpenAddModal,
  onOpenFullDetailModal,
  searchQuery,
  targetDate,
  statuses,
  livePulseTick = 0,
  webTitle,
  onUpdateWebTitle,
  isLayoutLocked = false,
  currentUserPonyId,
  currentUserId,
  isAdmin = false,
  isSimulatingNonAdmin = false,
  canAddPony = true,
  centerTrigger = 0,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme, adminSettings } = useSettings();
  const liveFlowAnimationsEnabled = Boolean(adminSettings.allowLiveFlowAnimations);

  const isOwner = useCallback((pony: PonyNode | null | undefined): boolean => {
    if (!pony) return false;
    if (isSimulatingNonAdmin) {
      return Boolean(currentUserPonyId && pony.id === currentUserPonyId);
    }
    if (isAdmin) {
      return true;
    }
    if (currentUserId && pony.ownerId === currentUserId) {
      return true;
    }
    if (currentUserId && currentUserPonyId && pony.id === currentUserPonyId) {
      return true;
    }
    return false;
  }, [isSimulatingNonAdmin, isAdmin, currentUserId, currentUserPonyId]);

  const nodeMap = useMemo(() => new Map(ponies.map(p => [p.id, p])), [ponies]);

  const userPony = useMemo(() => {
    if (currentUserPonyId) {
      return nodeMap.get(currentUserPonyId) || null;
    }
    return currentUserId ? (ponies.find(p => p.ownerId === currentUserId) || null) : null;
  }, [nodeMap, ponies, currentUserPonyId, currentUserId]);

  // Viewport pan & zoom transform
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [targetTransform, setTargetTransform] = useState({ x: 0, y: 0, scale: 1 });
  const animationFrameRef = useRef<number | null>(null);
  
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isHoveringMap, setIsHoveringMap] = useState(false);

  // Set of selected pony IDs (single-select by default)
  const [selectedPonyIds, setSelectedPonyIds] = useState<Set<string>>(new Set());

  // Layout Ordering Dropdown Menu
  const [isOrderDropdownOpen, setIsOrderDropdownOpen] = useState(false);

  // Connection visualization style: direct lines ('lines' / '/') vs full circle ('circle' / 'O')
  const [connectionStyle, setConnectionStyle] = useState<'lines' | 'circle'>('lines');

  // Pony Delete Confirmation State (Safe in-app modal instead of browser popup)
  const [ponyPendingDelete, setPonyPendingDelete] = useState<PonyNode | null>(null);
  
  // Connection Delete Confirmation State
  const [connectionPendingDelete, setConnectionPendingDelete] = useState<WebConnection | null>(null);

  // Node Dragging & Local View Layout Overrides (purely local client-side unless saved to Firebase by owner/admin)
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [localDragPositions, setLocalDragPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [localViewPositions, setLocalViewPositions] = useState<Record<string, { x: number; y: number }>>({});
  const localViewPositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  localViewPositionsRef.current = localViewPositions;
  const localDragPositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const dragStartMouseRef = useRef({ x: 0, y: 0 });
  const initialPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const hasDraggedRef = useRef(false);

  // Connect Mode
  const [isConnectMode, setIsConnectMode] = useState(false);
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);

  // First Layer Connections Filter State
  const [firstLayerOnly, setFirstLayerOnly] = useState(false);
  const [filterMyPonies, setFilterMyPonies] = useState(false);

  useEffect(() => {
    if (!adminSettings.allowMyPoniesSort && filterMyPonies) {
      setFilterMyPonies(false);
    }
  }, [adminSettings.allowMyPoniesSort, filterMyPonies]);

  const mainPonyId = useMemo(() => {
    if (!firstLayerOnly) return null;
    return getUserMainPony(ponies, currentUserId)?.id || null;
  }, [firstLayerOnly, ponies, currentUserId]);

  const friendNodeIds = useMemo(() => {
    if (!firstLayerOnly || !mainPonyId) return new Set<string>();
    const set = new Set<string>();
    set.add(mainPonyId);
    connections.forEach(c => {
      if (c.source === mainPonyId) set.add(c.target);
      if (c.target === mainPonyId) set.add(c.source);
    });
    return set;
  }, [firstLayerOnly, mainPonyId, connections]);

  const visiblePonies = useMemo(() => {
    if (!firstLayerOnly && !filterMyPonies) {
      return ponies;
    }
    return ponies.filter(p => {
      const isOwned = Boolean(currentUserId && p.ownerId === currentUserId);
      const isFriend = Boolean(mainPonyId && friendNodeIds.has(p.id));

      if (firstLayerOnly && filterMyPonies) {
        return isOwned || isFriend;
      } else if (firstLayerOnly) {
        return isFriend;
      } else if (filterMyPonies) {
        return isOwned;
      }
      return true;
    });
  }, [ponies, firstLayerOnly, filterMyPonies, currentUserId, mainPonyId, friendNodeIds]);

  const visiblePonyIds = useMemo(() => new Set(visiblePonies.map(p => p.id)), [visiblePonies]);

  const visibleConnections = useMemo(() => {
    return connections.filter(c => {
      if (!visiblePonyIds.has(c.source) || !visiblePonyIds.has(c.target)) {
        return false;
      }

      if (!firstLayerOnly && !filterMyPonies) {
        return true;
      }

      const sourcePony = nodeMap.get(c.source);
      const targetPony = nodeMap.get(c.target);

      const isBetweenOwned = Boolean(
        currentUserId &&
        sourcePony?.ownerId === currentUserId &&
        targetPony?.ownerId === currentUserId
      );

      const isMainPonyFriendConn = Boolean(
        mainPonyId && (c.source === mainPonyId || c.target === mainPonyId)
      );

      if (firstLayerOnly && filterMyPonies) {
        return isBetweenOwned || isMainPonyFriendConn;
      } else if (firstLayerOnly) {
        return isMainPonyFriendConn;
      } else if (filterMyPonies) {
        return isBetweenOwned;
      }
      return true;
    });
  }, [connections, visiblePonyIds, firstLayerOnly, filterMyPonies, currentUserId, mainPonyId, nodeMap]);

  // Right-Click Context Menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    ponyId: null,
    canvasX: 450,
    canvasY: 300,
  });

  const poniesRef = useRef(ponies);
  poniesRef.current = ponies;
  const transformScaleRef = useRef(transform.scale);
  transformScaleRef.current = transform.scale;

  // Smooth animation for transform — automatically stops rAF once settled
  useEffect(() => {
    let cancelled = false;
    const animate = () => {
      if (cancelled) return;
      let needsAnotherFrame = false;
      setTransform(prev => {
        const dx = targetTransform.x - prev.x;
        const dy = targetTransform.y - prev.y;
        const ds = targetTransform.scale - prev.scale;

        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(ds) < 0.005) {
          if (prev.x === targetTransform.x && prev.y === targetTransform.y && prev.scale === targetTransform.scale) {
            return prev;
          }
          return targetTransform;
        }

        needsAnotherFrame = true;
        return {
          x: prev.x + dx * 0.18,
          y: prev.y + dy * 0.18,
          scale: prev.scale + ds * 0.18,
        };
      });
      if (needsAnotherFrame && !cancelled) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      cancelled = true;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [targetTransform]);

  // Sync external selectedPonyId & centerTrigger in viewport without re-centering on 10s love pulses
  useEffect(() => {
    if (selectedPonyId) {
      setSelectedPonyIds(new Set([selectedPonyId]));
      const targetPony = poniesRef.current.find(p => p.id === selectedPonyId);
      if (targetPony && containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        const scale = transformScaleRef.current;
        setTargetTransform({
          scale,
          x: clientWidth / 2 - targetPony.x * scale,
          y: clientHeight / 2 - targetPony.y * scale,
        });
      }
    } else {
      setSelectedPonyIds(new Set());
    }
  }, [selectedPonyId, centerTrigger]);

  // Close context menu on global click
  useEffect(() => {
    const handleGlobalClick = () => {
      if (contextMenu.visible) {
        setContextMenu(prev => ({ ...prev, visible: false }));
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [contextMenu.visible]);

  // Center view on initial mount only
  const handleResetView = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    setTransform({
      x: clientWidth / 2 - 450,
      y: clientHeight / 2 - 300,
      scale: 0.95,
    });
  }, []);

  useEffect(() => {
    handleResetView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Precompute active directed love flow beams
  const visibleFlowBeams = useMemo(() => {
    const beams: { fromId: string; toId: string; sIdx: number }[] = [];
    for (let i = 0; i < visiblePonies.length; i++) {
      const pony = visiblePonies[i];
      const splits = getNormalizedPonySplits(pony, statuses, connections);
      for (let sIdx = 0; sIdx < splits.length; sIdx++) {
        const split = splits[sIdx];
        if (!visiblePonyIds.has(split.recipientId)) continue;
        if (firstLayerOnly && friendNodeIds && !friendNodeIds.has(split.recipientId)) continue;
        beams.push({ fromId: pony.id, toId: split.recipientId, sIdx });
      }
    }
    return beams;
  }, [visiblePonies, visiblePonyIds, firstLayerOnly, friendNodeIds, statuses, connections]);

  // Handle Fullscreen state change
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Handle Scroll Locking when hovering map
  useEffect(() => {
    const handleWheelLock = (e: WheelEvent) => {
      if (isHoveringMap) {
        // We let the React onWheel handle the zoom/pan, 
        // but we prevent the default page scroll if hovering the map.
        // Actually, if we use e.preventDefault() here it might block the browser-level scroll
        // which is what we want.
        e.stopPropagation();
      }
    };

    if (isHoveringMap) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isHoveringMap]);

  const toggleFullScreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Window-level mouse movement and mouse up for responsive local dragging & panning (commits to App/Firestore once on mouseup)
  useEffect(() => {
    if (!draggingNodeId && !isPanning) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (isPanning) {
        hasPannedRef.current = true;
        const nextTransform = {
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
          scale: transform.scale,
        };
        setTransform(nextTransform);
        setTargetTransform(nextTransform);
      } else if (draggingNodeId) {
        const dist = Math.hypot(e.clientX - dragStartMouseRef.current.x, e.clientY - dragStartMouseRef.current.y);
        if (dist > 3) {
          hasDraggedRef.current = true;
        }

        const deltaX = (e.clientX - dragStartMouseRef.current.x) / transform.scale;
        const deltaY = (e.clientY - dragStartMouseRef.current.y) / transform.scale;

        const isGroupDrag = selectedPonyIds.size > 1 && selectedPonyIds.has(draggingNodeId);
        const nextOverrides: Record<string, { x: number; y: number }> = {};

        if (isGroupDrag) {
          selectedPonyIds.forEach((id) => {
            const initPos = initialPositionsRef.current.get(id);
            if (initPos) {
              nextOverrides[id] = {
                x: Math.round(initPos.x + deltaX),
                y: Math.round(initPos.y + deltaY),
              };
            }
          });
        } else {
          const initPos = initialPositionsRef.current.get(draggingNodeId);
          if (initPos) {
            nextOverrides[draggingNodeId] = {
              x: Math.round(initPos.x + deltaX),
              y: Math.round(initPos.y + deltaY),
            };
          }
        }

        localDragPositionsRef.current = nextOverrides;
        setLocalDragPositions(nextOverrides);
      }
    };

    const handleWindowMouseUp = () => {
      if (isPanning) {
        setIsPanning(false);
        if (!hasPannedRef.current && !isConnectMode) {
          setSelectedPonyIds(new Set());
          onSelectPony(null);
        }
      }
      if (draggingNodeId) {
        const overrides = localDragPositionsRef.current;
        const overrideKeys = Object.keys(overrides);

        if (isAdmin) {
          if (overrideKeys.length === 1) {
            const p = poniesRef.current.find((item) => item.id === overrideKeys[0]);
            if (p) {
              onUpdatePony({ ...p, ...overrides[p.id] });
            }
          } else if (overrideKeys.length > 1) {
            const updatedList = poniesRef.current.map((p) =>
              overrides[p.id] ? { ...p, ...overrides[p.id] } : p
            );
            if (onUpdatePonies) {
              onUpdatePonies(updatedList);
            } else {
              overrideKeys.forEach((id) => {
                const p = updatedList.find((item) => item.id === id);
                if (p) onUpdatePony(p);
              });
            }
          }
          setLocalViewPositions((prev) => {
            const next = { ...prev };
            overrideKeys.forEach((id) => delete next[id]);
            return next;
          });
        } else {
          // Signed-in owner persists their own pony to Firebase; any non-owned drags remain purely local in browser view
          const localOnly: Record<string, { x: number; y: number }> = {};
          overrideKeys.forEach((id) => {
            const p = poniesRef.current.find((item) => item.id === id);
            if (p && currentUserId && isOwner(p)) {
              onUpdatePony({ ...p, ...overrides[id] });
            } else {
              localOnly[id] = overrides[id];
            }
          });
          if (Object.keys(localOnly).length > 0) {
            setLocalViewPositions((prev) => ({ ...prev, ...localOnly }));
          }
        }

        // Save current pony positions locally as user's custom layout preset
        try {
          const posMap: Record<string, { x: number; y: number }> = {};
          poniesRef.current.forEach((p) => {
            const ov = overrides[p.id] || localViewPositionsRef.current[p.id];
            posMap[p.id] = ov ? { x: ov.x, y: ov.y } : { x: p.x, y: p.y };
          });
          localStorage.setItem('pony_network_custom_layout_positions', JSON.stringify(posMap));
        } catch (e) {}

        localDragPositionsRef.current = {};
        setLocalDragPositions({});
        setDraggingNodeId(null);
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [draggingNodeId, isPanning, panStart, transform.scale, selectedPonyIds, isConnectMode, isAdmin, currentUserId, isOwner, onSelectPony, onUpdatePony, onUpdatePonies]);

  // Zoom handlers
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.min(2.5, Math.max(0.35, transform.scale * zoomFactor));

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const nextTransform = {
        scale: newScale,
        x: mouseX - (mouseX - transform.x) * (newScale / transform.scale),
        y: mouseY - (mouseY - transform.y) * (newScale / transform.scale),
      };
      setTransform(nextTransform);
      setTargetTransform(nextTransform);
    }
  };

  const handleZoom = (direction: 'in' | 'out') => {
    const factor = direction === 'in' ? 1.25 : 0.8;
    const newScale = Math.min(2.5, Math.max(0.35, transform.scale * factor));
    if (containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current;
      const centerX = clientWidth / 2;
      const centerY = clientHeight / 2;
      const nextTransform = {
        scale: newScale,
        x: centerX - (centerX - transform.x) * (newScale / transform.scale),
        y: centerY - (centerY - transform.y) * (newScale / transform.scale),
      };
      setTransform(nextTransform);
      setTargetTransform(nextTransform);
    }
  };

  const hasPannedRef = useRef(false);

  // Background Pan Start - ONLY triggered when clicking on empty canvas background!
  const handleCanvasBackgroundMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2) return; // Right-click handled by context menu

    setIsPanning(true);
    hasPannedRef.current = false;
    setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    setSelectedConnectionId(null);
  };

  // Node Mouse Down - Starts node dragging & selection, NEVER pans!
  const handleNodeMouseDown = (e: React.MouseEvent, pony: PonyNode) => {
    if (e.button === 2) return; // Right-click handled by context menu
    e.stopPropagation(); // CRITICAL: Stop event from bubbling to background pan handler!
    e.preventDefault();

    setIsPanning(false); // Guarantee that panning is FALSE

    // Check if in Connect Mode
    if (isConnectMode) {
      const myPonyId = currentUserPonyId || userPony?.id;
      if (myPonyId && myPonyId !== pony.id) {
        onCreateConnection(myPonyId, pony.id, 'friendship');
      }
      setIsConnectMode(false);
      setConnectSourceId(null);
      return;
    }

    // Allow local dragging when layout is not locked (only owners/admins persist to Firebase)
    if (!isLayoutLocked) {
      setDraggingNodeId(pony.id);
    }
    dragStartMouseRef.current = { x: e.clientX, y: e.clientY };
    hasDraggedRef.current = false;

    // Snapshot current visible positions of all ponies
    const posMap = new Map<string, { x: number; y: number }>();
    ponies.forEach(p => {
      const coords = localViewPositions[p.id] || { x: p.x, y: p.y };
      posMap.set(p.id, coords);
    });
    initialPositionsRef.current = posMap;

    // Single Selection: Always select the clicked node
    setSelectedPonyIds(new Set([pony.id]));
    onSelectPony(pony.id);
  };

  // Node Click (Mouse Up without drag)
  const handleNodeClick = (e: React.MouseEvent, pony: PonyNode) => {
    if (e.button === 2) return;
    e.stopPropagation();

    if (hasDraggedRef.current) return;
    if (isConnectMode) return;

    setSelectedPonyIds(new Set([pony.id]));
    onSelectPony(pony.id);
  };

  // Right Click on Node
  const handleNodeContextMenu = (e: React.MouseEvent, pony: PonyNode) => {
    e.preventDefault();
    e.stopPropagation();

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left - transform.x) / transform.scale;
      const canvasY = (e.clientY - rect.top - transform.y) / transform.scale;

      setContextMenu({
        visible: true,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        ponyId: pony.id,
        canvasX: Math.round(canvasX),
        canvasY: Math.round(canvasY),
      });
      onSelectPony(pony.id);
      setSelectedPonyIds(new Set([pony.id]));
    }
  };

  // Right Click on Canvas Background
  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left - transform.x) / transform.scale;
      const canvasY = (e.clientY - rect.top - transform.y) / transform.scale;

      setContextMenu({
        visible: true,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        ponyId: null,
        canvasX: Math.round(canvasX),
        canvasY: Math.round(canvasY),
      });
    }
  };

  const getPonyCoords = useCallback(
    (pony: PonyNode) => localDragPositions[pony.id] || localViewPositions[pony.id] || { x: pony.x, y: pony.y },
    [localDragPositions, localViewPositions]
  );
  const contextPony = contextMenu.ponyId ? nodeMap.get(contextMenu.ponyId) : undefined;
  const selectedConnection = selectedConnectionId ? connections.find(c => c.id === selectedConnectionId) : undefined;
  const singleSelectedPony = selectedPonyIds.size === 1 ? ponies.find(p => selectedPonyIds.has(p.id)) : null;

  const flowBeamGeometries = useMemo<FlowBeamGeometry[]>(() => {
    const out: FlowBeamGeometry[] = [];
    for (let i = 0; i < visibleFlowBeams.length; i++) {
      const { fromId, toId, sIdx } = visibleFlowBeams[i];
      const pony = nodeMap.get(fromId);
      const recipientPony = nodeMap.get(toId);
      if (!pony || !recipientPony) continue;
      const fromPos = getPonyCoords(pony);
      const toPos = getPonyCoords(recipientPony);
      const distance = Math.hypot(toPos.x - fromPos.x, toPos.y - fromPos.y);
      out.push({
        key: `${fromId}-${toId}-${sIdx}`,
        fromX: fromPos.x,
        fromY: fromPos.y,
        toX: toPos.x,
        toY: toPos.y,
        distance,
        sIdx,
      });
    }
    return out;
  }, [visibleFlowBeams, nodeMap, getPonyCoords]);

  // Calculate flow and recipient stats including cumulative love received per pony
  const flowStats = useMemo(() => {
    return calculateLoveFlowStats(ponies, targetDate, statuses, connections, livePulseTick);
  }, [ponies, targetDate, statuses, connections, livePulseTick]);

  const receivedLoveMap = useMemo(() => {
    const map = new Map<string, { totalReceived: number; dailyReceived: number }>();
    flowStats.forEach(stat => {
      map.set(stat.pony.id, {
        totalReceived: stat.totalReceived,
        dailyReceived: stat.dailyReceived,
      });
    });
    return map;
  }, [flowStats]);

  // Determine maximum received love across network for relative hierarchy scaling
  const maxReceivedLove = useMemo(() => {
    let max = 0;
    flowStats.forEach(s => {
      if (s.totalReceived > max) max = s.totalReceived;
    });
    return max;
  }, [flowStats]);

  // Arrange points into different network layouts:
  // - hierarchy: Ranked by love received (apex/core)
  // - circular: Arranged around an enchanted perimeter circle
  // - web: Connected spiderweb layout around central high-flow hubs
  // - grid: Clean symmetrical alignment
  // - firstLayer: Radial direct connections around focal pony
  const handleArrangeLayout = useCallback((layoutType: 'hierarchy' | 'circular' | 'web' | 'grid' | 'firstLayer' | 'custom') => {
    if (ponies.length === 0) return;

    const centerX = 450;
    const centerY = 300;
    let updatedPonies: PonyNode[] = [];

    if (layoutType === 'custom') {
      let savedPosMap: Record<string, { x: number; y: number }> = {};
      try {
        const saved = localStorage.getItem('pony_network_custom_layout_positions');
        if (saved) savedPosMap = JSON.parse(saved);
      } catch (e) {}

      updatedPonies = ponies.map((p) => {
        const savedPos = savedPosMap[p.id];
        if (savedPos && typeof savedPos.x === 'number' && typeof savedPos.y === 'number') {
          return { ...p, x: savedPos.x, y: savedPos.y };
        }
        return p;
      });
    } else {
      // Sort ponies descending by total love received (most love received = apex/core)
      const sorted = [...ponies].sort((a, b) => {
        const recA = receivedLoveMap.get(a.id)?.totalReceived || 0;
        const recB = receivedLoveMap.get(b.id)?.totalReceived || 0;
        if (recB !== recA) return recB - recA;
        return (b.loveRatePerDay || 0) - (a.loveRatePerDay || 0);
      });

      if (sorted.length === 1) {
        updatedPonies = [{ ...sorted[0], x: centerX, y: centerY }];
      } else if (layoutType === 'firstLayer') {
      const focalId = getUserMainPony(ponies, currentUserId)?.id || sorted[0]?.id;
      const focalPony = sorted.find(p => p.id === focalId) || sorted[0];
      const neighbors = sorted.filter(p => {
        if (p.id === focalPony.id) return false;
        return connections.some(c => (c.source === focalPony.id && c.target === p.id) || (c.target === focalPony.id && c.source === p.id));
      });
      const nonNeighbors = sorted.filter(p => p.id !== focalPony.id && !neighbors.some(n => n.id === p.id));

      const radius = Math.min(260, Math.max(160, neighbors.length * 35));
      const neighborPositions = neighbors.map((p, idx) => {
        const angle = (idx / Math.max(1, neighbors.length)) * 2 * Math.PI - Math.PI / 2;
        return {
          ...p,
          x: Math.round(centerX + Math.cos(angle) * radius),
          y: Math.round(centerY + Math.sin(angle) * radius),
        };
      });

      const outerRadius = radius + 150;
      const nonNeighborPositions = nonNeighbors.map((p, idx) => {
        const angle = (idx / Math.max(1, nonNeighbors.length)) * 2 * Math.PI - Math.PI / 4;
        return {
          ...p,
          x: Math.round(centerX + Math.cos(angle) * outerRadius),
          y: Math.round(centerY + Math.sin(angle) * outerRadius),
        };
      });

      updatedPonies = [
        { ...focalPony, x: centerX, y: centerY },
        ...neighborPositions,
        ...nonNeighborPositions,
      ];
    } else if (layoutType === 'circular') {
      // Circular Orbit: Symmetrical ring
      const radius = sorted.length <= 6 ? 180 : sorted.length <= 12 ? 230 : 280;
      updatedPonies = sorted.map((p, idx) => {
        const angle = (idx / sorted.length) * 2 * Math.PI - Math.PI / 2;
        return {
          ...p,
          x: Math.round(centerX + Math.cos(angle) * radius),
          y: Math.round(centerY + Math.sin(angle) * radius),
        };
      });
    } else if (layoutType === 'web') {
      // Spiderweb / Concentric Hub Layout:
      // Center hub = top pony, with radiating concentric rings
      const hub = sorted[0];
      const rest = sorted.slice(1);
      const innerCount = Math.min(6, rest.length);
      const outerCount = rest.length - innerCount;

      const innerRing = rest.slice(0, innerCount).map((p, idx) => {
        const angle = (idx / innerCount) * 2 * Math.PI - Math.PI / 2;
        return {
          ...p,
          x: Math.round(centerX + Math.cos(angle) * 160),
          y: Math.round(centerY + Math.sin(angle) * 160),
        };
      });

      const outerRing = rest.slice(innerCount).map((p, idx) => {
        const angle = (idx / Math.max(1, outerCount)) * 2 * Math.PI - Math.PI / 4;
        return {
          ...p,
          x: Math.round(centerX + Math.cos(angle) * 290),
          y: Math.round(centerY + Math.sin(angle) * 290),
        };
      });

      updatedPonies = [{ ...hub, x: centerX, y: centerY }, ...innerRing, ...outerRing];
    } else if (layoutType === 'grid') {
      // Symmetrical Matrix Grid
      const cols = Math.ceil(Math.sqrt(sorted.length));
      const colSpacing = 160;
      const rowSpacing = 140;
      const startX = centerX - ((cols - 1) * colSpacing) / 2;
      const rows = Math.ceil(sorted.length / cols);
      const startY = centerY - ((rows - 1) * rowSpacing) / 2;

      updatedPonies = sorted.map((p, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        return {
          ...p,
          x: Math.round(startX + col * colSpacing),
          y: Math.round(startY + row * rowSpacing),
        };
      });
    } else {
      // 'hierarchy': Pyramid or Tiered Orbits
      if (sorted.length <= 4) {
        updatedPonies = sorted.map((p, idx) => {
          if (idx === 0) return { ...p, x: centerX, y: centerY - 140 };
          const subCount = sorted.length - 1;
          const spacing = 220;
          const startX = centerX - ((subCount - 1) * spacing) / 2;
          return {
            ...p,
            x: Math.round(startX + (idx - 1) * spacing),
            y: centerY + 100,
          };
        });
      } else {
        const coreCount = Math.min(2, Math.ceil(sorted.length * 0.25));
        const midCount = Math.min(6, Math.ceil(sorted.length * 0.5));

        updatedPonies = sorted.map((p, idx) => {
          if (idx < coreCount) {
            if (coreCount === 1) return { ...p, x: centerX, y: centerY };
            const angle = (idx / coreCount) * 2 * Math.PI - Math.PI / 2;
            return {
              ...p,
              x: Math.round(centerX + Math.cos(angle) * 75),
              y: Math.round(centerY + Math.sin(angle) * 75),
            };
          } else if (idx < coreCount + midCount) {
            const midIdx = idx - coreCount;
            const angle = (midIdx / midCount) * 2 * Math.PI - Math.PI / 2;
            return {
              ...p,
              x: Math.round(centerX + Math.cos(angle) * 210),
              y: Math.round(centerY + Math.sin(angle) * 210),
            };
          } else {
            const outerIdx = idx - (coreCount + midCount);
            const outerCount = sorted.length - (coreCount + midCount);
            const angle = (outerIdx / outerCount) * 2 * Math.PI - Math.PI / 4;
            return {
              ...p,
              x: Math.round(centerX + Math.cos(angle) * 330),
              y: Math.round(centerY + Math.sin(angle) * 330),
            };
          }
        });
      }
    }
  }

    if (isAdmin) {
      setLocalViewPositions({});
      if (onUpdatePonies) {
        onUpdatePonies(updatedPonies);
      } else {
        updatedPonies.forEach(p => onUpdatePony(p));
      }
    } else {
      // Purely local browser view arrangement for regular users (zero Firebase writes)
      const viewMap: Record<string, { x: number; y: number }> = {};
      updatedPonies.forEach(p => {
        viewMap[p.id] = { x: p.x, y: p.y };
      });
      setLocalViewPositions(viewMap);
    }

    // Auto-center view to fit newly organized layout
    setTransform({
      x: (containerRef.current?.clientWidth || 900) / 2 - centerX,
      y: (containerRef.current?.clientHeight || 600) / 2 - centerY,
      scale: 0.95,
    });
    setIsOrderDropdownOpen(false);
  }, [ponies, isAdmin, currentUserId, connections, receivedLoveMap, onUpdatePonies, onUpdatePony]);

  const isMatch = (pony: PonyNode) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const customMatches = Object.entries(pony.customData || {}).some(
      ([k, v]) => k.toLowerCase().includes(q) || v.toLowerCase().includes(q)
    );
    return (
      pony.name.toLowerCase().includes(q) ||
      pony.species.toLowerCase().includes(q) ||
      pony.element.toLowerCase().includes(q) ||
      pony.location.toLowerCase().includes(q) ||
      pony.notes.toLowerCase().includes(q) ||
      customMatches
    );
  };

  const getConnectionColor = (type: ConnectionType) => {
    switch (type) {
      case 'love-channel': return theme.loveChannelColor || '#f43f5e';
      case 'sisterhood': return theme.sisterhoodColor || '#eab308';
      case 'magical-resonance': return theme.magicalResonanceColor || '#c084fc';
      case 'hive-nexus': return theme.hiveNexusColor || '#10b981';
      case 'friendship': default: return theme.friendshipColor || theme.connectionLineColor || '#06b6d4';
    }
  };

  return (
    <div 
      ref={containerRef}
      onMouseEnter={() => setIsHoveringMap(true)}
      onMouseLeave={() => setIsHoveringMap(false)}
      className={`relative w-full h-[600px] lg:h-[650px] bg-slate-950/90 rounded-2xl border overflow-hidden shadow-2xl backdrop-blur-md select-none ${
        isConnectMode ? 'cursor-crosshair' : ''
      } ${isFullScreen ? 'rounded-none border-0 h-screen w-screen' : ''}`}
      style={{
        borderColor: (theme.transparentAllBorders || theme.transparentMapBorder) ? 'transparent' : theme.borderColor,
        backgroundImage: `
          radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.08) 0%, transparent 60%),
          linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
        `,
        backgroundSize: '100% 100%, 40px 40px, 40px 40px',
      }}
      onWheel={handleWheel}
      onContextMenu={handleCanvasContextMenu}
    >
      {/* Top Left: Ponies & Links Count */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <div 
          className="bg-slate-900/90 px-3 py-1.5 rounded-xl border backdrop-blur-md shadow-lg text-xs font-semibold select-none"
          style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor, color: theme.textColor }}
        >
          {visiblePonies.length} {visiblePonies.length === 1 ? 'pony' : 'ponies'} • {visibleConnections.length} links
        </div>
        {firstLayerOnly && (
          <button
            onClick={() => setFirstLayerOnly(false)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold shadow-md transition-all border cursor-pointer"
            style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
            title="Showing Friends view. Click to show full network."
          >
            <span>Friends</span>
            <span className="font-normal ml-0.5">✕</span>
          </button>
        )}
        {filterMyPonies && (
          <button
            onClick={() => setFilterMyPonies(false)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold shadow-md transition-all border cursor-pointer"
            style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
            title="Showing My Ponies view. Click to show full network."
          >
            <span>My Ponies</span>
            <span className="font-normal ml-0.5">✕</span>
          </button>
        )}
      </div>

      {/* Top Right Controls: Order By Dropdown, Zoom/Reset buttons, Connection Style Toggle, and Add Pony button */}
      <div 
        className="absolute top-4 right-4 z-20 flex flex-wrap items-center gap-2 bg-slate-900/90 p-1.5 rounded-2xl border backdrop-blur-md shadow-2xl theme-border-hover"
        style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
      >
        {/* Single Ordering Button with dropdown options (icon only) */}
        <div className="relative">
          <button
            onClick={() => setIsOrderDropdownOpen(!isOrderDropdownOpen)}
            disabled={ponies.length === 0}
            className="flex items-center gap-1 p-2 rounded-xl font-semibold border text-xs shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            style={{
              backgroundColor: theme.buttonColor,
              color: theme.buttonTextColor,
              borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor
            }}
            title="Order points into Hierarchy, Circular, Matrix, Grid, or Friends layout"
          >
            <LayoutGrid className="w-3.5 h-3.5" style={{ color: theme.buttonTextColor }} />
            <ChevronDown className="w-3 h-3" style={{ color: theme.buttonTextColor }} />
          </button>

          {isOrderDropdownOpen && (
            <div 
              className="absolute right-0 mt-1.5 w-40 bg-slate-900 border rounded-xl shadow-2xl backdrop-blur-xl py-1 text-xs z-50 animate-in fade-in zoom-in-95"
              style={{ borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => handleArrangeLayout('custom')}
                className="w-full text-left px-3 py-2 hover:bg-slate-800/80 font-medium transition-colors"
                style={{ color: theme.textColor }}
              >
                Custom Layout
              </button>
              <button
                onClick={() => handleArrangeLayout('hierarchy')}
                className="w-full text-left px-3 py-2 hover:bg-slate-800/80 font-medium transition-colors"
                style={{ color: theme.textColor }}
              >
                Hierarchy
              </button>
              <button
                onClick={() => handleArrangeLayout('circular')}
                className="w-full text-left px-3 py-2 hover:bg-slate-800/80 font-medium transition-colors"
                style={{ color: theme.textColor }}
              >
                Circular
              </button>
              <button
                onClick={() => handleArrangeLayout('web')}
                className="w-full text-left px-3 py-2 hover:bg-slate-800/80 font-medium transition-colors"
                style={{ color: theme.textColor }}
              >
                Matrix
              </button>
              <button
                onClick={() => handleArrangeLayout('grid')}
                className="w-full text-left px-3 py-2 hover:bg-slate-800/80 font-medium transition-colors"
                style={{ color: theme.textColor }}
              >
                Grid
              </button>
              {adminSettings.allowMyPoniesSort && (
                <button
                  onClick={() => {
                    setFilterMyPonies(prev => !prev);
                    setIsOrderDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 hover:bg-slate-800/80 font-medium transition-colors flex items-center justify-between ${
                    filterMyPonies ? 'font-bold' : ''
                  }`}
                  style={{ color: theme.textColor }}
                >
                  <span>My Ponies</span>
                  {filterMyPonies && <Check className="w-3.5 h-3.5 text-pink-400" />}
                </button>
              )}
              <button
                onClick={() => {
                  setFirstLayerOnly(prev => !prev);
                  if (!firstLayerOnly) handleArrangeLayout('firstLayer');
                  setIsOrderDropdownOpen(false);
                }}
                className={`w-full text-left px-3 py-2 hover:bg-slate-800/80 font-medium transition-colors flex items-center justify-between ${
                  firstLayerOnly ? 'font-bold' : ''
                }`}
                style={{ color: theme.textColor }}
              >
                <span>Friends</span>
                {firstLayerOnly && <Check className="w-3.5 h-3.5 text-pink-400" />}
              </button>
            </div>
          )}
        </div>

        <div className="h-4 w-[1px]" style={{ backgroundColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }} />

        {/* Connection visualization toggle button: direct lines (/) vs full circle (O) */}
        <button
          onClick={() => setConnectionStyle(prev => prev === 'lines' ? 'circle' : 'lines')}
          className="w-7 h-7 flex items-center justify-center rounded-xl font-mono text-xs font-bold border transition-all cursor-pointer hover:opacity-90 shadow-md"
          style={{ 
            backgroundColor: theme.buttonColor, 
            color: theme.buttonTextColor, 
            borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor 
          }}
          title={connectionStyle === 'lines' ? 'Current: Direct Lines (/). Click for Full Circle (O)' : 'Current: Full Circle (O). Click for Direct Lines (/)'}
        >
          {connectionStyle === 'lines' ? '/' : 'O'}
        </button>

        <div className="h-4 w-[1px]" style={{ backgroundColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }} />

        {/* Viewport Zoom Controls */}
        <button
          onClick={() => handleZoom('in')}
          className="p-1.5 rounded-xl border transition-all cursor-pointer hover:opacity-90 shadow-md"
          style={{ 
            backgroundColor: theme.buttonColor, 
            color: theme.buttonTextColor, 
            borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor 
          }}
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" style={{ color: theme.buttonTextColor }} />
        </button>
        <button
          onClick={() => handleZoom('out')}
          className="p-1.5 rounded-xl border transition-all cursor-pointer hover:opacity-90 shadow-md"
          style={{ 
            backgroundColor: theme.buttonColor, 
            color: theme.buttonTextColor, 
            borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor 
          }}
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" style={{ color: theme.buttonTextColor }} />
        </button>
        <div className="h-4 w-[1px]" style={{ backgroundColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }} />

        {/* Full Screen Toggle */}
        <button
          onClick={toggleFullScreen}
          className="p-1.5 rounded-xl border transition-all cursor-pointer hover:opacity-90 shadow-md"
          style={{ 
            backgroundColor: theme.buttonColor, 
            color: theme.buttonTextColor, 
            borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor 
          }}
          title={isFullScreen ? 'Exit Full Screen' : 'Enter Full Screen'}
        >
          <Maximize2 className="w-3.5 h-3.5" style={{ color: theme.buttonTextColor }} />
        </button>

        {canAddPony && (
          <>
            <div className="h-4 w-[1px]" style={{ backgroundColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor }} />

            {/* Add Pony Button */}
            <button
              onClick={() => onOpenAddModal()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-lg border transition-all cursor-pointer"
              style={{ 
                backgroundColor: theme.buttonColor, 
                color: theme.buttonTextColor, 
                borderColor: theme.transparentAllBorders ? 'transparent' : theme.borderColor 
              }}
            >
              <Plus className="w-3.5 h-3.5" style={{ color: theme.buttonTextColor }} />
              Add Pony
            </button>
          </>
        )}
      </div>

      {/* Connect Mode Banner */}
      {isConnectMode && (
        <div className={`absolute top-16 left-1/2 -translate-x-1/2 z-20 bg-pink-600/95 text-white text-xs px-4 py-2 rounded-full border border-pink-300/40 shadow-xl backdrop-blur-md flex items-center gap-2 ${liveFlowAnimationsEnabled ? 'animate-bounce' : ''}`}>
          <Sparkles className="w-4 h-4 text-pink-200" />
          <span>
            {userPony
              ? `Connecting to "${userPony.name}" — Click any pony to connect directly!`
              : 'Click any pony to connect directly to your pony'}
          </span>
          <button 
            onClick={() => {
              setIsConnectMode(false);
              setConnectSourceId(null);
            }}
            className="ml-2 text-pink-200 hover:text-white underline font-semibold"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Empty State Banner */}
      {ponies.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none p-6 text-center">
          <h3 className="text-lg font-bold text-white mb-4">Pony Network</h3>
          {canAddPony && (
            <button
              onClick={() => onOpenAddModal()}
              className="pointer-events-auto flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-lg shadow-pink-600/30 transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Pony
            </button>
          )}
        </div>
      )}

      {/* MAIN SVG CANVAS WORLD */}
      <svg
        className="w-full h-full block"
        style={{ touchAction: 'none' }}
      >
        <defs>
          <filter id="glow-filter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          
          <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <marker id="arrow" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill={theme.loveChannelColor || '#f43f5e'} />
          </marker>
        </defs>

        {/* 1. BACKGROUND PAN RECEIVER RECT - Receives pan clicks only when clicking on empty space! */}
        <rect
          id="canvas-pan-bg-rect"
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="transparent"
          className={isPanning ? 'cursor-grabbing' : 'cursor-grab'}
          onMouseDown={handleCanvasBackgroundMouseDown}
        />

        {/* 2. TRANSFORMED WORLD LAYER */}
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {/* MAP BACKGROUND IMAGE - Anchored to coordinate system */}
          {theme.networkBgImage && (
            <image
              href={theme.networkBgImage}
              x="-1500"
              y="-1000"
              width="3000"
              height="2000"
              preserveAspectRatio="xMidYMid slice"
              opacity="0.85"
              className="pointer-events-none"
            />
          )}

          {/* DIRECTED LOVE FLOW SPLIT BEAMS */}
          {flowBeamGeometries.map((b) => (
            <g key={`flow-${b.key}`} className="pointer-events-none">
              {connectionStyle === 'circle' ? (
                <path
                  d={`M ${b.fromX} ${b.fromY} A ${b.distance / 2} ${b.distance / 2} 0 0 1 ${b.toX} ${b.toY}`}
                  fill="none"
                  stroke={theme.loveChannelColor || '#f43f5e'}
                  strokeWidth="3.5"
                  strokeDasharray="6 3"
                  strokeOpacity="0.75"
                  filter="url(#glow-filter)"
                  markerEnd="url(#arrow)"
                />
              ) : (
                <line
                  x1={b.fromX}
                  y1={b.fromY}
                  x2={b.toX}
                  y2={b.toY}
                  stroke={theme.loveChannelColor || '#f43f5e'}
                  strokeWidth="3.5"
                  strokeDasharray="6 3"
                  strokeOpacity="0.75"
                  filter="url(#glow-filter)"
                  markerEnd="url(#arrow)"
                />
              )}
            </g>
          ))}

          {/* ISOLATED 30FPS ANIMATED LOVE FLOW PARTICLES (prevents full SVG tree re-renders) */}
          <FlowParticlesLayer
            enabled={liveFlowAnimationsEnabled}
            beams={flowBeamGeometries}
            connectionStyle={connectionStyle}
          />

          {/* REGULAR WEB CONNECTIONS */}
          {visibleConnections.map(conn => {
            const sourcePony = nodeMap.get(conn.source);
            const targetPony = nodeMap.get(conn.target);
            if (!sourcePony || !targetPony) return null;

            const srcPos = getPonyCoords(sourcePony);
            const tgtPos = getPonyCoords(targetPony);
            const isSelected = selectedConnectionId === conn.id;
            const strokeColor = getConnectionColor(conn.connectionType);
            const strokeWidth = Math.max(2, conn.strength * 1.5);

            const dx = tgtPos.x - srcPos.x;
            const dy = tgtPos.y - srcPos.y;
            const dist = Math.hypot(dx, dy);
            const midX = (srcPos.x + tgtPos.x) / 2;
            const midY = (srcPos.y + tgtPos.y) / 2;
            const radius = dist / 2;

            return (
              <g 
                key={conn.id} 
                className="cursor-pointer group"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setSelectedConnectionId(conn.id);
                  onSelectPony(null);
                  setSelectedPonyIds(new Set());
                }}
              >
                {connectionStyle === 'circle' ? (
                  <>
                    <circle
                      cx={midX}
                      cy={midY}
                      r={radius}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={24}
                    />
                    <circle
                      cx={midX}
                      cy={midY}
                      r={radius}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeOpacity={isSelected ? 1 : 0.6}
                      className="group-hover:stroke-white transition-all duration-300"
                    />
                  </>
                ) : (
                  <>
                    <line
                      x1={srcPos.x}
                      y1={srcPos.y}
                      x2={tgtPos.x}
                      y2={tgtPos.y}
                      stroke="transparent"
                      strokeWidth={24}
                    />
                    <line
                      x1={srcPos.x}
                      y1={srcPos.y}
                      x2={tgtPos.x}
                      y2={tgtPos.y}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeOpacity={isSelected ? 1 : 0.6}
                      className="group-hover:stroke-white transition-all duration-300"
                    />
                  </>
                )}
              </g>
            );
          })}

          {/* PONY NODES (Top-most in SVG, receive pointer events first!) */}
          {visiblePonies.map(pony => {
            const isSelected = selectedPonyIds.has(pony.id);
            const isConnectSource = connectSourceId === pony.id;
            const matchesSearch = isMatch(pony);

            // Total cumulative love received by this pony point
            const receivedData = receivedLoveMap.get(pony.id) || { totalReceived: 0, dailyReceived: 0 };
            const totalReceived = receivedData.totalReceived;

            // Is this pony the top receiver (Apex of hierarchy)?
            const isApexReceiver = maxReceivedLove > 0 && totalReceived === maxReceivedLove;

            // Dynamic hierarchy radius: points always scale by love received by default (more love = larger, more prominent point)
            let radius = 34;
            if (maxReceivedLove > 0) {
              const ratio = totalReceived / maxReceivedLove;
              radius = Math.round(30 + ratio * 16); // Scales from 30px to 46px
            }

            const nodeOpacity = 1;

            const isTransparentMapBorders = !!(theme.transparentAllBorders || theme.transparentMapBorder);

            // Theme-compliant ring / border colors
            const nodeBorderColor = isTransparentMapBorders
              ? 'transparent'
              : isSelected
              ? (theme.borderHoverColor || theme.buttonColor || theme.borderColor || '#ec4899')
              : isConnectSource
              ? (theme.buttonColor || '#ec4899')
              : isApexReceiver
              ? (theme.borderHoverColor || theme.buttonColor || theme.borderColor || '#a855f7')
              : (theme.borderColor || '#a855f7');

            const equippedBorderColor = isTransparentMapBorders
              ? 'transparent'
              : pony.customData?.equippedBorder === 'rainbow-glow'
              ? (theme.rainbowGlowColor || theme.borderEffectColor || '#ec4899')
              : (theme.borderEffectColor || theme.rainbowGlowColor || theme.borderHoverColor || theme.borderColor || '#ec4899');

            const nodeCoords = getPonyCoords(pony);

            return (
              <g
                key={pony.id}
                id={`pony-node-${pony.id}`}
                transform={`translate(${nodeCoords.x}, ${nodeCoords.y})`}
                className="cursor-pointer group"
                opacity={nodeOpacity}
                onMouseDown={(e) => handleNodeMouseDown(e, pony)}
                onClick={(e) => handleNodeClick(e, pony)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onOpenFullDetailModal(pony.id);
                }}
                onContextMenu={(e) => handleNodeContextMenu(e, pony)}
              >
                {/* Aura Ring for Selected, Connect Source, or Apex Nodes */}
                {(isSelected || isConnectSource || isApexReceiver || (searchQuery.trim() && matchesSearch)) && !isTransparentMapBorders && (
                  <circle
                    r={radius + 16}
                    fill="none"
                    stroke={nodeBorderColor}
                    strokeWidth={isSelected ? 3.5 : 2.5}
                    strokeDasharray={isSelected ? '6 4' : '8 4'}
                    className={liveFlowAnimationsEnabled ? 'animate-spin' : ''}
                    style={liveFlowAnimationsEnabled ? { animationDuration: isApexReceiver ? '6s' : '9s' } : undefined}
                    opacity={0.9}
                  />
                )}

                {/* Glow */}
                {!isTransparentMapBorders && (
                  <circle
                    r={radius + 8}
                    fill={nodeBorderColor}
                    opacity={isSelected ? 0.45 : isApexReceiver ? 0.35 : 0.15}
                    filter="url(#node-glow)"
                  />
                )}

                {/* Equipped Custom Profile Border Ring */}
                {pony.customData?.equippedBorder && !isTransparentMapBorders && (
                  <circle
                    r={radius + 5}
                    fill="none"
                    stroke={equippedBorderColor}
                    strokeWidth="3.5"
                    strokeDasharray="6 3"
                    className={liveFlowAnimationsEnabled ? 'animate-spin' : ''}
                    style={liveFlowAnimationsEnabled ? { animationDuration: '10s' } : undefined}
                  />
                )}

                {/* Base Node Disc */}
                <circle
                  r={radius}
                  fill={theme.bgColor || '#0f172a'}
                  stroke={nodeBorderColor}
                  strokeWidth={isSelected ? 4 : isApexReceiver ? 3.5 : 2.5}
                  className="transition-all duration-150 group-hover:scale-105"
                />

                {/* Avatar Icon (Image or Emoji/Emoticon) */}
                {pony.avatarIcon && pony.avatarIcon.startsWith('data:image') ? (
                  <>
                    <defs>
                      <clipPath id={`clip-${pony.id}`}>
                        <circle cx="0" cy="0" r={radius - 2} />
                      </clipPath>
                    </defs>
                    <image
                      x={-radius + 2}
                      y={-radius + 2}
                      width={(radius - 2) * 2}
                      height={(radius - 2) * 2}
                      href={pony.avatarIcon}
                      clipPath={`url(#clip-${pony.id})`}
                      preserveAspectRatio="xMidYMid slice"
                      className="select-none pointer-events-none"
                    />
                  </>
                ) : (
                  (() => {
                    const iconStr = pony.avatarIcon || '💖';
                    const codeLen = [...iconStr].length;
                    const svgFontSize =
                      codeLen >= 4 ? '12' : codeLen >= 2 ? '16' : radius > 38 ? '25' : '22';
                    return (
                      <text
                        x="0"
                        y={codeLen >= 2 ? '4' : '6'}
                        textAnchor="middle"
                        fill={theme.textColor || '#f1f5f9'}
                        fontSize={svgFontSize}
                        fontWeight={codeLen >= 2 ? '700' : '400'}
                        className="select-none pointer-events-none"
                      >
                        {iconStr}
                      </text>
                    );
                  })()
                )}

                {/* Name Label Badge (Clicking directly opens profile modal) */}
                <g 
                  transform={`translate(0, ${radius + 18})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPony(pony.id);
                    setSelectedPonyIds(new Set([pony.id]));
                    onOpenFullDetailModal(pony.id);
                  }}
                >
                  <rect
                    x="-68"
                    y="-12"
                    width="136"
                    height="24"
                    rx="12"
                    fill={theme.bgColor ? `${theme.bgColor}f0` : '#0f172a'}
                    stroke={nodeBorderColor}
                    strokeWidth={isSelected ? '2' : '1'}
                    className="shadow-md transition-colors"
                  />
                  <text
                    x="0"
                    y="3"
                    textAnchor="middle"
                    fill={theme.textColor}
                    fontSize="11"
                    fontWeight="700"
                    className="select-none pointer-events-none font-sans"
                  >
                    {pony.name.length > 16 ? pony.name.slice(0, 15) + '…' : pony.name}
                  </text>
                </g>

                {/* Sub-badge: Total Love Cumulatively Received on this point! */}
                <g transform={`translate(0, ${radius + 38})`}>
                  <rect
                    x="-45"
                    y="-9"
                    width="90"
                    height="18"
                    rx="9"
                    fill={theme.bgColor ? `${theme.bgColor}e0` : '#1e1b4b'}
                    stroke={isTransparentMapBorders ? 'transparent' : (theme.borderColor || '#a855f7')}
                    strokeWidth="1.2"
                    opacity={0.95}
                  />
                  <text
                    x="0"
                    y="4"
                    textAnchor="middle"
                    fill={theme.textColor || '#f1f5f9'}
                    fontSize="10"
                    fontWeight="800"
                    className="select-none pointer-events-none font-sans tracking-wide"
                  >
                    {(pony.totalOverallLove ? Math.round(pony.totalOverallLove) : totalReceived).toLocaleString()}
                  </text>
                </g>
              </g>
            );
          })}
        </g>
      </svg>

      {/* FLOATING SELECTED PONY INSPECTOR CARD */}
      {singleSelectedPony && (
        <div 
          className="absolute bottom-4 left-4 z-20 w-80 border rounded-2xl p-4 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 text-xs theme-border-hover overflow-hidden transition-colors"
          style={{ 
            borderColor: theme.transparentAllBorders ? 'transparent' : (singleSelectedPony.profileBorderColor || theme.borderColor),
            backgroundColor: singleSelectedPony.profileBgImage ? 'transparent' : '#0f172a'
          }}
        >
          {singleSelectedPony.profileBgImage && (
            <div 
              className="absolute inset-0 z-0 opacity-30 pointer-events-none"
              style={{ 
                backgroundImage: `url(${singleSelectedPony.profileBgImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
          )}
          
          <div className="relative z-10 flex items-center justify-between pb-2.5 border-b" style={{ borderColor: theme.transparentAllBorders ? 'transparent' : (singleSelectedPony.profileBorderColor || theme.borderColor) }}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenFullDetailModal(singleSelectedPony.id)}
                className="cursor-pointer hover:scale-105 transition-transform shrink-0"
                title={`Open ${singleSelectedPony.name}'s profile`}
              >
                {singleSelectedPony.avatarIcon && (singleSelectedPony.avatarIcon.startsWith('data:image') || singleSelectedPony.avatarIcon.startsWith('http')) ? (
                  <img 
                    src={singleSelectedPony.avatarIcon} 
                    alt={singleSelectedPony.name} 
                    className="w-10 h-10 rounded-xl bg-slate-800 border object-cover shadow-lg"
                    style={{ borderColor: theme.borderColor }}
                  />
                ) : (
                  <span className="text-2xl">{singleSelectedPony.avatarIcon || '💖'}</span>
                )}
              </button>
              <div>
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => onOpenFullDetailModal(singleSelectedPony.id)}
                    className="text-sm block leading-tight font-bold hover:underline transition-colors text-left"
                    style={{ color: singleSelectedPony.profileTextColor || theme.textColor }}
                  >
                    {singleSelectedPony.name}
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedPonyIds(new Set());
                onSelectPony(null);
              }}
              className="hover:opacity-100 opacity-60 p-1 rounded-lg hover:bg-slate-800"
              style={{ color: singleSelectedPony.profileTextColor || theme.textColor }}
            >
              ✕
            </button>
          </div>

          <div className="relative z-10 mt-2.5 space-y-1.5" style={{ color: singleSelectedPony.profileTextColor || theme.textColor }}>
            <div className="flex justify-between items-center text-[11px]">
              <span className="opacity-70">Total Overall Love:</span>
              <strong className="font-bold">
                {Math.round(singleSelectedPony.totalOverallLove || (receivedLoveMap.get(singleSelectedPony.id)?.totalReceived || 0)).toLocaleString()} Love
              </strong>
            </div>

            <div className="flex justify-between items-center text-[11px]">
              <span className="opacity-70">Connections:</span>
              <span className="font-semibold">
                {connections.filter(c => c.source === singleSelectedPony.id || c.target === singleSelectedPony.id).length}
              </span>
            </div>
          </div>

          <div className="relative z-10 mt-3 pt-2.5 border-t flex items-center gap-1.5" style={{ borderColor: theme.transparentAllBorders ? 'transparent' : (singleSelectedPony.profileBorderColor || theme.borderColor) }}>
            <button
              onClick={() => onOpenFullDetailModal(singleSelectedPony.id)}
              className="flex-1 py-1.5 px-2 rounded-xl font-bold text-xs flex items-center justify-center shadow-md transition-all border cursor-pointer theme-border-hover"
              style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.borderColor }}
            >
              <span>Profile</span>
            </button>

            {(() => {
              const myPonyId = currentUserPonyId || userPony?.id;
              const isMyPony = isOwner(singleSelectedPony);
              const isConnectedToUser = myPonyId
                ? connections.some(c => (c.source === myPonyId && c.target === singleSelectedPony.id) || (c.target === myPonyId && c.source === singleSelectedPony.id))
                : false;

              if (isMyPony) {
                return (
                  <div
                    className="flex-1 py-1.5 px-2 rounded-xl font-bold text-xs flex items-center justify-center shadow-md select-none border"
                    style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.borderColor }}
                    title="You own this pony"
                  >
                    <span>Owned</span>
                  </div>
                );
              }

              if (isConnectedToUser) {
                return (
                  <div
                    className="flex-1 py-1.5 px-2 rounded-xl bg-slate-900 border text-xs font-bold flex items-center justify-center select-none"
                    style={{ borderColor: theme.borderColor, color: theme.textColor }}
                    title={`Connected directly to ${userPony?.name || 'your pony'}`}
                  >
                    <span>Connected</span>
                  </div>
                );
              }

              if (!currentUserId || !myPonyId) {
                return null;
              }

              return (
                <button
                  onClick={() => {
                    if (myPonyId && myPonyId !== singleSelectedPony.id) {
                      onCreateConnection(myPonyId, singleSelectedPony.id, 'friendship');
                    }
                  }}
                  className="flex-1 py-1.5 px-2 rounded-xl font-bold text-xs flex items-center justify-center shadow-md transition-all border cursor-pointer theme-border-hover"
                  style={{ backgroundColor: theme.buttonColor, color: theme.buttonTextColor, borderColor: theme.borderColor }}
                  title={`Connect directly to ${userPony?.name || 'your pony'}`}
                >
                  <span>Connect</span>
                </button>
              );
            })()}
          </div>
        </div>
      )}

      {/* RIGHT-CLICK CONTEXT MENU */}
      {contextMenu.visible && (
        <div
          className="absolute z-50 bg-slate-900/95 border border-purple-500/40 rounded-xl py-1.5 shadow-2xl backdrop-blur-xl text-xs w-48 animate-in fade-in zoom-in-95 duration-100"
          style={{
            left: Math.min(contextMenu.x, (containerRef.current?.clientWidth || 500) - 200),
            top: Math.min(contextMenu.y, (containerRef.current?.clientHeight || 400) - 200),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextPony ? (
            <>
              <div className="px-3 py-1.5 border-b border-purple-500/20 text-[11px] font-bold text-pink-300 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded flex items-center justify-center shrink-0 overflow-hidden bg-slate-900 border border-slate-800" style={{ borderColor: theme.borderColor }}>
                  {contextPony.avatarIcon && contextPony.avatarIcon.startsWith('data:image') ? (
                    <img src={contextPony.avatarIcon} alt="" className="w-full h-full object-cover" />
                  ) : (
                    contextPony.avatarIcon
                  )}
                </span>
                <span className="truncate">{contextPony.name}</span>
              </div>

              <button
                onClick={() => {
                  setContextMenu(prev => ({ ...prev, visible: false }));
                  onSelectPony(contextPony.id);
                  onOpenFullDetailModal(contextPony.id);
                }}
                className="w-full px-3 py-2 text-left hover:bg-purple-950/60 text-slate-200 hover:text-white flex items-center gap-2"
              >
                <span>Profile</span>
              </button>

              {/* Make Connection: Connect directly to user's pony */}
              {(() => {
                const myPonyId = currentUserPonyId || userPony?.id;
                const isMyPony = isOwner(contextPony);
                const isAlreadyConnected = myPonyId 
                  ? connections.some(c => (c.source === myPonyId && c.target === contextPony.id) || (c.target === myPonyId && c.source === contextPony.id))
                  : false;

                if (isMyPony) {
                  return (
                    <div className="w-full px-3 py-2 text-left text-amber-400 select-none opacity-80 text-xs font-bold">
                      <span>Owned</span>
                    </div>
                  );
                }

                if (isAlreadyConnected) {
                  return (
                    <div className="w-full px-3 py-2 text-left text-emerald-400 select-none opacity-80 text-xs font-bold">
                      <span>Connected</span>
                    </div>
                  );
                }

                if (!currentUserId || !myPonyId) {
                  return null;
                }

                return (
                  <button
                    onClick={() => {
                      setContextMenu(prev => ({ ...prev, visible: false }));
                      if (myPonyId && myPonyId !== contextPony.id) {
                        onCreateConnection(myPonyId, contextPony.id, 'friendship');
                      }
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-purple-950/60 text-cyan-300 hover:text-white flex items-center gap-2 font-bold"
                  >
                    <span>Connect</span>
                  </button>
                );
              })()}



              {/* Delete Pony: only available when pony is owned by the user */}
              {isOwner(contextPony) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const targetPony = contextPony;
                    setContextMenu(prev => ({ ...prev, visible: false }));
                    if (targetPony) {
                      setPonyPendingDelete(targetPony);
                    }
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-red-950/70 text-red-400 hover:text-red-200 flex items-center gap-2 cursor-pointer font-semibold transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  Delete Pony
                </button>
              )}
            </>
          ) : (
            <>
              {canAddPony && (
                <button
                  onClick={() => {
                    setContextMenu(prev => ({ ...prev, visible: false }));
                    onOpenAddModal({ x: contextMenu.canvasX, y: contextMenu.canvasY });
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-purple-950/60 text-slate-200 hover:text-white flex items-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5 text-pink-400" />
                  Add Pony Here
                </button>
              )}

              <button
                onClick={() => {
                  setContextMenu(prev => ({ ...prev, visible: false }));
                  handleResetView();
                }}
                className="w-full px-3 py-2 text-left hover:bg-purple-950/60 text-slate-200 hover:text-white flex items-center gap-2"
              >
                <Maximize2 className="w-3.5 h-3.5 text-purple-400" />
                Reset View
              </button>
            </>
          )}
        </div>
      )}

      {/* CONNECTION CHANNEL INFO CARD */}
      {selectedConnection && (
        <div className="absolute bottom-4 right-4 z-20 w-72 bg-slate-900/95 border border-cyan-500/40 rounded-xl p-4 shadow-2xl backdrop-blur-md animate-in fade-in text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-cyan-500/20">
            <span className="font-bold text-cyan-300 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5" />
              Connection Channel
            </span>
            <button
              onClick={() => setSelectedConnectionId(null)}
              className="text-slate-400 hover:text-slate-200"
            >
              ✕
            </button>
          </div>
          <div className="mt-2 text-slate-300 space-y-1.5">
            <p>
              <span className="text-slate-400">From:</span> <strong className="text-pink-300">{nodeMap.get(selectedConnection.source)?.name}</strong>
            </p>
            <p>
              <span className="text-slate-400">To:</span> <strong className="text-pink-300">{nodeMap.get(selectedConnection.target)?.name}</strong>
            </p>
            {(Boolean(currentUserId) && (isAdmin || isOwner(nodeMap.get(selectedConnection.source)) || isOwner(nodeMap.get(selectedConnection.target)))) && (
              <button
                onClick={() => {
                  setConnectionPendingDelete(selectedConnection);
                }}
                className="w-full mt-3 py-1.5 rounded-lg bg-red-900/30 hover:bg-red-800/50 text-red-300 border border-red-700/40 flex items-center justify-center gap-1.5"
              >
                <Unlink className="w-3.5 h-3.5" />
                Sever Connection Link
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* IN-APP CONFIRMATION MODAL FOR DELETING CONNECTION */}
      {connectionPendingDelete && (
        <AdminConfirmModal
          isOpen={!!connectionPendingDelete}
          onClose={() => setConnectionPendingDelete(null)}
          type="delete"
          title="Sever Friendship"
          message="Are you sure you want to sever this friendship connection? This action is permanent."
          onConfirm={() => {
            onDeleteConnection(connectionPendingDelete.id);
            setSelectedConnectionId(null);
          }}
          entityName={`${nodeMap.get(connectionPendingDelete.source)?.name} & ${nodeMap.get(connectionPendingDelete.target)?.name}`}
        />
      )}

      {/* IN-APP CONFIRMATION MODAL FOR DELETING PONY */}
      {ponyPendingDelete && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in"
          onClick={() => setPonyPendingDelete(null)}
        >
          <div 
            className="w-full max-w-sm bg-slate-900 border border-red-500/50 rounded-2xl p-5 shadow-2xl animate-in zoom-in-95 text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-red-400 mb-3">
              <div className="p-2 rounded-xl bg-red-950/80 border border-red-500/30">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Delete Pony Node?</h4>
                <p className="text-[11px] text-slate-400">This action cannot be undone.</p>
              </div>
            </div>

            <div className="my-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-2.5">
              <span className="text-2xl">{ponyPendingDelete.avatarIcon}</span>
              <div>
                <strong className="text-white text-xs block">{ponyPendingDelete.name}</strong>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Are you sure you want to remove <strong className="text-white font-bold">{ponyPendingDelete.name}</strong> from the network web? All associated love channel links and splits will be severed.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPonyPendingDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const idToDelete = ponyPendingDelete.id;
                  setPonyPendingDelete(null);
                  setSelectedPonyIds(new Set());
                  onSelectPony(null);
                  onDeletePony(idToDelete);
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-red-600/30 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Yes, Delete Pony
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
