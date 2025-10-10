import os, json, joblib
import numpy as np

ART = os.path.join(os.path.dirname(__file__), 'artifacts')
OUT = os.path.join(os.path.dirname(__file__), 'frontend', 'public', 'model')
os.makedirs(OUT, exist_ok=True)

lr = joblib.load(os.path.join(ART, 'lr_model.pkl'))
scaler = joblib.load(os.path.join(ART, 'scaler.pkl'))
le = joblib.load(os.path.join(ART, 'label_encoder.pkl'))
with open(os.path.join(ART, 'features.json')) as f:
    features = json.load(f)

lr_params = {
    'coef': lr.coef_.tolist(),
    'intercept': lr.intercept_.tolist(),
}
scaler_params = {
    'mean': scaler.mean_.tolist(),
    'scale': scaler.scale_.tolist(),
}
encoder_params = {
    'classes': [str(c) for c in le.classes_]
}

with open(os.path.join(OUT, 'lr_params.json'), 'w') as f:
    json.dump(lr_params, f)
with open(os.path.join(OUT, 'scaler.json'), 'w') as f:
    json.dump(scaler_params, f)
with open(os.path.join(OUT, 'encoder.json'), 'w') as f:
    json.dump(encoder_params, f)
with open(os.path.join(OUT, 'features.json'), 'w') as f:
    json.dump(features, f)

metrics_path = os.path.join(ART, 'metrics.json')
if os.path.exists(metrics_path):
    with open(metrics_path) as f:
        metrics = json.load(f)
    with open(os.path.join(OUT, 'metrics.json'), 'w') as f:
        json.dump(metrics, f)

print('Exported LR params to', OUT)
