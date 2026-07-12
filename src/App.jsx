import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useThreeScene } from './hooks/useThreeScene';
import { PANEL_SPEC, CTRL_MAX_VOC, INV_MIN_V, INV_MAX_V, OWNER, GROUP, ZONES, LABEL_MAP, NICE_NAMES } from './utils/constants';

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
  const [seriesCount, setSeriesCount] = useState(1);
  const [scenario, setScenario] = useState('');
  const [logs, setLogs] = useState([]);
  const [flashActive, setFlashActive] = useState(false);
  const [flashGood, setFlashGood] = useState(false);
  const [wasFullyCorrect, setWasFullyCorrect] = useState(false);

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

  const arrayVoc = useCallback(() => +(PANEL_SPEC.voc * seriesCount).toFixed(1), [seriesCount]);

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
        if (arrayVoc() > CTRL_MAX_VOC) {
          fireExplosion('controller', (key) => {
            setDestroyed(prev => ({ ...prev, [key]: true }));
            triggerFlash(false);
            log('FAULT', `The charge controller just blew up.`,
              `${seriesCount} panels chained together produce ${arrayVoc()}V — this controller tops out at ${CTRL_MAX_VOC}V.`);
            setTimeout(() => validate(), 100);
          });
          return;
        } else if (pvReversed) {
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
    const fullyCorrect =
      placed.panel && placed.controller && placed.battery && placed.inverter &&
      isConnected('p_pos', 'c_pv_pos') && isConnected('p_neg', 'c_pv_neg') &&
      isConnected('c_bat_pos', 'b_pos') && isConnected('c_bat_neg', 'b_neg') &&
      isConnected('b_pos', 'i_pos') && isConnected('b_neg', 'i_neg') &&
      arrayVoc() <= CTRL_MAX_VOC &&
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
    destroyed, placed, connections, seriesCount, noted, wasFullyCorrect,
    isConnected, hasEdgeBetweenGroups, isTerminalDestroyed, keyOf,
    fireExplosion, note, log, arrayVoc, drawWires, updateIndicators, celebrate, triggerFlash
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
      setSeriesCount(1);
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
    setSeriesCount(newSeriesCount);
    
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
    placed.panel && placed.controller && placed.battery && placed.inverter &&
    isConnected('p_pos', 'c_pv_pos') && isConnected('p_neg', 'c_pv_neg') &&
    isConnected('c_bat_pos', 'b_pos') && isConnected('c_bat_neg', 'b_neg') &&
    isConnected('b_pos', 'i_pos') && isConnected('b_neg', 'i_neg') &&
    arrayVoc() <= CTRL_MAX_VOC &&
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
    setLogs([{ time, tag: 'INFO', message: 'Pad ready. Drag the Solar Panel in first.', detail: null }]);
  }, []);

  return (
    <>
      <div className={`flash ${flashActive ? 'go' : ''} ${flashGood ? 'good' : ''}`} />

      {/* Hero */}
      <div className="hero">
        <div className="hero-left">
          <div className="kicker">
            <span className="dot"></span>
            Solar wiring, made obvious
          </div>
          <h1>
            Build the install.<br />
            See what <span>breaks</span> — safely.
          </h1>
          <div className="sub">
            A real solar system, built from real equipment. <b>Drag each part onto the pad</b>, wire it up, and watch exactly what happens — right or very wrong.
          </div>
        </div>
        <div className="howto">
          <div className="how-step">
            <div className="n">1 · Drag</div>
            <p>Drag a part from the tray onto the pad.</p>
          </div>
          <div className="how-step">
            <div className="n">2 · Connect</div>
            <p>Click a terminal, then the one to join it to.</p>
          </div>
          <div className="how-step">
            <div className="n">3 · Watch</div>
            <p>See it power up — or blow up.</p>
          </div>
        </div>
      </div>

      {/* Tray */}
      <div className="tray">
        {['panel', 'controller', 'battery', 'inverter'].map(type => (
          <div
            key={type}
            className={`tray-card ${placed[type] ? 'placed' : ''}`}
            draggable={!placed[type]}
            onDragStart={(e) => handleDragStart(e, type)}
            onClick={() => handleTrayClick(type)}
          >
            <div className={`swatch sw-${type}`}>
              {type === 'panel' && '☀'}
              {type === 'controller' && '⌁'}
              {type === 'battery' && '▮'}
              {type === 'inverter' && '▭'}
            </div>
            <div>
              <div className="tc-name">{NICE_NAMES[type]}</div>
              <div className="tc-hint">
                {type === 'panel' && 'Drag to the roof zone'}
                {type === 'controller' && 'Drag near the wall'}
                {type === 'battery' && 'Drag to the floor'}
                {type === 'inverter' && 'Drag near the wall'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Viewport */}
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

      {/* Wiring Key */}
      <div className="wiring-key">
        <span><span className="swatch-dot red"></span> Red = positive (+)</span>
        <span><span className="swatch-dot black"></span> Dark = negative (−)</span>
        <span style={{ color: 'var(--text-dim)' }}>Match colors to do it right. Cross them, and see what happens.</span>
      </div>

      {/* Controls */}
      <div className="controls-row">
        <select value={scenario} onChange={(e) => handleScenarioChange(e.target.value)}>
          <option value="">Show me an example…</option>
          <option value="correct">✓ A correct, working system</option>
          <option value="bypass_inverter">✗ Skip the controller → inverter</option>
          <option value="bypass_battery">✗ Skip the controller → battery</option>
          <option value="reverse_inverter">✗ Battery wired backwards</option>
          <option value="overvoltage">✗ Too many panels chained together</option>
        </select>
        <button className="ctrl reset" onClick={handleReset}>⟲ Start over</button>
      </div>

      {/* Dashboard */}
      <div className="dash">
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
          <div className="label">Panel power right now</div>
          <div className="power-num">{arrayVoc()} V</div>
          <div className="power-cap">
            {seriesCount > 1
              ? `${seriesCount} panels chained in series — voltage adds up`
              : 'Voltage coming from the panel'}
          </div>
        </div>
      </div>

      {/* Log */}
      <div className="log-section">
        <div className="log-title">
          <span>What happened</span>
          <span className="count">{logs.length} events</span>
        </div>
        <div className="log-box">
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
    </>
  );
}

export default App;
