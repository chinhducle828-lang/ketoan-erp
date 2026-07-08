"""Display Self-Fix model evaluation results"""
import json
from pathlib import Path

eval_path = Path('models/trained/self_fix_evaluation.json')
if eval_path.exists():
    metrics = json.load(open(eval_path))
    print('='*60)
    print('SELF-FIX MODEL EVALUATION RESULTS')
    print('='*60)
    print(f"Model: {metrics.get('model', 'N/A')}")
    print(f"Algorithm: {metrics.get('config', {}).get('algorithm', 'N/A')}")
    print(f"Training Time: {metrics.get('training_time', 0):.2f}s")
    print()
    print('Performance Metrics:')
    print(f"  Accuracy:  {metrics.get('val_accuracy', 0):.4f}")
    print(f"  Precision: {metrics.get('best_precision', 0):.4f}")
    print(f"  Recall:    {metrics.get('best_recall', 0):.4f}")
    print(f"  F1 Score:  {metrics.get('best_f1', 0):.4f}")
    print()
    print('Confusion Matrix:')
    cm = metrics.get('confusion_matrix', [[0,0],[0,0]])
    print(f"  True Neg:  {cm[0][0]}")
    print(f"  False Pos: {cm[0][1]}")
    print(f"  False Neg: {cm[1][0]}")
    print(f"  True Pos:  {cm[1][1]}")
    print()
    print('Top Features:')
    for feat in metrics.get('feature_importance', [])[:5]:
        print(f"  {feat['feature']}: {feat['importance']:.2f}")
    print('='*60)
else:
    print('Evaluation file not found')