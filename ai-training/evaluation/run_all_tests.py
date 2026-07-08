"""
Run all quantitative tests on trained models
"""

import os
import sys
import logging
from pathlib import Path
import json
import time
from typing import Dict, List

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from utils.logger import setup_logger
from utils.data_utils import load_json, save_json

logger = logging.getLogger(__name__)


class ModelEvaluator:
    """Evaluate all trained models with quantitative metrics"""
    
    def __init__(self):
        self.logger = setup_logger("evaluation", level="INFO")
        self.results = {}
        
        # Paths
        self.models_dir = Path("models/trained")
        self.evaluation_dir = Path("evaluation/metrics")
        self.evaluation_dir.mkdir(parents=True, exist_ok=True)
    
    def evaluate_ocr(self) -> Dict:
        """Evaluate OCR model"""
        self.logger.info("\n" + "="*60)
        self.logger.info("EVALUATING OCR MODEL")
        self.logger.info("="*60)
        
        # Check if evaluation results exist
        eval_file = self.models_dir / "ocr_evaluation.json"
        
        if eval_file.exists():
            results = load_json(eval_file)
            self.logger.info("OCR Evaluation Results:")
            self.logger.info(f"  CER: {results.get('best_cer', 'N/A')}")
            self.logger.info(f"  WER: {results.get('best_wer', 'N/A')}")
            self.logger.info(f"  Training Time: {results.get('training_time', 'N/A')}s")
            
            return results
        else:
            self.logger.warning("No OCR evaluation results found. Train the model first.")
            return {}
    
    def evaluate_nlp(self) -> Dict:
        """Evaluate NLP model"""
        self.logger.info("\n" + "="*60)
        self.logger.info("EVALUATING NLP MODEL")
        self.logger.info("="*60)
        
        eval_file = self.models_dir / "nlp_evaluation.json"
        
        if eval_file.exists():
            results = load_json(eval_file)
            self.logger.info("NLP Evaluation Results:")
            self.logger.info(f"  Best BLEU: {results.get('best_bleu', 'N/A')}")
            self.logger.info(f"  Best Exact Match: {results.get('best_exact_match', 'N/A')}")
            self.logger.info(f"  Training Time: {results.get('training_time', 'N/A')}s")
            
            return results
        else:
            self.logger.warning("No NLP evaluation results found. Train the model first.")
            return {}
    
    def evaluate_self_fix(self) -> Dict:
        """Evaluate Self-Fix model"""
        self.logger.info("\n" + "="*60)
        self.logger.info("EVALUATING SELF-FIX MODEL")
        self.logger.info("="*60)
        
        eval_file = self.models_dir / "self_fix_evaluation.json"
        
        if eval_file.exists():
            results = load_json(eval_file)
            self.logger.info("Self-Fix Evaluation Results:")
            self.logger.info(f"  Best F1: {results.get('best_f1', 'N/A')}")
            self.logger.info(f"  Best Precision: {results.get('best_precision', 'N/A')}")
            self.logger.info(f"  Best Recall: {results.get('best_recall', 'N/A')}")
            self.logger.info(f"  Training Time: {results.get('training_time', 'N/A')}s")
            
            return results
        else:
            self.logger.warning("No Self-Fix evaluation results found. Train the model first.")
            return {}
    
    def evaluate_rag(self) -> Dict:
        """Evaluate RAG model"""
        self.logger.info("\n" + "="*60)
        self.logger.info("EVALUATING RAG MODEL")
        self.logger.info("="*60)
        
        eval_file = self.models_dir / "rag_evaluation.json"
        
        if eval_file.exists():
            results = load_json(eval_file)
            self.logger.info("RAG Evaluation Results:")
            self.logger.info(f"  Best Precision@5: {results.get('best_precision_at_5', 'N/A')}")
            self.logger.info(f"  Best MRR: {results.get('best_mrr', 'N/A')}")
            self.logger.info(f"  Training Time: {results.get('training_time', 'N/A')}s")
            
            return results
        else:
            self.logger.warning("No RAG evaluation results found. Train the model first.")
            return {}
    
    def evaluate_time_series(self) -> Dict:
        """Evaluate Time Series model"""
        self.logger.info("\n" + "="*60)
        self.logger.info("EVALUATING TIME SERIES MODEL")
        self.logger.info("="*60)
        
        eval_file = self.models_dir / "time_series_evaluation.json"
        
        if eval_file.exists():
            results = load_json(eval_file)
            self.logger.info("Time Series Evaluation Results:")
            self.logger.info(f"  Prophet MAE: {results.get('prophet_mae', 'N/A')}")
            self.logger.info(f"  Prophet RMSE: {results.get('prophet_rmse', 'N/A')}")
            self.logger.info(f"  LSTM MAE: {results.get('lstm_mae', 'N/A')}")
            self.logger.info(f"  LSTM RMSE: {results.get('lstm_rmse', 'N/A')}")
            self.logger.info(f"  Training Time: {results.get('training_time', 'N/A')}s")
            
            return results
        else:
            self.logger.warning("No Time Series evaluation results found. Train the model first.")
            return {}
    
    def compare_with_thresholds(self, results: Dict[str, Dict]) -> Dict[str, Dict]:
        """Compare results with minimum thresholds from config"""
        self.logger.info("\n" + "="*60)
        self.logger.info("COMPARING WITH THRESHOLDS")
        self.logger.info("="*60)
        
        # Load config
        import yaml
        with open("config/config.yaml", 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
        
        thresholds = config['thresholds']
        comparison = {}
        
        # OCR
        if 'ocr' in results and results['ocr']:
            cer_pass = results['ocr'].get('best_cer', 1.0) <= thresholds['ocr']['cer']
            wer_pass = results['ocr'].get('best_wer', 1.0) <= thresholds['ocr']['wer']
            comparison['ocr'] = {
                'cer_pass': cer_pass,
                'wer_pass': wer_pass,
                'overall_pass': cer_pass and wer_pass
            }
            
            self.logger.info(f"OCR - CER: {'✓ PASS' if cer_pass else '✗ FAIL'}, "
                           f"WER: {'✓ PASS' if wer_pass else '✗ FAIL'}")
        
        # NLP
        if 'nlp' in results and results['nlp']:
            em_pass = results['nlp'].get('best_exact_match', 0.0) >= thresholds['nlp']['exact_match']
            bleu_pass = results['nlp'].get('best_bleu', 0.0) >= thresholds['nlp']['bleu']
            comparison['nlp'] = {
                'exact_match_pass': em_pass,
                'bleu_pass': bleu_pass,
                'overall_pass': em_pass and bleu_pass
            }
            
            self.logger.info(f"NLP - Exact Match: {'✓ PASS' if em_pass else '✗ FAIL'}, "
                           f"BLEU: {'✓ PASS' if bleu_pass else '✗ FAIL'}")
        
        # Self-Fix
        if 'self_fix' in results and results['self_fix']:
            precision_pass = results['self_fix'].get('best_precision', 0.0) >= thresholds['self_fix']['precision']
            recall_pass = results['self_fix'].get('best_recall', 0.0) >= thresholds['self_fix']['recall']
            f1_pass = results['self_fix'].get('best_f1', 0.0) >= thresholds['self_fix']['f1_score']
            comparison['self_fix'] = {
                'precision_pass': precision_pass,
                'recall_pass': recall_pass,
                'f1_pass': f1_pass,
                'overall_pass': precision_pass and recall_pass and f1_pass
            }
            
            self.logger.info(f"Self-Fix - Precision: {'✓ PASS' if precision_pass else '✗ FAIL'}, "
                           f"Recall: {'✓ PASS' if recall_pass else '✗ FAIL'}, "
                           f"F1: {'✓ PASS' if f1_pass else '✗ FAIL'}")
        
        # RAG
        if 'rag' in results and results['rag']:
            p5_pass = results['rag'].get('best_precision_at_5', 0.0) >= thresholds['rag']['precision_at_5']
            mrr_pass = results['rag'].get('best_mrr', 0.0) >= thresholds['rag']['mrr']
            comparison['rag'] = {
                'precision_at_5_pass': p5_pass,
                'mrr_pass': mrr_pass,
                'overall_pass': p5_pass and mrr_pass
            }
            
            self.logger.info(f"RAG - P@5: {'✓ PASS' if p5_pass else '✗ FAIL'}, "
                           f"MRR: {'✓ PASS' if mrr_pass else '✗ FAIL'}")
        
        # Time Series
        if 'time_series' in results and results['time_series']:
            mae_pass = results['time_series'].get('prophet_mae', 1.0) <= thresholds['time_series']['mape']
            comparison['time_series'] = {
                'mae_pass': mae_pass,
                'overall_pass': mae_pass
            }
            
            self.logger.info(f"Time Series - MAE: {'✓ PASS' if mae_pass else '✗ FAIL'}")
        
        return comparison
    
    def generate_report(self, results: Dict[str, Dict], comparison: Dict[str, Dict]) -> str:
        """Generate evaluation report"""
        self.logger.info("\n" + "="*60)
        self.logger.info("GENERATING EVALUATION REPORT")
        self.logger.info("="*60)
        
        report = []
        report.append("# AI Model Evaluation Report")
        report.append(f"\n**Generated:** {time.strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("\n## Summary\n")
        
        # Count passes/fails
        total_models = 0
        passed_models = 0
        
        for model_name, model_results in results.items():
            if model_results:
                total_models += 1
                if comparison.get(model_name, {}).get('overall_pass', False):
                    passed_models += 1
        
        report.append(f"- **Total Models Evaluated:** {total_models}")
        report.append(f"- **Models Passing Thresholds:** {passed_models}/{total_models}")
        report.append(f"- **Success Rate:** {100*passed_models/total_models:.1f}%" if total_models > 0 else "N/A")
        
        # Detailed results
        report.append("\n## Detailed Results\n")
        
        for model_name, model_results in results.items():
            if not model_results:
                continue
            
            report.append(f"### {model_name.upper()}\n")
            
            if model_name == 'ocr':
                report.append(f"- **CER:** {model_results.get('best_cer', 'N/A'):.4f}")
                report.append(f"- **WER:** {model_results.get('best_wer', 'N/A'):.4f}")
                report.append(f"- **Training Time:** {model_results.get('training_time', 'N/A'):.2f}s")
            
            elif model_name == 'nlp':
                report.append(f"- **Best BLEU:** {model_results.get('best_bleu', 'N/A'):.4f}")
                report.append(f"- **Best Exact Match:** {model_results.get('best_exact_match', 'N/A'):.4f}")
                report.append(f"- **Training Time:** {model_results.get('training_time', 'N/A'):.2f}s")
            
            elif model_name == 'self_fix':
                report.append(f"- **Best F1:** {model_results.get('best_f1', 'N/A'):.4f}")
                report.append(f"- **Best Precision:** {model_results.get('best_precision', 'N/A'):.4f}")
                report.append(f"- **Best Recall:** {model_results.get('best_recall', 'N/A'):.4f}")
                report.append(f"- **Training Time:** {model_results.get('training_time', 'N/A'):.2f}s")
            
            elif model_name == 'rag':
                report.append(f"- **Best Precision@5:** {model_results.get('best_precision_at_5', 'N/A'):.4f}")
                report.append(f"- **Best MRR:** {model_results.get('best_mrr', 'N/A'):.4f}")
                report.append(f"- **Training Time:** {model_results.get('training_time', 'N/A'):.2f}s")
            
            elif model_name == 'time_series':
                report.append(f"- **Prophet MAE:** {model_results.get('prophet_mae', 'N/A'):.4f}")
                report.append(f"- **Prophet RMSE:** {model_results.get('prophet_rmse', 'N/A'):.4f}")
                report.append(f"- **LSTM MAE:** {model_results.get('lstm_mae', 'N/A'):.4f}")
                report.append(f"- **LSTM RMSE:** {model_results.get('lstm_rmse', 'N/A'):.4f}")
                report.append(f"- **Training Time:** {model_results.get('training_time', 'N/A'):.2f}s")
            
            report.append("")
        
        # Threshold comparison
        report.append("\n## Threshold Comparison\n")
        report.append("| Model | Metric | Value | Threshold | Status |")
        report.append("|-------|--------|-------|-----------|--------|")
        
        # Add threshold comparison rows
        if 'ocr' in comparison:
            report.append(f"| OCR | CER | {results['ocr'].get('best_cer', 'N/A'):.4f} | ≤0.05 | {'✓' if comparison['ocr']['cer_pass'] else '✗'} |")
            report.append(f"| OCR | WER | {results['ocr'].get('best_wer', 'N/A'):.4f} | ≤0.10 | {'✓' if comparison['ocr']['wer_pass'] else '✗'} |")
        
        if 'nlp' in comparison:
            report.append(f"| NLP | Exact Match | {results['nlp'].get('best_exact_match', 'N/A'):.4f} | ≥0.70 | {'✓' if comparison['nlp']['exact_match_pass'] else '✗'} |")
            report.append(f"| NLP | BLEU | {results['nlp'].get('best_bleu', 'N/A'):.4f} | ≥0.75 | {'✓' if comparison['nlp']['bleu_pass'] else '✗'} |")
        
        if 'self_fix' in comparison:
            report.append(f"| Self-Fix | Precision | {results['self_fix'].get('best_precision', 'N/A'):.4f} | ≥0.80 | {'✓' if comparison['self_fix']['precision_pass'] else '✗'} |")
            report.append(f"| Self-Fix | Recall | {results['self_fix'].get('best_recall', 'N/A'):.4f} | ≥0.75 | {'✓' if comparison['self_fix']['recall_pass'] else '✗'} |")
            report.append(f"| Self-Fix | F1 | {results['self_fix'].get('best_f1', 'N/A'):.4f} | ≥0.77 | {'✓' if comparison['self_fix']['f1_pass'] else '✗'} |")
        
        if 'rag' in comparison:
            report.append(f"| RAG | Precision@5 | {results['rag'].get('best_precision_at_5', 'N/A'):.4f} | ≥0.85 | {'✓' if comparison['rag']['precision_at_5_pass'] else '✗'} |")
            report.append(f"| RAG | MRR | {results['rag'].get('best_mrr', 'N/A'):.4f} | ≥0.80 | {'✓' if comparison['rag']['mrr_pass'] else '✗'} |")
        
        report.append("\n## Next Steps\n")
        report.append("1. Review models that failed to meet thresholds")
        report.append("2. Collect more training data for underperforming models")
        report.append("3. Fine-tune hyperparameters")
        report.append("4. Retrain models")
        report.append("5. Export production-ready models: `python scripts/export_models.py`")
        
        report_text = "\n".join(report)
        
        # Save report
        report_path = Path("evaluation/reports/evaluation_report.md")
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(report_text, encoding='utf-8')
        
        self.logger.info(f"Report saved to: {report_path}")
        
        return report_text
    
    def run_all_evaluations(self) -> None:
        """Run all evaluations"""
        self.logger.info("="*60)
        self.logger.info("RUNNING ALL MODEL EVALUATIONS")
        self.logger.info("="*60)
        
        start_time = time.time()
        
        # Evaluate all models
        results = {
            'ocr': self.evaluate_ocr(),
            'nlp': self.evaluate_nlp(),
            'self_fix': self.evaluate_self_fix(),
            'rag': self.evaluate_rag(),
            'time_series': self.evaluate_time_series()
        }
        
        # Compare with thresholds
        comparison = self.compare_with_thresholds(results)
        
        # Generate report
        report = self.generate_report(results, comparison)
        
        # Print report
        print("\n" + report)
        
        total_time = time.time() - start_time
        self.logger.info(f"\nTotal evaluation time: {total_time:.2f} seconds")
        
        # Save combined results
        combined_results = {
            'evaluations': results,
            'threshold_comparison': comparison,
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
        }
        
        results_file = self.evaluation_dir / "all_evaluations.json"
        save_json(combined_results, results_file)
        
        self.logger.info(f"Combined results saved to: {results_file}")


def main():
    """Main function"""
    evaluator = ModelEvaluator()
    evaluator.run_all_evaluations()


if __name__ == "__main__":
    main()