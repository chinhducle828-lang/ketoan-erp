"""
GPU utilities for training
"""

import torch
import psutil
from typing import Dict, Tuple, Optional
import logging

logger = logging.getLogger(__name__)


def check_gpu_availability() -> Dict[str, any]:
    """
    Check GPU availability and return detailed info
    
    Returns:
        Dictionary with GPU information
    """
    gpu_info = {
        'available': False,
        'count': 0,
        'name': None,
        'memory_total': 0,
        'memory_allocated': 0,
        'memory_free': 0,
        'cuda_version': None
    }
    
    if not torch.cuda.is_available():
        logger.warning("CUDA not available. Training will use CPU (slower).")
        return gpu_info
    
    gpu_info['available'] = True
    gpu_info['count'] = torch.cuda.device_count()
    gpu_info['name'] = torch.cuda.get_device_name(0)
    gpu_info['memory_total'] = torch.cuda.get_device_properties(0).total_memory / 1024**3  # GB
    gpu_info['memory_allocated'] = torch.cuda.memory_allocated(0) / 1024**3  # GB
    gpu_info['memory_free'] = gpu_info['memory_total'] - gpu_info['memory_allocated']
    gpu_info['cuda_version'] = torch.version.cuda
    
    logger.info(f"GPU detected: {gpu_info['name']}")
    logger.info(f"  - Total memory: {gpu_info['memory_total']:.2f} GB")
    logger.info(f"  - Free memory: {gpu_info['memory_free']:.2f} GB")
    logger.info(f"  - CUDA version: {gpu_info['cuda_version']}")
    
    return gpu_info


def get_gpu_info() -> Dict[str, any]:
    """Get detailed GPU information"""
    return check_gpu_availability()


def optimize_gpu_memory():
    """Optimize GPU memory usage for training"""
    
    if not torch.cuda.is_available():
        return
    
    # Clear cache
    torch.cuda.empty_cache()
    
    # Enable cuDNN autotuner
    torch.backends.cudnn.benchmark = True
    torch.backends.cudnn.enabled = True
    
    # Set memory allocation strategy
    torch.cuda.set_per_process_memory_fraction(0.95)  # Use up to 95% of GPU memory
    
    logger.info("GPU memory optimized")


def get_optimal_batch_size(model_size_gb: float, gpu_memory_gb: float, 
                          safety_margin: float = 0.2) -> int:
    """
    Calculate optimal batch size based on model size and GPU memory
    
    Args:
        model_size_gb: Estimated model size in GB
        gpu_memory_gb: Available GPU memory in GB
        safety_margin: Safety margin (20% by default)
        
    Returns:
        Optimal batch size
    """
    available_memory = gpu_memory_gb * (1 - safety_margin)
    memory_per_sample = model_size_gb / 32  # Assume batch_size=32 as baseline
    
    optimal_batch_size = int(available_memory / memory_per_sample)
    
    # Round to power of 2 (better for GPU)
    optimal_batch_size = 2 ** int(torch.log2(torch.tensor(optimal_batch_size)))
    
    return max(1, min(optimal_batch_size, 64))  # Clamp between 1 and 64


def monitor_gpu_usage(interval: int = 1) -> None:
    """
    Monitor GPU usage during training
    
    Args:
        interval: Monitoring interval in seconds
    """
    import time
    
    if not torch.cuda.is_available():
        logger.warning("GPU not available for monitoring")
        return
    
    logger.info("GPU Monitoring started (press Ctrl+C to stop)")
    
    try:
        while True:
            allocated = torch.cuda.memory_allocated(0) / 1024**3
            reserved = torch.cuda.memory_reserved(0) / 1024**3
            total = torch.cuda.get_device_properties(0).total_memory / 1024**3
            
            logger.info(
                f"GPU Memory: {allocated:.2f}GB allocated, "
                f"{reserved:.2f}GB reserved, {total:.2f}GB total "
                f"({100*allocated/total:.1f}% used)"
            )
            
            time.sleep(interval)
    
    except KeyboardInterrupt:
        logger.info("GPU monitoring stopped")


def get_system_info() -> Dict[str, any]:
    """Get system information (CPU, RAM, GPU)"""
    
    info = {
        'cpu': {
            'cores': psutil.cpu_count(logical=False),
            'threads': psutil.cpu_count(logical=True),
            'usage_percent': psutil.cpu_percent(interval=1)
        },
        'memory': {
            'total_gb': psutil.virtual_memory().total / 1024**3,
            'available_gb': psutil.virtual_memory().available / 1024**3,
            'used_percent': psutil.virtual_memory().percent
        },
        'gpu': check_gpu_availability()
    }
    
    return info


def print_system_info() -> None:
    """Print system information"""
    
    info = get_system_info()
    
    print("\n" + "="*60)
    print("SYSTEM INFORMATION")
    print("="*60)
    
    print(f"\nCPU:")
    print(f"  Cores: {info['cpu']['cores']}")
    print(f"  Threads: {info['cpu']['threads']}")
    print(f"  Usage: {info['cpu']['usage_percent']}%")
    
    print(f"\nRAM:")
    print(f"  Total: {info['memory']['total_gb']:.2f} GB")
    print(f"  Available: {info['memory']['available_gb']:.2f} GB")
    print(f"  Used: {info['memory']['used_percent']}%")
    
    print(f"\nGPU:")
    if info['gpu']['available']:
        print(f"  Available: Yes")
        print(f"  Name: {info['gpu']['name']}")
        print(f"  Memory: {info['gpu']['memory_total']:.2f} GB")
        print(f"  Free: {info['gpu']['memory_free']:.2f} GB")
        print(f"  CUDA: {info['gpu']['cuda_version']}")
    else:
        print(f"  Available: No (CPU only)")
    
    print("="*60 + "\n")


if __name__ == "__main__":
    # Test GPU utilities
    print_system_info()