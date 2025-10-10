import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer, ReferenceLine, LabelList } from 'recharts';

const GrainGradient = dynamic(
  () => import('@paper-design/shaders-react').then(m => m.GrainGradient),
  { ssr: false }
);

const API_BASE = '';

function Stat({ label, value }) {
  return (
    <div style={{padding:12,border:'1px solid #eee',borderRadius:8,minWidth:220}}>
      <div style={{fontSize:12,color:'#666'}}>{label}</div>
      <div style={{fontSize:18,fontWeight:600}}>{value}</div>
    </div>
  );
}

function Bar({ value, color = '#3b82f6', height = 10, showLabel = true }) {
  const clamped = Math.max(0, Math.min(1, value || 0));
  return (
    <div>
      <div style={{background:'#f3f4f6', borderRadius:6, overflow:'hidden', height}}>
        <div style={{width:`${(clamped*100).toFixed(1)}%`, background:color, height:'100%'}} />
      </div>
      {showLabel && (
        <div style={{fontSize:12, color:'#444', marginTop:6}}>{(clamped*100).toFixed(1)}%</div>
      )}
    </div>
  );
}

export default function Home() {
  const [metrics, setMetrics] = useState(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [form, setForm] = useState({
    air_temperature_K: 298.8,
    process_temperature_K: 308.8,
    rotational_speed_rpm: 1500,
    torque_Nm: 40,
    tool_wear_min: 50,
    type: 'M'
  });
  const [pred, setPred] = useState(null);
  const [loadingPred, setLoadingPred] = useState(false);
  const [randomMode, setRandomMode] = useState('mixed'); // 'normal' | 'failure' | 'mixed'
  const [shaderOn, setShaderOn] = useState(true);
  const palettes = useMemo(() => ([
    { colors:["#0ea5e9","#a78bfa","#22d3ee"], back:"#0a0f1a" },
    { colors:["#c6750c","#beae60","#d7cbc6"], back:"#000a0f" },
    { colors:["#10b981","#22d3ee","#60a5fa"], back:"#081018" },
    { colors:["#ef4444","#f59e0b","#22c55e"], back:"#0b0b10" }
  ]), []);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [chartMode, setChartMode] = useState('error'); // 'absolute' | 'error'
  const [zoomNearOne, setZoomNearOne] = useState(true);
  const bestModel = useMemo(() => metrics?.best_model || '-', [metrics]);

  useEffect(() => {
    const load = async () => {
      setLoadingMetrics(true);
      try {
        const res = await fetch(`/model/metrics.json`);
        const data = await res.json();
        setMetrics(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingMetrics(false);
      }
    };
    load();
  }, []);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((s) => ({...s, [name]: name === 'type' ? value : Number(value)}));
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoadingPred(true);
    setPred(null);
    try {
      const res = await fetch(`/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      setPred(data.predictions);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPred(false);
    }
  };

  const randomize = () => {
    const rand = (min, max) => Math.random() * (max - min) + min;
    const randInt = (min, max) => Math.floor(rand(min, max + 1));
    const choose = (arr) => arr[Math.floor(Math.random()*arr.length)];

    const sampleNormal = () => {
      const air = +(rand(298.0, 299.2)).toFixed(1);
      const proc = +(air + rand(10.2, 11.2)).toFixed(1);
      const speed = randInt(1450, 1800);
      const torque = +rand(28, 46).toFixed(1);
      const wear = randInt(0, 120);
      const type = choose(['H','M','L']);
      return { air, proc, speed, torque, wear, type };
    };

    const sampleFailure = () => {
      const air = +(rand(298.5, 299.5)).toFixed(1);
      const proc = +(air + rand(10.5, 11.8)).toFixed(1);
      const speed = Math.random() < 0.5 ? randInt(1200, 1400) : randInt(1850, 2100);
      const torque = +rand(48, 60).toFixed(1);
      const wear = randInt(180, 250);
      const type = choose(['H','M','L']);
      return { air, proc, speed, torque, wear, type };
    };

    let s;
    if (randomMode === 'normal') s = sampleNormal();
    else if (randomMode === 'failure') s = sampleFailure();
    else s = Math.random() < 0.35 ? sampleFailure() : sampleNormal();

    setForm({
      air_temperature_K: s.air,
      process_temperature_K: s.proc,
      rotational_speed_rpm: s.speed,
      torque_Nm: s.torque,
      tool_wear_min: s.wear,
      type: s.type
    });
  };

  const [vw, setVw] = useState(1280);
  const [vh, setVh] = useState(720);
  useEffect(() => {
    const onResize = () => {
      if (typeof window !== 'undefined') {
        setVw(window.innerWidth);
        setVh(window.innerHeight);
      }
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div style={{position:'relative'}}>
      {shaderOn && (
        <div style={{position:'fixed', inset:0, zIndex:0, pointerEvents:'none'}}>
          <GrainGradient
            width={vw}
            height={vh}
            colors={palettes[paletteIndex].colors}
            colorBack={palettes[paletteIndex].back}
            softness={0.75}
            intensity={0.08}
            noise={0.30}
            shape="wave"
            speed={0.4}
          />
        </div>
      )}
      <div style={{position:'relative', zIndex:1, maxWidth:1100,margin:'40px auto',padding:'0 20px',fontFamily:'Inter, system-ui, Arial', color:'#0f172a'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', border:'1px solid #e5e7eb', borderRadius:12, background:'rgba(255,255,255,0.95)', backdropFilter:'saturate(180%) blur(6px)'}}>
        <div>
          <h1 style={{fontSize:28,margin:0,lineHeight:1.2,color:'#0b1220'}}>Predictive Maintenance Dashboard</h1>
        </div>
        <div style={{display:'flex', gap:8}}>
          <button onClick={()=>setPaletteIndex((i)=> (i+1)%palettes.length)} style={{padding:'8px 12px'}}>Random BG</button>
          <button onClick={()=>setShaderOn(s=>!s)} style={{padding:'8px 12px'}}>{shaderOn ? 'Background: On' : 'Background: Off'}</button>
        </div>
      </div>
      

      <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:20, padding:12, border:'1px solid #e5e7eb', borderRadius:12, background:'rgba(255,255,255,0.9)'}}>
        <Stat label="Best Model" value={bestModel} />
        <Stat label="XGBoost (Acc)" value={metrics ? metrics.xgboost.accuracy.toFixed(4) : (loadingMetrics? '...' : '-') } />
        <Stat label="XGBoost (AUC)" value={metrics ? metrics.xgboost.auc.toFixed(4) : (loadingMetrics? '...' : '-') } />
        <Stat label="Random Forest (Acc)" value={metrics ? metrics.random_forest.accuracy.toFixed(4) : (loadingMetrics? '...' : '-') } />
        <Stat label="Random Forest (AUC)" value={metrics ? metrics.random_forest.auc.toFixed(4) : (loadingMetrics? '...' : '-') } />
        <Stat label="LogReg (Acc)" value={metrics ? metrics.logistic_regression.accuracy.toFixed(4) : (loadingMetrics? '...' : '-') } />
        <Stat label="LogReg (AUC)" value={metrics ? metrics.logistic_regression.auc.toFixed(4) : (loadingMetrics? '...' : '-') } />
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24,marginTop:30}}>
        <form onSubmit={submit} style={{padding:16,border:'1px solid #e5e7eb',borderRadius:12, background:'rgba(255,255,255,0.92)'}}>
          <h3 style={{marginTop:0}}>Input Parameters</h3>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <label>Air temperature K
              <input name="air_temperature_K" type="number" step="0.1" value={form.air_temperature_K} onChange={onChange} style={{width:'100%'}} />
            </label>
            <label>Process temperature K
              <input name="process_temperature_K" type="number" step="0.1" value={form.process_temperature_K} onChange={onChange} style={{width:'100%'}} />
            </label>
            <label>Rotational speed rpm
              <input name="rotational_speed_rpm" type="number" step="1" value={form.rotational_speed_rpm} onChange={onChange} style={{width:'100%'}} />
            </label>
            <label>Torque Nm
              <input name="torque_Nm" type="number" step="0.1" value={form.torque_Nm} onChange={onChange} style={{width:'100%'}} />
            </label>
            <label>Tool wear min
              <input name="tool_wear_min" type="number" step="1" value={form.tool_wear_min} onChange={onChange} style={{width:'100%'}} />
            </label>
            <label>Type (H/M/L)
              <input name="type" type="text" value={form.type} onChange={onChange} style={{width:'100%'}} />
            </label>
          </div>
          <div style={{display:'flex', gap:8, marginTop:16, alignItems:'center'}}>
            <button type="submit" style={{padding:'8px 12px'}}>Predict</button>
            <button type="button" onClick={randomize} style={{padding:'8px 12px'}}>Random</button>
            <label style={{display:'inline-flex', alignItems:'center', gap:6, fontSize:12, color:'#555'}}>
              Mode
              <select value={randomMode} onChange={(e)=>setRandomMode(e.target.value)}>
                <option value="mixed">mixed</option>
                <option value="normal">normal</option>
                <option value="failure">failure</option>
              </select>
            </label>
          </div>
          {loadingPred && <div style={{marginTop:8}}>Predicting...</div>}
        </form>

        <div style={{padding:16,border:'1px solid #e5e7eb',borderRadius:12, background:'rgba(255,255,255,0.92)'}}>
          <h3 style={{marginTop:0}}>Predictions</h3>
          {!pred && <div>No predictions yet.</div>}
          {pred && (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
              <div style={{padding:12,border:'1px solid #ddd',borderRadius:8}}>
                <div style={{fontWeight:600}}>XGBoost</div>
                <div>Label: {pred.xgboost.label}</div>
                <div>Prob: {pred.xgboost.prob.toFixed(3)}</div>
                <Bar value={pred.xgboost.prob} color="#2563eb" />
              </div>
              <div style={{padding:12,border:'1px solid #ddd',borderRadius:8}}>
                <div style={{fontWeight:600}}>Random Forest</div>
                <div>Label: {pred.random_forest.label}</div>
                <div>Prob: {pred.random_forest.prob.toFixed(3)}</div>
                <Bar value={pred.random_forest.prob} color="#16a34a" />
              </div>
              <div style={{padding:12,border:'1px solid #ddd',borderRadius:8}}>
                <div style={{fontWeight:600}}>Logistic Regression</div>
                <div>Label: {pred.logistic_regression.label}</div>
                <div>Prob: {pred.logistic_regression.prob.toFixed(3)}</div>
                <Bar value={pred.logistic_regression.prob} color="#f59e0b" />
              </div>
            </div>
          )}
        </div>
      </div>

      {metrics && (
        <div style={{marginTop:30,padding:16,border:'1px solid #e5e7eb',borderRadius:12, background:'rgba(255,255,255,0.92)'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <h3 style={{marginTop:0, marginBottom:8}}>Model Metrics Visualization</h3>
            <div style={{display:'flex', gap:8, alignItems:'center'}}>
              <label style={{fontSize:13, color:'#475569'}}>Mode
                <select value={chartMode} onChange={(e)=>setChartMode(e.target.value)} style={{marginLeft:6}}>
                  <option value="absolute">absolute</option>
                  <option value="error">error-rate</option>
                </select>
              </label>
              {chartMode === 'absolute' && (
                <label style={{fontSize:13, color:'#475569', display:'inline-flex', alignItems:'center', gap:6}}>
                  Zoom near 100%
                  <input type="checkbox" checked={zoomNearOne} onChange={(e)=>setZoomNearOne(e.target.checked)} />
                </label>
              )}
            </div>
          </div>
          <div style={{width:'100%', height:320}}>
            <ResponsiveContainer width="100%" height="100%">
              {(() => {
                const absData = [
                  { name:'XGBoost', accuracy: metrics.xgboost.accuracy, auc: metrics.xgboost.auc },
                  { name:'Random Forest', accuracy: metrics.random_forest.accuracy, auc: metrics.random_forest.auc },
                  { name:'LogReg', accuracy: metrics.logistic_regression.accuracy, auc: metrics.logistic_regression.auc }
                ];
                const errorData = absData.map(d => ({ name: d.name, acc_error: 1 - d.accuracy, auc_gap: 1 - d.auc }));
                const yDomain = chartMode === 'absolute' ? (zoomNearOne ? [0.9, 1] : [0, 1]) : [0, Math.max(...errorData.map(d=>Math.max(d.acc_error,d.auc_gap))) * 1.2];
                return (
                  <LineChart data={chartMode === 'absolute' ? absData : errorData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" interval={0} />
                    <YAxis domain={yDomain} tickFormatter={(v)=>`${(v*100).toFixed(0)}%`} />
                    <Tooltip formatter={(v, n)=> (typeof v==='number'? `${(v*100).toFixed(2)}%` : v)} labelFormatter={(l)=>`Model: ${l}`} />
                    <Legend />
                    {chartMode === 'absolute' ? (
                      <>
                        <ReferenceLine y={1} stroke="#94a3b8" strokeDasharray="4 4" ifOverflow="extendDomain" />
                        <Line type="monotone" dataKey="accuracy" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} name="Accuracy">
                          <LabelList dataKey={(d)=>`${(d.accuracy*100).toFixed(1)}%`} position="top" style={{fontSize:12, fill:'#2563eb'}} />
                        </Line>
                        <Line type="monotone" dataKey="auc" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} name="AUC" strokeDasharray="5 3">
                          <LabelList dataKey={(d)=>`${(d.auc*100).toFixed(1)}%`} position="top" style={{fontSize:12, fill:'#16a34a'}} />
                        </Line>
                      </>
                    ) : (
                      <>
                        <Line type="monotone" dataKey="acc_error" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} name="Accuracy Error">
                          <LabelList dataKey={(d)=>`${(d.acc_error*100).toFixed(1)}%`} position="top" style={{fontSize:12, fill:'#2563eb'}} />
                        </Line>
                        <Line type="monotone" dataKey="auc_gap" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} name="AUC Gap" strokeDasharray="5 3">
                          <LabelList dataKey={(d)=>`${(d.auc_gap*100).toFixed(1)}%`} position="top" style={{fontSize:12, fill:'#16a34a'}} />
                        </Line>
                      </>
                    )}
                  </LineChart>
                );
              })()}
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {pred && (
        <div style={{marginTop:30,padding:16,border:'1px solid #e5e7eb',borderRadius:12, background:'rgba(255,255,255,0.92)'}}>
          <h3 style={{marginTop:0}}>Combined Prediction View</h3>
          <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:20}}>
            <svg width="100%" height="180" viewBox="0 0 600 180" preserveAspectRatio="xMidYMid meet" style={{border:'1px solid #f0f0f0', borderRadius:8}}>
              <defs>
                <linearGradient id="bg" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="100%" stopColor="#fafafa" />
                </linearGradient>
              </defs>
              <rect x="0" y="0" width="600" height="180" fill="url(#bg)" />
              <g transform="translate(100,25)">
                <text x="0" y="0" fill="#666" fontSize="12">Probability of Failure</text>
                {[
                  {name:'XGBoost', prob: pred.xgboost.prob, color:'#2563eb', y:20},
                  {name:'Random Forest', prob: pred.random_forest.prob, color:'#16a34a', y:70},
                  {name:'Logistic Regression', prob: pred.logistic_regression.prob, color:'#f59e0b', y:120}
                ].map((m) => {
                  const width = Math.max(0, Math.min(1, m.prob)) * 380;
                  return (
                    <g key={m.name} transform={`translate(0, ${m.y})`}>
                      <text x="-10" y="12" textAnchor="end" fontSize="12" fill="#333">{m.name}</text>
                      <rect x="0" y="0" width="380" height="12" fill="#e5e7eb" rx="6" />
                      <rect x="0" y="0" width={width} height="12" fill={m.color} rx="6" />
                      <text x={width + 8} y="10" fontSize="12" fill="#333">{m.prob.toFixed(3)}</text>
                    </g>
                  );
                })}
                <g transform="translate(0, 145)">
                  <text x="0" y="0" fontSize="11" fill="#666">0</text>
                  <text x="188" y="0" fontSize="11" fill="#666">0.5</text>
                  <text x="376" y="0" fontSize="11" fill="#666">1.0</text>
                </g>
              </g>
            </svg>
            <div style={{alignSelf:'center'}}>
              <div style={{fontWeight:600, marginBottom:8}}>Current Input</div>
              <div style={{display:'grid', gridTemplateColumns:'auto auto', gap:'6px 16px', fontSize:13}}>
                <div style={{color:'#555'}}>Air temperature K</div><div>{form.air_temperature_K}</div>
                <div style={{color:'#555'}}>Process temperature K</div><div>{form.process_temperature_K}</div>
                <div style={{color:'#555'}}>Rotational speed rpm</div><div>{form.rotational_speed_rpm}</div>
                <div style={{color:'#555'}}>Torque Nm</div><div>{form.torque_Nm}</div>
                <div style={{color:'#555'}}>Tool wear min</div><div>{form.tool_wear_min}</div>
                <div style={{color:'#555'}}>Type</div><div>{form.type}</div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
