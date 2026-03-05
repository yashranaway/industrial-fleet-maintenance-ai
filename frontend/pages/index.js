import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer, ReferenceLine, LabelList } from 'recharts';
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient"
import { Loader2, RefreshCw } from "lucide-react"

const API_BASE = '';

function Stat({ label, value }) {
  return (
    <Card className="min-w-[140px]">
      <CardHeader className="p-4 pb-2">
        <CardDescription className="text-xs">{label}</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function Bar({ value, color = '#3b82f6', height = 10, showLabel = true }) {
  const clamped = Math.max(0, Math.min(1, value || 0));
  return (
    <div>
      <div style={{ background: '#f3f4f6', borderRadius: 6, overflow: 'hidden', height }}>
        <div style={{ width: `${(clamped * 100).toFixed(1)}%`, background: color, height: '100%' }} />
      </div>
      {showLabel && (
        <div style={{ fontSize: 12, color: '#444', marginTop: 6 }}>{(clamped * 100).toFixed(1)}%</div>
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

  const [chartMode, setChartMode] = useState('error'); // 'absolute' | 'error'
  const [zoomNearOne, setZoomNearOne] = useState(true);
  const bestModel = useMemo(() => metrics?.best_model || '-', [metrics]);

  // AI State
  // AI State
  const [diagnosis, setDiagnosis] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rateLimits, setRateLimits] = useState(null);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);

  const loadingMessages = [
    "Initializing neural pathways...",
    "Scanning sensor telemetry...",
    "Cross-referencing failure patterns...",
    "Evaluating thermal signatures...",
    "Analyzing vibration anomalies...",
    "Consulting maintenance history...",
    "Running predictive algorithms...",
    "Correlating wear indicators...",
    "Generating diagnostic report...",
    "Finalizing analysis..."
  ];

  const analyze = async () => {
    if (!pred) return;
    setAnalyzing(true);
    setDiagnosis('');
    setProgress(0);
    setLoadingMsgIndex(0);

    // Realistic progress simulation - caps at 90%
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 90) return 90;
        // Fast start (0-50%)
        if (p < 50) {
          return Math.min(50, p + Math.random() * 8 + 2);
        }
        // Medium speed (50-75%)
        if (p < 75) {
          return Math.min(75, p + Math.random() * 3 + 0.5);
        }
        // Slow crawl (75-90%)
        return Math.min(90, p + Math.random() * 1.5 + 0.2);
      });
    }, 200);

    // Cycle through loading messages
    const msgInterval = setInterval(() => {
      setLoadingMsgIndex(i => (i + 1) % 10);
    }, 800);

    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          ...form,
          prediction_prob: pred.xgboost.prob
        })
      });

      // Handle streaming response
      if (res.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.char) {
                  fullText += parsed.char;
                  setDiagnosis(fullText);
                }
              } catch {}
            }
          }
        }
        setProgress(100);
      } else {
        // Fallback to JSON response
        const data = await res.json();
        setDiagnosis(data.text || 'No diagnosis available.');
        if (data.rateLimits) setRateLimits(data.rateLimits);
        setProgress(100);
      }
    } catch (e) {
      setDiagnosis('Error: Could not reach IBM Granite service.');
    } finally {
      clearInterval(interval);
      clearInterval(msgInterval);
      setAnalyzing(false);
    }
  };

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
    setForm((s) => ({ ...s, [name]: name === 'type' ? value : Number(value) }));
  };

  const onSelectChange = (val) => {
    setForm(s => ({ ...s, type: val }));
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
    const choose = (arr) => arr[Math.floor(Math.random() * arr.length)];

    const sampleNormal = () => {
      const air = +(rand(298.0, 299.2)).toFixed(1);
      const proc = +(air + rand(10.2, 11.2)).toFixed(1);
      const speed = randInt(1450, 1800);
      const torque = +rand(28, 46).toFixed(1);
      const wear = randInt(0, 120);
      const type = choose(['H', 'M', 'L']);
      return { air, proc, speed, torque, wear, type };
    };

    const sampleFailure = () => {
      const air = +(rand(298.5, 299.5)).toFixed(1);
      const proc = +(air + rand(10.5, 11.8)).toFixed(1);
      const speed = Math.random() < 0.5 ? randInt(1200, 1400) : randInt(1850, 2100);
      const torque = +rand(48, 60).toFixed(1);
      const wear = randInt(180, 250);
      const type = choose(['H', 'M', 'L']);
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

  // No resize or shader effects needed anymore

  return (
    <div className="min-h-screen bg-slate-50/50 p-8 font-sans text-slate-900">
      <div className="mx-auto max-w-6xl space-y-8">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Predictive Maintenance Dashboard</h1>
            <p className="text-slate-500">Real-time monitoring and AI-driven insights.</p>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
          <Stat label="Best Model" value={bestModel} />
          <Stat label="XGBoost (Acc)" value={metrics ? metrics.xgboost.accuracy.toFixed(4) : (loadingMetrics ? '...' : '-')} />
          <Stat label="XGBoost (AUC)" value={metrics ? metrics.xgboost.auc.toFixed(4) : (loadingMetrics ? '...' : '-')} />
          <Stat label="Random Forest (Acc)" value={metrics ? metrics.random_forest.accuracy.toFixed(4) : (loadingMetrics ? '...' : '-')} />
          <Stat label="Random Forest (AUC)" value={metrics ? metrics.random_forest.auc.toFixed(4) : (loadingMetrics ? '...' : '-')} />
          <Stat label="LogReg (Acc)" value={metrics ? metrics.logistic_regression.accuracy.toFixed(4) : (loadingMetrics ? '...' : '-')} />
          <Stat label="LogReg (AUC)" value={metrics ? metrics.logistic_regression.auc.toFixed(4) : (loadingMetrics ? '...' : '-')} />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Input Form */}
          <Card>
            <CardHeader>
              <CardTitle>Input Parameters</CardTitle>
              <CardDescription>Enter sensor readings to predict failure.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="air_temp">Air temperature (K)</Label>
                    <Input id="air_temp" name="air_temperature_K" type="number" step="0.1" value={form.air_temperature_K} onChange={onChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="proc_temp">Process temperature (K)</Label>
                    <Input id="proc_temp" name="process_temperature_K" type="number" step="0.1" value={form.process_temperature_K} onChange={onChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rpm">Rotational speed (RPM)</Label>
                    <Input id="rpm" name="rotational_speed_rpm" type="number" step="1" value={form.rotational_speed_rpm} onChange={onChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="torque">Torque (Nm)</Label>
                    <Input id="torque" name="torque_Nm" type="number" step="0.1" value={form.torque_Nm} onChange={onChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wear">Tool wear (min)</Label>
                    <Input id="wear" name="tool_wear_min" type="number" step="1" value={form.tool_wear_min} onChange={onChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Machine Type</Label>
                    <Select value={form.type} onValueChange={onSelectChange}>
                      <SelectTrigger id="type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="L">Low (L)</SelectItem>
                        <SelectItem value="M">Medium (M)</SelectItem>
                        <SelectItem value="H">High (H)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-end gap-4 pt-2">
                  <Button type="submit" disabled={loadingPred}>
                    {loadingPred && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Predict
                  </Button>
                  <Button type="button" variant="outline" onClick={randomize}>Random Values</Button>
                  <div className="ml-auto flex items-center gap-2 text-sm text-slate-500">
                    <span>Mode:</span>
                    <Select value={randomMode} onValueChange={setRandomMode}>
                      <SelectTrigger className="w-[100px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mixed">Mixed</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="failure">Failure</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Predictions & AI */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Prediction Results</CardTitle>
              </CardHeader>
              <CardContent>
                {!pred ? (
                  <div className="text-sm text-slate-500">Run a prediction to see results.</div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2 rounded-lg border p-3">
                      <div className="font-semibold text-sm">XGBoost</div>
                      <div className="text-2xl font-bold">{pred.xgboost.prob.toFixed(3)}</div>
                      <div className="text-xs text-slate-500">{pred.xgboost.label === 1 ? 'FAILURE' : 'Normal'}</div>
                      <Bar value={pred.xgboost.prob} color="#2563eb" />
                    </div>
                    <div className="space-y-2 rounded-lg border p-3">
                      <div className="font-semibold text-sm">Random Forest</div>
                      <div className="text-2xl font-bold">{pred.random_forest.prob.toFixed(3)}</div>
                      <div className="text-xs text-slate-500">{pred.random_forest.label === 1 ? 'FAILURE' : 'Normal'}</div>
                      <Bar value={pred.random_forest.prob} color="#16a34a" />
                    </div>
                    <div className="space-y-2 rounded-lg border p-3">
                      <div className="font-semibold text-sm">Log Regression</div>
                      <div className="text-2xl font-bold">{pred.logistic_regression.prob.toFixed(3)}</div>
                      <div className="text-xs text-slate-500">{pred.logistic_regression.label === 1 ? 'FAILURE' : 'Normal'}</div>
                      <Bar value={pred.logistic_regression.prob} color="#f59e0b" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {pred && (
              <Card className="border-indigo-100 bg-indigo-50/30 overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-2 bg-indigo-50/50">
                  <div className="flex items-center gap-3">
                    <Badge className="bg-indigo-600 hover:bg-indigo-700">IBM GRANITE</Badge>
                    <CardTitle className="text-indigo-950 text-base">AI Maintenance Assistant</CardTitle>
                  </div>
                  {!diagnosis && !analyzing && (
                    <div onClick={analyze} className="bg-black cursor-pointer rounded-full">
                      <HoverBorderGradient
                        containerClassName="rounded-full"
                        as="button"
                        className="bg-black text-white flex items-center space-x-2"
                      >
                        Analyze Failure Risk
                      </HoverBorderGradient>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="p-4">
                  {analyzing && (
                    <div className="py-4 space-y-4">
                      <div className="flex items-center gap-2 text-sm text-indigo-600 font-medium justify-center">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {diagnosis ? 'Streaming response...' : `Consulting IBM Granite Model... ${progress.toFixed(1)}%`}
                      </div>
                      {!diagnosis && (
                        <>
                          <div className="w-full bg-indigo-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-indigo-600 h-full rounded-full transition-all duration-300 ease-out"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <div className="h-6 overflow-hidden relative">
                            <p
                              key={loadingMsgIndex}
                              className="text-xs text-center text-slate-600 animate-pulse absolute inset-x-0"
                              style={{
                                animation: 'slideIn 0.3s ease-out'
                              }}
                            >
                              {loadingMessages[loadingMsgIndex]}
                            </p>
                          </div>
                        </>
                      )}
                      <style jsx>{`
                        @keyframes slideIn {
                          0% { opacity: 0; transform: translateY(10px); }
                          100% { opacity: 1; transform: translateY(0); }
                        }
                      `}</style>
                    </div>
                  )}

                  {diagnosis && (
                    <div className="relative mt-2 rounded-md bg-slate-950 p-4 text-sm font-mono leading-relaxed text-slate-50 shadow-inner">
                      <span className="absolute top-0 left-0 px-2 py-1 text-[10px] uppercase tracking-wider text-slate-400 bg-slate-900 rounded-br">SYS.DIAG.OUT</span>
                      <div className="mt-4">
                        {diagnosis.split(/(1\.\s*Diagnosis:|2\.\s*Action:|Diagnosis:|Action:|\d+\.?\d*%|\d+min|\d+rpm|\d+Nm|\d+K|failure|warning|critical|immediately|replace|schedule)/gi).map((part, i) => {
                          const lower = part.toLowerCase();
                          if (/^(1\.\s*)?diagnosis:$/i.test(part)) return <span key={i} className="text-cyan-400 font-bold">{part}</span>;
                          if (/^(2\.\s*)?action:$/i.test(part)) return <span key={i} className="text-green-400 font-bold">{part}</span>;
                          if (/\d+\.?\d*%/.test(part)) return <span key={i} className="text-yellow-400">{part}</span>;
                          if (/\d+(min|rpm|Nm|K)/i.test(part)) return <span key={i} className="text-amber-300">{part}</span>;
                          if (/failure|warning|critical/i.test(lower)) return <span key={i} className="text-red-400 font-semibold">{part}</span>;
                          if (/immediately|replace|schedule/i.test(lower)) return <span key={i} className="text-emerald-400">{part}</span>;
                          return <span key={i}>{part}</span>;
                        })}
                        {analyzing && <span className="inline-block w-2 h-4 bg-indigo-400 ml-0.5 animate-pulse" />}
                      </div>
                    </div>
                  )}

                  {diagnosis && !analyzing && (
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={analyze}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Re-prompt
                      </button>
                    </div>
                  )}

                  {rateLimits && !analyzing && (
                    <div className="mt-2 text-right text-[10px] text-slate-400 font-mono">
                      API QUOTA: {rateLimits.remaining} REQ REMAINING
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {metrics && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Model Performance Metrics</CardTitle>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="chart-mode" className="text-xs">Mode</Label>
                  <Select value={chartMode} onValueChange={setChartMode}>
                    <SelectTrigger id="chart-mode" className="w-[110px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="absolute">Absolute</SelectItem>
                      <SelectItem value="error">Error Rate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {chartMode === 'absolute' && (
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="zoom" className="rounded border-slate-300" checked={zoomNearOne} onChange={(e) => setZoomNearOne(e.target.checked)} />
                    <Label htmlFor="zoom" className="text-xs text-slate-500">Zoom Y-Axis</Label>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {(() => {
                    const absData = [
                      { name: 'XGBoost', accuracy: metrics.xgboost.accuracy, auc: metrics.xgboost.auc },
                      { name: 'Random Forest', accuracy: metrics.random_forest.accuracy, auc: metrics.random_forest.auc },
                      { name: 'LogReg', accuracy: metrics.logistic_regression.accuracy, auc: metrics.logistic_regression.auc }
                    ];
                    const errorData = absData.map(d => ({ name: d.name, acc_error: 1 - d.accuracy, auc_gap: 1 - d.auc }));
                    const yDomain = chartMode === 'absolute' ? (zoomNearOne ? [0.9, 1] : [0, 1]) : [0, Math.max(...errorData.map(d => Math.max(d.acc_error, d.auc_gap))) * 1.2];
                    return (
                      <LineChart data={chartMode === 'absolute' ? absData : errorData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" interval={0} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                        <YAxis domain={yDomain} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          formatter={(v, n) => (typeof v === 'number' ? `${(v * 100).toFixed(2)}%` : v)}
                          labelFormatter={(l) => `Model: ${l}`}
                        />
                        <Legend />
                        {chartMode === 'absolute' ? (
                          <>
                            <ReferenceLine y={1} stroke="#94a3b8" strokeDasharray="4 4" ifOverflow="extendDomain" />
                            <Line type="monotone" dataKey="accuracy" stroke="#2563eb" strokeWidth={2} dot={{ r: 4, fill: '#2563eb' }} activeDot={{ r: 6 }} name="Accuracy" />
                            <Line type="monotone" dataKey="auc" stroke="#16a34a" strokeWidth={2} dot={{ r: 4, fill: '#16a34a' }} activeDot={{ r: 6 }} name="AUC" strokeDasharray="5 3" />
                          </>
                        ) : (
                          <>
                            <Line type="monotone" dataKey="acc_error" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} name="Accuracy Error" />
                            <Line type="monotone" dataKey="auc_gap" stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} name="AUC Gap" strokeDasharray="5 3" />
                          </>
                        )}
                      </LineChart>
                    );
                  })()}
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}

