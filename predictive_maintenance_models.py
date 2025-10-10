import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, roc_auc_score
import xgboost as xgb
import warnings
warnings.filterwarnings('ignore')
import os
import joblib
import json

df = pd.read_csv('data/predictive_maintenance.csv')

le = LabelEncoder()
df['Type_encoded'] = le.fit_transform(df['Type'])

feature_cols = ['Air_temperature_K', 'Process_temperature_K', 'Rotational_speed_rpm', 
                'Torque_Nm', 'Tool_wear_min', 'Type_encoded']

df_clean = df.copy()
df_clean['Air_temperature_K'] = df['Air temperature [K]']
df_clean['Process_temperature_K'] = df['Process temperature [K]']
df_clean['Rotational_speed_rpm'] = df['Rotational speed [rpm]']
df_clean['Torque_Nm'] = df['Torque [Nm]']
df_clean['Tool_wear_min'] = df['Tool wear [min]']

X = df_clean[feature_cols]
y = df['Target']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

xgb_model = xgb.XGBClassifier(n_estimators=200, max_depth=6, learning_rate=0.1, random_state=42, eval_metric='logloss')
xgb_model.fit(X_train, y_train)
xgb_pred = xgb_model.predict(X_test)
xgb_accuracy = accuracy_score(y_test, xgb_pred)
xgb_auc = roc_auc_score(y_test, xgb_model.predict_proba(X_test)[:, 1])

rf_model = RandomForestClassifier(n_estimators=200, max_depth=12, min_samples_split=5, random_state=42)
rf_model.fit(X_train, y_train)
rf_pred = rf_model.predict(X_test)
rf_accuracy = accuracy_score(y_test, rf_pred)
rf_auc = roc_auc_score(y_test, rf_model.predict_proba(X_test)[:, 1])

lr_model = LogisticRegression(C=1.0, max_iter=1000, random_state=42)
lr_model.fit(X_train_scaled, y_train)
lr_pred = lr_model.predict(X_test_scaled)
lr_accuracy = accuracy_score(y_test, lr_pred)
lr_auc = roc_auc_score(y_test, lr_model.predict_proba(X_test_scaled)[:, 1])

print("PREDICTIVE MAINTENANCE MODELS PERFORMANCE")
print("=" * 50)
print(f"XGBoost Accuracy: {xgb_accuracy:.4f} | AUC: {xgb_auc:.4f}")
print(f"Random Forest Accuracy: {rf_accuracy:.4f} | AUC: {rf_auc:.4f}")
print(f"Logistic Regression Accuracy: {lr_accuracy:.4f} | AUC: {lr_auc:.4f}")
print("=" * 50)

print("\nXGBOOST DETAILED RESULTS")
print(classification_report(y_test, xgb_pred))
print("Confusion Matrix:")
print(confusion_matrix(y_test, xgb_pred))

print("\nRANDOM FOREST DETAILED RESULTS")
print(classification_report(y_test, rf_pred))
print("Confusion Matrix:")
print(confusion_matrix(y_test, rf_pred))

print("\nLOGISTIC REGRESSION DETAILED RESULTS")
print(classification_report(y_test, lr_pred))
print("Confusion Matrix:")
print(confusion_matrix(y_test, lr_pred))

feature_importance_xgb = pd.DataFrame({
    'feature': X.columns,
    'importance': xgb_model.feature_importances_
}).sort_values('importance', ascending=False)

print("\nXGBOOST FEATURE IMPORTANCE")
print(feature_importance_xgb)

feature_importance_rf = pd.DataFrame({
    'feature': X.columns,
    'importance': rf_model.feature_importances_
}).sort_values('importance', ascending=False)

print("\nRANDOM FOREST FEATURE IMPORTANCE")
print(feature_importance_rf)

xgb_cv_scores = cross_val_score(xgb_model, X_train, y_train, cv=5, scoring='accuracy')
rf_cv_scores = cross_val_score(rf_model, X_train, y_train, cv=5, scoring='accuracy')
lr_cv_scores = cross_val_score(lr_model, X_train_scaled, y_train, cv=5, scoring='accuracy')

print("\nCROSS VALIDATION SCORES")
print(f"XGBoost CV Mean: {xgb_cv_scores.mean():.4f} (+/- {xgb_cv_scores.std() * 2:.4f})")
print(f"Random Forest CV Mean: {rf_cv_scores.mean():.4f} (+/- {rf_cv_scores.std() * 2:.4f})")
print(f"Logistic Regression CV Mean: {lr_cv_scores.mean():.4f} (+/- {lr_cv_scores.std() * 2:.4f})")

def predict_failure(air_temp, process_temp, rot_speed, torque, tool_wear, machine_type):
    type_encoded = le.transform([machine_type])[0]
    sample = np.array([[air_temp, process_temp, rot_speed, torque, tool_wear, type_encoded]])
    sample_scaled = scaler.transform(sample)
    
    xgb_prediction = xgb_model.predict(sample)[0]
    rf_prediction = rf_model.predict(sample)[0]
    lr_prediction = lr_model.predict(sample_scaled)[0]
    
    xgb_prob = xgb_model.predict_proba(sample)[0][1]
    rf_prob = rf_model.predict_proba(sample)[0][1]
    lr_prob = lr_model.predict_proba(sample_scaled)[0][1]
    
    print(f"\nPREDICTION FOR NEW SAMPLE")
    print(f"XGBoost: {'FAILURE' if xgb_prediction else 'NO FAILURE'} (Prob: {xgb_prob:.3f})")
    print(f"Random Forest: {'FAILURE' if rf_prediction else 'NO FAILURE'} (Prob: {rf_prob:.3f})")
    print(f"Logistic Regression: {'FAILURE' if lr_prediction else 'NO FAILURE'} (Prob: {lr_prob:.3f})")
    
    return xgb_prediction, rf_prediction, lr_prediction

sample_prediction = predict_failure(298.5, 308.5, 1500, 45.0, 100, 'M')

models_performance = [
    ('XGBoost', xgb_accuracy, xgb_auc),
    ('Random Forest', rf_accuracy, rf_auc),
    ('Logistic Regression', lr_accuracy, lr_auc)
]

best_model = max(models_performance, key=lambda x: x[2])
print(f"\nBEST MODEL: {best_model[0]} with accuracy {best_model[1]:.4f} and AUC {best_model[2]:.4f}")

print("\nMODEL COMPARISON SUMMARY")
for name, acc, auc in models_performance:
    print(f"{name}: Accuracy={acc:.4f}, AUC={auc:.4f}")

art_dir = "artifacts"
os.makedirs(art_dir, exist_ok=True)
joblib.dump(xgb_model, os.path.join(art_dir, "xgb_model.pkl"))
joblib.dump(rf_model, os.path.join(art_dir, "rf_model.pkl"))
joblib.dump(lr_model, os.path.join(art_dir, "lr_model.pkl"))
joblib.dump(scaler, os.path.join(art_dir, "scaler.pkl"))
joblib.dump(le, os.path.join(art_dir, "label_encoder.pkl"))
with open(os.path.join(art_dir, "features.json"), "w") as f:
    json.dump(list(X.columns), f)
with open(os.path.join(art_dir, "metrics.json"), "w") as f:
    json.dump({
        "xgboost": {"accuracy": float(xgb_accuracy), "auc": float(xgb_auc)},
        "random_forest": {"accuracy": float(rf_accuracy), "auc": float(rf_auc)},
        "logistic_regression": {"accuracy": float(lr_accuracy), "auc": float(lr_auc)},
        "best_model": best_model[0]
    }, f)
