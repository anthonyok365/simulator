import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useThreeScene } from './hooks/useThreeScene';
import { INV_MIN_V, INV_MAX_V, OWNER, GROUP, ZONES, LABEL_MAP, NICE_NAMES } from './utils/constants';
import { 
  PANEL_CATALOG, 
  CONTROLLER_SPEC, 
  getManufacturers, 
  getProducts, 
  getProductSpecs,
  computeArray,
  DEFAULT_SELECTION 
} from './utils/panelCatalog';

function App() {
  const [placed, setPlaced] = useState({
    panel: false,
    controller: false,
    battery: false,
    inverter: false
  });
  const [destroyed, setDestroyed] = useState({
    controller: false,
    battery: false,
    inverter: false
  });
  const [connections, setConnections] = useState([]);
  const [selectedTerminal, setSelectedTerminal] = useState(null);
  const [noted, setNoted] = useState(new Set());
  const [scenario, setScenario] = useState('');
  const [logs, setLogs] = useState([]);
  const [flashActive, setFlashActive] = useState(false);
  const [flashGood, setFlashGood] = useState(false);
  const [wasFullyCorrect, setWasFullyCorrect] = useState(false);

  // Panel selection state
  const [panelSelection, setPanelSelection] = useState(DEFAULT_SELECTION);
  const [panelSelectionStep, setPanelSelectionStep] = useState(0); // 0=manufacturer, 1=wattage, 2=counts
  const [panelDestroyed, setPanelDestroyed] = useState(false);

  const downPosRef = useRef(null);
  const downTimeRef = useRef(0);

  const {
    canvasRef,
    badgeText,
    isEmpty,
    placeComponent,
    terminalWorldPos,
    drawWires,
    fireExplosion,
    celebrate,
    updateIndicators,
    fullReset,
    handleTerminalTap,
    selectTerminal,
    deselectTerminal,
    resetTerminal
  } = useThreeScene();

  // Get current panel specs
  const currentSpecs = useMemo(() => {
    return getProductSpecs(panelSelection.manufacturer, panelSelection.wattage);
  }, [panelSelection.manufacturer, panelSelection.wattage]);

  // Compute array values
  const arrayValues = useMemo(() => {
    if (!currentSpecs) return null;
    return computeArray(currentSpecs, panelSelection.seriesCount, panelSelection.parallelCount);
  }, [currentSpecs, panelSelection.seriesCount, panelSelection.parallelCount]);

  const arrayVoc = useCallback(() => {
    if (!arrayValues) return 0;
    return arrayValues.stringVoc;
  }, [arrayValues]);

  const isConnected = useCallback((a, b) =>
    connections.some(c => (c.a === a && c.b === b) || (c.a === b && c.b === a)),
    [connections]
  );

  const hasEdgeBetweenGroups = useCallback((g1, g2) =>
    connections.some(c =>
      (g1.includes(c.a) && g2.includes(c.b)) ||
      (g1.includes(c.b) && g2.includes(c.a))
    ),
    [connections]
  );

  const isTerminalDestroyed = useCallback((id) => destroyed[OWNER[id]], [destroyed]);

  const keyOf = useCallback((c) => [c.a, c.b].sort().join('|'), []);

  const log = useCallback((tag, message, detail = null) => {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setLogs(prev => [{ time, tag, message, detail }, ...prev]);
  }, []);

  const note = useCallback((k, message, detail) => {
    if (noted.has(k)) return;
    setNoted(prev => new Set([...prev, k]));
    log('PROTECTED', message, detail);
  }, [noted, log]);

  const triggerFlash = useCallback((isGood = false) => {
    setFlashActive(true);
    setFlashGood(isGood);
    setTimeout(() => setFlashActive(false), 350);
  }, []);

  const setGauge = useCallback((pct, word, color) => {
    // This is handled in the render
  }, []);

  const handlePlaced = useCallback((type) => {
    setPlaced(prev => ({ ...prev, [type]: true }));
    log('INFO', `${NICE_NAMES[type]} placed on the pad.`);
    validate();
  }, [log]);

  const validate = useCallback(() => {
    if (!currentSpecs || !arrayValues) return;

    // Check 1: Panel max system voltage (independent of wiring)
    // This runs even if panel isn't connected to anything
    if (!panelDestroyed && arrayValues.stringVoc > currentSpecs.maxSystemVoltage) {
      setPanelDestroyed(true);
      triggerFlash(false);
      log('FAULT', `The panel array just failed.`,
        `This string produces ${arrayValues.stringVoc}V — the ${currentSpecs.model} is only rated for ${currentSpecs.maxSystemVoltage}V. Exceeding a panel's own system voltage rating breaks down its internal insulation, regardless of what it's connected to.`);
      return;
    }

    // Check for panel -> inverter direct connection
    if (!destroyed.inverter && placed.panel && placed.inverter && hasEdgeBetweenGroups(GROUP.panel, GROUP.inverter)) {
      fireExplosion('inverter', (key) => {
        setDestroyed(prev => ({ ...prev, [key]: true }));
        triggerFlash(false);
        log('FAULT', `The inverter just blew up.`,
          `The panel's ${arrayVoc()}V went straight into the inverter, which only tolerates ${INV_MIN_V}–${INV_MAX_V}V. The controller exists to prevent exactly this.`);
        setTimeout(() => validate(), 100);
      });
      return;
    }

    // Check for panel -> battery direct connection
    if (!destroyed.battery && placed.panel && placed.battery && hasEdgeBetweenGroups(GROUP.panel, GROUP.battery)) {
      fireExplosion('battery', (key) => {
        setDestroyed(prev => ({ ...prev, [key]: true }));
        triggerFlash(false);
        log('FAULT', `The battery just overheated and failed.`,
          `The panel's ${arrayVoc()}V flooded a 12V battery with no regulation in between. Skipping the controller removed its only protection.`);
        setTimeout(() => validate(), 100);
      });
      return;
    }

    // Check controller PV connections
    if (!destroyed.controller) {
      const pvCorrect = isConnected('p_pos', 'c_pv_pos') && isConnected('p_neg', 'c_pv_neg');
      const pvReversed = isConnected('p_pos', 'c_pv_neg') && isConnected('p_neg', 'c_pv_pos');
      
      if (pvCorrect || pvReversed) {
        // Check 2: Controller voltage overload (existing rule)
        const ctrlMaxVoc = CONTROLLER_SPEC.smartsolar_100_30.maxPvVoc;
        if (arrayValues.stringVoc > ctrlMaxVoc) {
          fireExplosion('controller', (key) => {
            setDestroyed(prev => ({ ...prev, [key]: true }));
            triggerFlash(false);
            log('FAULT', `The charge controller just blew up.`,
              `${panelSelection.seriesCount} panels chained together produce ${arrayValues.stringVoc}V — this controller tops out at ${ctrlMaxVoc}V.`);
            setTimeout(() => validate(), 100);
          });
          return;
        }
        
        // Check 3: Controller current overload (new rule)
        const ctrlMaxIsc = CONTROLLER_SPEC.smartsolar_100_30.maxPvIsc;
        if (arrayValues.arrayIsc > ctrlMaxIsc) {
          fireExplosion('controller', (key) => {
            setDestroyed(prev => ({ ...prev, [key]: true }));
            triggerFlash(false);
            log('FAULT', `The charge controller just blew up.`,
              `${panelSelection.parallelCount} parallel string${panelSelection.parallelCount > 1 ? 's' : ''} produce ${arrayValues.arrayIsc}A — this controller's PV input maxes out at ${ctrlMaxIsc}A.`);
            setTimeout(() => validate(), 100);
          });
          return;
        }
        
        if (pvReversed) {
          note('pv-rev', `Good news — nothing broke.`,
            `You crossed + and − going into the controller, but it's built to detect that and shut itself off safely.`);
        }
      }
    }

    // Check battery reversed
    if (!destroyed.controller && !destroyed.battery) {
      const batReversed = isConnected('c_bat_pos', 'b_neg') && isConnected('c_bat_neg', 'b_pos');
      if (batReversed) {
        note('bat-rev', `Also protected — no damage here.`,
          `Battery wires crossed going out of the controller. An internal fuse opens automatically.`);
      }
    }

    // Check inverter reversed
    if (!destroyed.inverter && !destroyed.battery) {
      const invReversed = isConnected('b_pos', 'i_neg') && isConnected('b_neg', 'i_pos');
      if (invReversed) {
        fireExplosion('inverter', (key) => {
          setDestroyed(prev => ({ ...prev, [key]: true }));
          triggerFlash(false);
          log('FAULT', `The inverter just blew up.`,
            `Battery + and − were swapped going into the inverter. This input has no reverse-polarity protection — it fails instantly.`);
          setTimeout(() => validate(), 100);
        });
        return;
      }
    }

    // Check fully correct
    const ctrlMaxVoc = CONTROLLER_SPEC.smartsolar_100_30.maxPvVoc;
    const fullyCorrect =
      placed.panel && !panelDestroyed && placed.controller && placed.battery && placed.inverter &&
      isConnected('p_pos', 'c_pv_pos') && isConnected('p_neg', 'c_pv_neg') &&
      isConnected('c_bat_pos', 'b_pos') && isConnected('c_bat_neg', 'b_neg') &&
      isConnected('b_pos', 'i_pos') && isConnected('b_neg', 'i_neg') &&
      arrayValues.stringVoc <= ctrlMaxVoc &&
      !destroyed.controller && !destroyed.battery && !destroyed.inverter;

    // Compute wire status
    const liveWires = new Set();
    const blockedWires = new Set();
    
    if (fullyCorrect) {
      [['p_pos', 'c_pv_pos'], ['p_neg', 'c_pv_neg'], ['c_bat_pos', 'b_pos'],
       ['c_bat_neg', 'b_neg'], ['b_pos', 'i_pos'], ['b_neg', 'i_neg']].forEach(pr =>
        liveWires.add([pr[0], pr[1]].sort().join('|'))
      );
    }
    
    connections.forEach(c => {
      const rev1 =
        (c.a === 'p_pos' && c.b === 'c_pv_neg') ||
        (c.a === 'c_pv_neg' && c.b === 'p_pos') ||
        (c.a === 'p_neg' && c.b === 'c_pv_pos') ||
        (c.a === 'c_pv_pos' && c.b === 'p_neg');
      const rev2 =
        (c.a === 'c_bat_pos' && c.b === 'b_neg') ||
        (c.a === 'b_neg' && c.b === 'c_bat_pos') ||
        (c.a === 'c_bat_neg' && c.b === 'b_pos') ||
        (c.a === 'b_pos' && c.b === 'c_bat_neg');
      if ((rev1 || rev2) && !isTerminalDestroyed(c.a) && !isTerminalDestroyed(c.b)) {
        blockedWires.add(keyOf(c));
      }
    });

    // Draw wires
    drawWires(connections, destroyed, liveWires, blockedWires);
    updateIndicators(destroyed, fullyCorrect);

    // Celebrate
    if (fullyCorrect && !wasFullyCorrect) {
      celebrate();
      triggerFlash(true);
      log('OK', `Everything is wired correctly. The system is live.`,
        `Panel → controller → battery → inverter, all matched + to + and − to −, within every rated limit.`);
    }
    setWasFullyCorrect(fullyCorrect);
  }, [
    destroyed, placed, connections, panelSelection, panelDestroyed, noted, wasFullyCorrect,
    isConnected, hasEdgeBetweenGroups, isTerminalDestroyed, keyOf,
    fireExplosion, note, log, arrayValues, currentSpecs,
    drawWires, updateIndicators, celebrate, triggerFlash
  ]);

  // Handle terminal tap
  const onTerminalTap = useCallback((id, mesh) => {
    if (isTerminalDestroyed(id)) {
      log('INFO', `That part is destroyed — you can't wire it anymore.`,
        `Hit "Start over" to reset the pad.`);
      return;
    }
    
    if (!selectedTerminal) {
      setSelectedTerminal(id);
      selectTerminal(id);
      return;
    }
    
    if (selectedTerminal === id) {
      setSelectedTerminal(null);
      deselectTerminal(id);
      return;
    }
    
    setConnections(prev =>
      prev.filter(c => c.a !== selectedTerminal && c.b !== selectedTerminal && c.a !== id && c.b !== id)
        .concat({ a: selectedTerminal, b: id })
    );
    log('INFO', `Connected ${LABEL_MAP[selectedTerminal]} to ${LABEL_MAP[id]}.`);
    resetTerminal(selectedTerminal);
    setSelectedTerminal(null);
    setTimeout(() => validate(), 50);
  }, [selectedTerminal, isTerminalDestroyed, log, selectTerminal, deselectTerminal, resetTerminal, validate]);

  // Canvas interaction
  const handlePointerDown = useCallback((e) => {
    downPosRef.current = { x: e.clientX, y: e.clientY };
    downTimeRef.current = Date.now();
  }, []);

  const handlePointerUp = useCallback((e) => {
    if (!downPosRef.current) return;
    const dist = Math.hypot(e.clientX - downPosRef.current.x, e.clientY - downPosRef.current.y);
    const dt = Date.now() - downTimeRef.current;
    downPosRef.current = null;
    if (dist > 6 || dt > 500) return;
    
    // This was a tap, let the scene handle it
  }, []);

  // Drag and drop
  const handleDragStart = useCallback((e, type) => {
    if (placed[type]) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', type);
  }, [placed]);

  const handleTrayClick = useCallback((type) => {
    if (placed[type]) return;
    const zone = ZONES[type];
    placeComponent(type, zone.x, zone.z, handlePlaced);
  }, [placed, placeComponent, handlePlaced]);

  // Reset
  const handleReset = useCallback(() => {
    fullReset(() => {
      setPlaced({ panel: false, controller: false, battery: false, inverter: false });
      setDestroyed({ controller: false, battery: false, inverter: false });
      setConnections([]);
      setSelectedTerminal(null);
      setNoted(new Set());
      setPanelSelection(DEFAULT_SELECTION);
      setPanelSelectionStep(0);
      setPanelDestroyed(false);
      setScenario('');
      setLogs([]);
      setWasFullyCorrect(false);
      log('INFO', 'Pad cleared. Drag equipment back in to start again.');
    });
  }, [fullReset, log]);

  // Scenario
  const handleScenarioChange = useCallback((value) => {
    if (!value) return;
    setScenario(value);
    
    handleReset();
    
    const newSeriesCount = value === 'overvoltage' ? 3 : 1;
    setPanelSelection(prev => ({ ...prev, seriesCount: newSeriesCount }));
    
    ['panel', 'controller', 'battery', 'inverter'].forEach(t => {
      const zone = ZONES[t];
      setPlaced(prev => ({ ...prev, [t]: true }));
    });
    
    let newConnections = [];
    if (value === 'correct') {
      newConnections = [
        { a: 'p_pos', b: 'c_pv_pos' }, { a: 'p_neg', b: 'c_pv_neg' },
        { a: 'c_bat_pos', b: 'b_pos' }, { a: 'c_bat_neg', b: 'b_neg' },
        { a: 'b_pos', b: 'i_pos' }, { a: 'b_neg', b: 'i_neg' }
      ];
      log('INFO', 'Showing you a correct installation.');
    } else if (value === 'bypass_inverter') {
      newConnections = [{ a: 'p_pos', b: 'i_pos' }, { a: 'p_neg', b: 'i_neg' }];
      log('INFO', 'Showing you: panel wired straight into the inverter.');
    } else if (value === 'bypass_battery') {
      newConnections = [{ a: 'p_pos', b: 'b_pos' }, { a: 'p_neg', b: 'b_neg' }];
      log('INFO', 'Showing you: panel wired straight into the battery.');
    } else if (value === 'reverse_inverter') {
      newConnections = [
        { a: 'p_pos', b: 'c_pv_pos' }, { a: 'p_neg', b: 'c_pv_neg' },
        { a: 'c_bat_pos', b: 'b_pos' }, { a: 'c_bat_neg', b: 'b_neg' },
        { a: 'b_pos', b: 'i_neg' }, { a: 'b_neg', b: 'i_pos' }
      ];
      log('INFO', 'Showing you: battery wired backwards into the inverter.');
    } else if (value === 'overvoltage') {
      newConnections = [{ a: 'p_pos', b: 'c_pv_pos' }, { a: 'p_neg', b: 'c_pv_neg' }];
      log('INFO', 'Showing you: 3 panels chained together into the controller.');
    }
    
    setConnections(newConnections);
    setTimeout(() => validate(), 100);
  }, [handleReset, log, validate]);

  // Status computation
  const anyDestroyed = destroyed.controller || destroyed.battery || destroyed.inverter;
  const anyPlaced = Object.values(placed).some(Boolean);
  
  const fullyCorrect =
    placed.panel && !panelDestroyed && placed.controller && placed.battery && placed.inverter &&
    isConnected('p_pos', 'c_pv_pos') && isConnected('p_neg', 'c_pv_neg') &&
    isConnected('c_bat_pos', 'b_pos') && isConnected('c_bat_neg', 'b_neg') &&
    isConnected('b_pos', 'i_pos') && isConnected('b_neg', 'i_neg') &&
    arrayValues && arrayValues.stringVoc <= CONTROLLER_SPEC.smartsolar_100_30.maxPvVoc &&
    !destroyed.controller && !destroyed.battery && !destroyed.inverter;

  let statusText = 'Not connected';
  let statusClass = '';
  let statusDesc = 'The pad is empty. Drag equipment in to get started.';
  
  if (anyDestroyed) {
    statusText = 'Something broke';
    statusClass = 'fault';
    statusDesc = 'One or more parts were destroyed by this wiring. Check the log, then start over.';
  } else if (fullyCorrect) {
    statusText = 'Working!';
    statusClass = 'live';
    statusDesc = 'Power is flowing from the panel all the way to your sockets.';
  } else if (anyPlaced) {
    statusText = 'In progress';
    statusDesc = "Keep wiring the chain — or try a wrong connection to see what happens.";
  }

  // Gauge
  let gaugePct = 4;
  let gaugeWord = 'All clear';
  let gaugeColor = 'var(--green)';
  
  if (anyDestroyed) {
    gaugePct = 100;
    gaugeWord = 'Danger';
    gaugeColor = 'var(--ember)';
  } else if (fullyCorrect) {
    gaugePct = 6;
    gaugeWord = 'All clear';
    gaugeColor = 'var(--green)';
  } else if (noted.size > 0) {
    gaugePct = 35;
    gaugeWord = 'Caution';
    gaugeColor = 'var(--amber)';
  }

  // Initial log
  useEffect(() => {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setLogs([{ time, tag: 'INFO', message: 'Pad ready. Select a Solar Panel to begin.', detail: null }]);
  }, []);

  // Run validation when panel selection changes
  useEffect(() => {
    if (placed.panel && currentSpecs && arrayValues) {
      validate();
    }
  }, [panelSelection, placed.panel, currentSpecs, arrayValues]);

  return (
    <>
      <div className={`flash ${flashActive ? 'go' : ''} ${flashGood ? 'good' : ''}`} />

      <div className="app-layout">
        {/* ===== LEFT SIDEBAR ===== */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-title">Wire It Right</div>
            <div className="sidebar-subtitle">Solar wiring simulator</div>
          </div>

          {/* Wiring Key */}
          <div className="sidebar-controls">
            <div className="sidebar-wiring-key">
              <span><span className="swatch-dot red"></span> Red = positive (+)</span>
              <span><span className="swatch-dot black"></span> Dark = negative (−)</span>
            </div>
          </div>

          {/* Tray */}
          <div className="sidebar-tray">
            <div className="tray-title">Components</div>
            <div className="tray-list">
              {/* Solar Panel - with selection flow */}
              <div
                className={`tray-card panel-card ${placed.panel ? 'placed' : ''}`}
                onClick={() => {
                  if (!placed.panel && panelSelectionStep < 3) {
                    setPanelSelectionStep(prev => prev + 1);
                  }
                }}
              >
                <div className="swatch sw-panel">☀</div>
                <div className="tc-info">
                  {panelSelectionStep === 0 && (
                    <>
                      <div className="tc-name">Solar Panel</div>
                      <div className="tc-hint">Click to select manufacturer</div>
                    </>
                  )}
                  {panelSelectionStep === 1 && (
                    <>
                      <div className="tc-name">Solar Panel</div>
                      <div className="tc-hint">Select wattage:</div>
                      <div className="wattage-selector">
                        {Object.keys(getProducts(panelSelection.manufacturer)).map(w => (
                          <button
                            key={w}
                            className={`wattage-btn ${panelSelection.wattage === parseInt(w) ? 'selected' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPanelSelection(prev => ({ ...prev, wattage: parseInt(w) }));
                              setPanelSelectionStep(2);
                            }}
                          >
                            {w}W
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {panelSelectionStep === 2 && (
                    <>
                      <div className="tc-name">{currentSpecs?.model}</div>
                      <div className="tc-hint">Configure array:</div>
                      <div className="array-config">
                        <label>
                          Series:
                          <input
                            type="number"
                            min="1"
                            max="20"
                            value={panelSelection.seriesCount}
                            onChange={(e) => {
                              const val = Math.max(1, Math.min(20, parseInt(e.target.value) || 1));
                              setPanelSelection(prev => ({ ...prev, seriesCount: val }));
                              setPanelDestroyed(false);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </label>
                        <label>
                          Parallel:
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={panelSelection.parallelCount}
                            onChange={(e) => {
                              const val = Math.max(1, Math.min(10, parseInt(e.target.value) || 1));
                              setPanelSelection(prev => ({ ...prev, parallelCount: val }));
                              setPanelDestroyed(false);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </label>
                        <button
                          className="place-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!placed.panel) {
                              handleTrayClick('panel');
                            }
                          }}
                        >
                          Place on roof
                        </button>
                      </div>
                    </>
                  )}
                  {panelSelectionStep === 3 && placed.panel && (
                    <>
                      <div className="tc-name">{currentSpecs?.model}</div>
                      <div className="tc-hint">
                        {panelSelection.seriesCount}S × {panelSelection.parallelCount}P
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Other components - unchanged */}
              {['controller', 'battery', 'inverter'].map(type => (
                <div
                  key={type}
                  className={`tray-card ${placed[type] ? 'placed' : ''}`}
                  draggable={!placed[type]}
                  onDragStart={(e) => handleDragStart(e, type)}
                  onClick={() => handleTrayClick(type)}
                >
                  <div className={`swatch sw-${type}`}>
                    {type === 'controller' && '⌁'}
                    {type === 'battery' && '▮'}
                    {type === 'inverter' && '▭'}
                  </div>
                  <div className="tc-info">
                    <div className="tc-name">{NICE_NAMES[type]}</div>
                    <div className="tc-hint">
                      {type === 'controller' && 'Drag near the wall'}
                      {type === 'battery' && 'Drag to the floor'}
                      {type === 'inverter' && 'Drag near the wall'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Controls */}
          <div className="sidebar-footer">
            <select 
              className="sidebar-scenario"
              value={scenario} 
              onChange={(e) => handleScenarioChange(e.target.value)}
            >
              <option value="">Show me an example…</option>
              <option value="correct">✓ A correct, working system</option>
              <option value="bypass_inverter">✗ Skip the controller → inverter</option>
              <option value="bypass_battery">✗ Skip the controller → battery</option>
              <option value="reverse_inverter">✗ Battery wired backwards</option>
              <option value="overvoltage">✗ Too many panels chained together</option>
            </select>
            <button className="sidebar-btn reset" onClick={handleReset}>
              ⟲ Start over
            </button>
          </div>
        </aside>

        {/* ===== MAIN AREA ===== */}
        <main className="main-area">
          {/* Viewport / Canvas */}
          <div className="viewport">
            <canvas
              ref={canvasRef}
              id="scene-canvas"
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
            />
            <div className="vp-hint">
              Drag &amp; drop to place equipment. Click and drag empty space to rotate the view.
            </div>
            <div className="vp-badge">{badgeText}</div>
            <div className="vp-empty" style={{ opacity: isEmpty ? 1 : 0 }}>
              <p>The install pad is empty — drag a part in to begin</p>
            </div>
          </div>

          {/* Dashboard Overlay */}
          <div className="dashboard-overlay">
            <div className="dash-card">
              <div className="label">What's happening</div>
              <div className={`big-status ${statusClass}`}>{statusText}</div>
              <div className="status-desc">{statusDesc}</div>
            </div>
            <div className="dash-card">
              <div className="label">Safety level</div>
              <div className="gauge-word" style={{ color: gaugeColor }}>{gaugeWord}</div>
              <div className="gauge-track">
                <div className="gauge-fill" style={{ width: `${gaugePct}%`, background: gaugeColor }} />
              </div>
              <div className="gauge-label">
                <span>Safe</span>
                <span>Danger</span>
              </div>
            </div>
            <div className="dash-card">
              <div className="label">Array specs</div>
              {arrayValues && currentSpecs ? (
                <div className="array-specs">
                  <div className="spec-row">
                    <span>String Voc</span>
                    <b>{arrayValues.stringVoc} V</b>
                  </div>
                  <div className="spec-row">
                    <span>Array Isc</span>
                    <b>{arrayValues.arrayIsc} A</b>
                  </div>
                  <div className="spec-row">
                    <span>String Vmp</span>
                    <b>{arrayValues.stringVmp} V</b>
                  </div>
                  <div className="spec-row">
                    <span>Array Imp</span>
                    <b>{arrayValues.arrayImp} A</b>
                  </div>
                </div>
              ) : (
                <div className="power-cap">Select a panel to begin</div>
              )}
            </div>
          </div>

          {/* Log Overlay */}
          <div className="log-overlay">
            <div className="log-header">
              <div className="log-title">What happened</div>
              <div className="log-count">{logs.length} events</div>
            </div>
            <div className="log-content">
              {logs.map((entry, idx) => (
                <div key={idx} className="log-entry">
                  <div className="log-top">
                    <span className="log-time">{entry.time}</span>
                    <span className={`log-tag ${entry.tag}`}>{entry.tag}</span>
                  </div>
                  <div className="log-msg">{entry.message}</div>
                  {entry.detail && <div className="log-detail">{entry.detail}</div>}
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

export default App;
