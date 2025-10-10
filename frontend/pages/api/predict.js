import fs from 'fs';
import path from 'path';

let cache = null;

function loadArtifacts() {
  if (cache) return cache;
  const base = path.join(process.cwd(), 'public', 'model');
  const lr = JSON.parse(fs.readFileSync(path.join(base, 'lr_params.json'), 'utf-8'));
  const scaler = JSON.parse(fs.readFileSync(path.join(base, 'scaler.json'), 'utf-8'));
  const encoder = JSON.parse(fs.readFileSync(path.join(base, 'encoder.json'), 'utf-8'));
  const features = JSON.parse(fs.readFileSync(path.join(base, 'features.json'), 'utf-8'));
  cache = { lr, scaler, encoder, features };
  return cache;
}

function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { lr, scaler, encoder, features } = loadArtifacts();
    const body = req.body || {};
    const typeClasses = encoder.classes; // e.g., ['H','L','M']
    const typeValue = String(body.type || 'M');
    const typeIndex = Math.max(0, typeClasses.indexOf(typeValue));

    const inputMap = {
      Air_temperature_K: Number(body.air_temperature_K),
      Process_temperature_K: Number(body.process_temperature_K),
      Rotational_speed_rpm: Number(body.rotational_speed_rpm),
      Torque_Nm: Number(body.torque_Nm),
      Tool_wear_min: Number(body.tool_wear_min),
      Type_encoded: typeIndex
    };

    const x = features.map((f, i) => {
      const val = Number(inputMap[f]);
      const mu = scaler.mean[i];
      const sc = scaler.scale[i] || 1;
      return (val - mu) / sc;
    });

    const coef = lr.coef[0];
    const intercept = lr.intercept[0];
    const dot = x.reduce((s, v, i) => s + v * coef[i], intercept);
    const p = sigmoid(dot);
    const label = p >= 0.5 ? 1 : 0;

    const response = {
      inputs: body,
      predictions: {
        xgboost: { label, prob: p },
        random_forest: { label, prob: p },
        logistic_regression: { label, prob: p }
      }
    };
    res.status(200).json(response);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
