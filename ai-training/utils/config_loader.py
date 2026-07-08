"""
Configuration loader utility
"""

import yaml
from pathlib import Path
from typing import Dict, Any
import os


def load_config(config_path: str = "config/config.yaml") -> Dict[str, Any]:
    """
    Load configuration from YAML file
    
    Args:
        config_path: Path to config.yaml file
        
    Returns:
        Configuration dictionary
    """
    config_file = Path(config_path)
    
    if not config_file.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")
    
    with open(config_file, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)
    
    # Override with environment variables if present
    config = _override_with_env(config)
    
    return config


def _override_with_env(config: Dict[str, Any]) -> Dict[str, Any]:
    """Override config values with environment variables"""
    
    # Hardware overrides
    if 'CUDA_VISIBLE_DEVICES' in os.environ:
        config['hardware']['gpu_enabled'] = True
    
    # Path overrides
    if 'DATA_PATH' in os.environ:
        config['paths']['data_raw'] = os.environ['DATA_PATH']
    
    if 'MODELS_PATH' in os.environ:
        config['paths']['models_trained'] = os.environ['MODELS_PATH']
    
    return config


def get_config(key: str, default: Any = None) -> Any:
    """
    Get a specific config value using dot notation
    
    Args:
        key: Config key in dot notation (e.g., 'hardware.gpu_enabled')
        default: Default value if key not found
        
    Returns:
        Config value or default
    """
    config = load_config()
    
    keys = key.split('.')
    value = config
    
    for k in keys:
        if isinstance(value, dict) and k in value:
            value = value[k]
        else:
            return default
    
    return value


def save_config(config: Dict[str, Any], config_path: str = "config/config.yaml") -> None:
    """
    Save configuration to YAML file
    
    Args:
        config: Configuration dictionary
        config_path: Path to save config
    """
    config_file = Path(config_path)
    config_file.parent.mkdir(parents=True, exist_ok=True)
    
    with open(config_file, 'w', encoding='utf-8') as f:
        yaml.dump(config, f, default_flow_style=False, allow_unicode=True, sort_keys=False)


def print_config(config: Dict[str, Any], indent: int = 0) -> None:
    """Pretty print configuration"""
    
    for key, value in config.items():
        if isinstance(value, dict):
            print("  " * indent + f"{key}:")
            print_config(value, indent + 1)
        else:
            print("  " * indent + f"{key}: {value}")


if __name__ == "__main__":
    # Test config loader
    config = load_config()
    print("Configuration loaded successfully!")
    print("\nHardware Config:")
    print(f"  GPU: {config['hardware']['gpu_name']}")
    print(f"  VRAM: {config['hardware']['gpu_vram_gb']}GB")
    print(f"  Batch Size: {config['hardware']['batch_size']}")
    
    print("\nModel Configs:")
    for model_name, model_config in config['models'].items():
        print(f"  {model_name}: {model_config.get('base_model', model_config.get('algorithm', 'N/A'))}")