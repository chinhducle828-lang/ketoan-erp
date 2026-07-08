"""
Master Automation Script - Automate entire AI training pipeline
"""

import os
import sys
import subprocess
import time
from pathlib import Path
from datetime import datetime

def run_command(command, description, cwd=None):
    """Run shell command with logging"""
    print(f"\n{'='*60}")
    print(f"STEP: {description}")
    print(f"Command: {command}")
    print(f"{'='*60}\n")
    
    start_time = time.time()
    
    try:
        result = subprocess.run(
            command,
            shell=True,
            check=True,
            cwd=cwd or Path(__file__).parent,
            capture_output=False,
            text=True
        )
        
        elapsed = time.time() - start_time
        print(f"\n✅ {description} completed in {elapsed:.2f} seconds")
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"\n❌ {description} failed!")
        print(f"Error: {e}")
        return False

def check_python_version():
    """Check Python version"""
    print("\n" + "="*60)
    print("CHECKING PYTHON VERSION")
    print("="*60)
    
    version = sys.version_info
    print(f"Python version: {version.major}.{version.minor}.{version.micro}")
    
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print("❌ Python 3.8+ required!")
        return False
    
    print("✅ Python version OK")
    return True

def setup_virtual_environment():
    """Create and activate virtual environment"""
    print("\n" + "="*60)
    print("SETTING UP VIRTUAL ENVIRONMENT")
    print("="*60)
    
    venv_path = Path("venv")
    
    if venv_path.exists():
        print("⚠️  Virtual environment already exists")
        response = input("Do you want to recreate it? (y/n): ")
        if response.lower() == 'y':
            import shutil
            shutil.rmtree(venv_path)
            print("🗑️  Removed old virtual environment")
        else:
            print("✅ Using existing virtual environment")
            return True
    
    # Create virtual environment
    result = run_command(
        "python -m venv venv",
        "Create virtual environment"
    )
    
    if not result:
        return False
    
    print("\n✅ Virtual environment created")
    print("⚠️  Please activate it manually:")
    print("   Windows: venv\\Scripts\\activate")
    print("   Linux/Mac: source venv/bin/activate")
    
    return True

def install_dependencies():
    """Install Python dependencies"""
    print("\n" + "="*60)
    print("INSTALLING DEPENDENCIES")
    print("="*60)
    
    # Determine pip path
    if os.name == 'nt':  # Windows
        pip_path = "venv\\Scripts\\pip"
    else:  # Linux/Mac
        pip_path = "venv/bin/pip"
    
    # Upgrade pip
    result = run_command(
        f"{pip_path} install --upgrade pip",
        "Upgrade pip"
    )
    
    if not result:
        return False
    
    # Install requirements
    result = run_command(
        f"{pip_path} install -r requirements.txt",
        "Install dependencies (this may take 10-15 minutes)"
    )
    
    return result

def verify_gpu():
    """Verify GPU availability"""
    print("\n" + "="*60)
    print("VERIFYING GPU")
    print("="*60)
    
    # Determine python path
    if os.name == 'nt':
        python_path = "venv\\Scripts\\python"
    else:
        python_path = "venv/bin/python"
    
    result = run_command(
        f"{python_path} -c \"from utils.gpu_utils import print_system_info; print_system_info()\"",
        "Check GPU and system info"
    )
    
    return result

def generate_data():
    """Generate synthetic training data"""
    print("\n" + "="*60)
    print("GENERATING SYNTHETIC DATA")
    print("="*60)
    
    # Determine python path
    if os.name == 'nt':
        python_path = "venv\\Scripts\\python"
    else:
        python_path = "venv/bin/python"
    
    result = run_command(
        f"{python_path} scripts/generate_synthetic_data.py",
        "Generate synthetic training data"
    )
    
    return result

def train_models(model_type="all"):
    """Train AI models"""
    print("\n" + "="*60)
    print("TRAINING AI MODELS")
    print("="*60)
    
    # Determine python path
    if os.name == 'nt':
        python_path = "venv\\Scripts\\python"
    else:
        python_path = "venv/bin/python"
    
    # Build command
    if model_type == "all":
        command = f"{python_path} scripts/train_all.py"
    else:
        command = f"{python_path} scripts/train_all.py --model {model_type}"
    
    result = run_command(
        command,
        f"Train {model_type} model(s)",
        timeout=7200  # 2 hour timeout
    )
    
    return result

def evaluate_models():
    """Evaluate trained models"""
    print("\n" + "="*60)
    print("EVALUATING MODELS")
    print("="*60)
    
    # Determine python path
    if os.name == 'nt':
        python_path = "venv\\Scripts\\python"
    else:
        python_path = "venv/bin/python"
    
    result = run_command(
        f"{python_path} evaluation/run_all_tests.py",
        "Evaluate all models"
    )
    
    return result

def export_models():
    """Export models to production format"""
    print("\n" + "="*60)
    print("EXPORTING MODELS")
    print("="*60)
    
    # Determine python path
    if os.name == 'nt':
        python_path = "venv\\Scripts\\python"
    else:
        python_path = "venv/bin/python"
    
    result = run_command(
        f"{python_path} scripts/export_models.py",
        "Export models to production format"
    )
    
    return result

def main():
    """Main automation pipeline"""
    print("\n" + "="*60)
    print("🤖 AI TRAINING PIPELINE AUTOMATION")
    print("="*60)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)
    
    start_time = time.time()
    
    # Get user preferences
    print("\n📋 Configuration:")
    print("1. Full pipeline (setup + data + train + evaluate + export)")
    print("2. Skip setup (if already installed)")
    print("3. Train specific model only")
    
    choice = input("\nSelect option (1-3): ").strip()
    
    if choice == "1":
        # Full pipeline
        steps = [
            ("Check Python version", check_python_version),
            ("Setup virtual environment", setup_virtual_environment),
            ("Install dependencies", install_dependencies),
            ("Verify GPU", verify_gpu),
            ("Generate synthetic data", generate_data),
            ("Train models", lambda: train_models("all")),
            ("Evaluate models", evaluate_models),
            ("Export models", export_models)
        ]
        
    elif choice == "2":
        # Skip setup
        steps = [
            ("Verify GPU", verify_gpu),
            ("Generate synthetic data", generate_data),
            ("Train models", lambda: train_models("all")),
            ("Evaluate models", evaluate_models),
            ("Export models", export_models)
        ]
        
    elif choice == "3":
        # Train specific model
        model = input("Enter model name (ocr/nlp/self_fix/rag/time_series): ").strip()
        steps = [
            ("Verify GPU", verify_gpu),
            ("Generate synthetic data", generate_data),
            ("Train model", lambda: train_models(model)),
            ("Evaluate models", evaluate_models)
        ]
    
    else:
        print("❌ Invalid choice!")
        return
    
    # Execute steps
    failed_steps = []
    
    for step_name, step_func in steps:
        print(f"\n{'='*60}")
        print(f"📍 Progress: {steps.index((step_name, step_func)) + 1}/{len(steps)}")
        print(f"{'='*60}")
        
        try:
            result = step_func()
            if not result:
                failed_steps.append(step_name)
                print(f"\n⚠️  Step failed: {step_name}")
                continue
        except Exception as e:
            print(f"\n❌ Step failed with exception: {step_name}")
            print(f"Error: {e}")
            failed_steps.append(step_name)
            continue
    
    # Final summary
    total_time = time.time() - start_time
    
    print("\n" + "="*60)
    print("🎉 AUTOMATION COMPLETE!")
    print("="*60)
    print(f"Total time: {total_time:.2f} seconds ({total_time/60:.2f} minutes)")
    print(f"Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    if failed_steps:
        print(f"\n⚠️  Failed steps: {', '.join(failed_steps)}")
        print("Please check the logs and fix the issues.")
    else:
        print("\n✅ All steps completed successfully!")
    
    print("\n📊 Results:")
    print("  - Trained models: models/trained/")
    print("  - Exported models: models/exported/")
    print("  - Evaluation reports: evaluation/reports/")
    print("  - Logs: logs/")
    
    print("\n📝 Next steps:")
    print("  1. Review evaluation results in evaluation/reports/")
    print("  2. Check model metrics in models/trained/*_evaluation.json")
    print("  3. Integrate exported models into ai-service/")
    print("  4. Deploy to Railway")
    
    print("\n" + "="*60)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Automation interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Automation failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)