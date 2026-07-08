"""
Data processing utilities
"""

import json
import csv
from pathlib import Path
from typing import Dict, List, Tuple, Any, Union
import random
import logging
from sklearn.model_selection import train_test_split

logger = logging.getLogger(__name__)


def load_json(filepath: Union[str, Path]) -> Dict[str, Any]:
    """Load JSON file"""
    filepath = Path(filepath)
    
    if not filepath.exists():
        raise FileNotFoundError(f"File not found: {filepath}")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(data: Dict[str, Any], filepath: Union[str, Path], indent: int = 2) -> None:
    """Save data to JSON file"""
    filepath = Path(filepath)
    filepath.parent.mkdir(parents=True, exist_ok=True)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=indent, ensure_ascii=False)
    
    logger.info(f"Saved JSON to {filepath}")


def load_csv(filepath: Union[str, Path], delimiter: str = ',') -> List[Dict[str, str]]:
    """Load CSV file as list of dictionaries"""
    filepath = Path(filepath)
    
    if not filepath.exists():
        raise FileNotFoundError(f"File not found: {filepath}")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter=delimiter)
        return list(reader)


def save_csv(data: List[Dict[str, Any]], filepath: Union[str, Path], 
             delimiter: str = ',') -> None:
    """Save list of dictionaries to CSV"""
    filepath = Path(filepath)
    filepath.parent.mkdir(parents=True, exist_ok=True)
    
    if not data:
        logger.warning("Empty data, nothing to save")
        return
    
    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=data[0].keys(), delimiter=delimiter)
        writer.writeheader()
        writer.writerows(data)
    
    logger.info(f"Saved CSV to {filepath} ({len(data)} rows)")


def split_dataset(
    data: List[Any],
    validation_split: float = 0.2,
    test_split: float = 0.1,
    random_seed: int = 42
) -> Tuple[List[Any], List[Any], List[Any]]:
    """
    Split dataset into train, validation, and test sets
    
    Args:
        data: List of data samples
        validation_split: Fraction for validation set
        test_split: Fraction for test set
        random_seed: Random seed for reproducibility
        
    Returns:
        Tuple of (train_data, val_data, test_data)
    """
    # First split: train+val vs test
    train_val, test = train_test_split(
        data, 
        test_size=test_split, 
        random_state=random_seed
    )
    
    # Second split: train vs val
    val_size = validation_split / (1 - test_split)
    train, val = train_test_split(
        train_val, 
        test_size=val_size, 
        random_state=random_seed
    )
    
    logger.info(f"Dataset split: {len(train)} train, {len(val)} val, {len(test)} test")
    
    return train, val, test


def validate_data_format(data: List[Dict[str, Any]], required_fields: List[str]) -> bool:
    """
    Validate that all samples have required fields
    
    Args:
        data: List of data samples
        required_fields: List of required field names
        
    Returns:
        True if valid, raises ValueError otherwise
    """
    for i, sample in enumerate(data):
        missing_fields = [field for field in required_fields if field not in sample]
        
        if missing_fields:
            raise ValueError(
                f"Sample {i} missing required fields: {missing_fields}"
            )
    
    logger.info(f"Validated {len(data)} samples with fields: {required_fields}")
    return True


def calculate_statistics(data: List[Dict[str, Any]], field: str) -> Dict[str, float]:
    """
    Calculate statistics for a numeric field
    
    Args:
        data: List of data samples
        field: Field name to analyze
        
    Returns:
        Dictionary with statistics
    """
    values = [sample[field] for sample in data if field in sample and sample[field] is not None]
    
    if not values:
        return {}
    
    import numpy as np
    
    stats = {
        'count': len(values),
        'mean': float(np.mean(values)),
        'std': float(np.std(values)),
        'min': float(np.min(values)),
        'max': float(np.max(values)),
        'median': float(np.median(values))
    }
    
    return stats


def shuffle_data(data: List[Any], random_seed: int = 42) -> List[Any]:
    """Shuffle data with random seed for reproducibility"""
    random.seed(random_seed)
    shuffled = data.copy()
    random.shuffle(shuffled)
    return shuffled


def balance_dataset(data: List[Dict[str, Any]], label_field: str) -> List[Dict[str, Any]]:
    """
    Balance dataset by oversampling minority classes
    
    Args:
        data: List of data samples
        label_field: Field containing class labels
        
    Returns:
        Balanced dataset
    """
    from collections import Counter
    
    # Count samples per class
    labels = [sample[label_field] for sample in data]
    class_counts = Counter(labels)
    
    # Find max count
    max_count = max(class_counts.values())
    
    # Oversample minority classes
    balanced_data = []
    for label, count in class_counts.items():
        class_samples = [s for s in data if s[label_field] == label]
        
        # Oversample
        oversampled = class_samples * (max_count // count)
        oversampled += class_samples[:max_count % count]
        
        balanced_data.extend(oversampled)
    
    # Shuffle
    balanced_data = shuffle_data(balanced_data)
    
    logger.info(f"Balanced dataset: {len(data)} → {len(balanced_data)} samples")
    logger.info(f"Class distribution: {dict(Counter([s[label_field] for s in balanced_data]))}")
    
    return balanced_data


def normalize_text(text: str) -> str:
    """Normalize Vietnamese text"""
    import re
    
    # Convert to lowercase
    text = text.lower()
    
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text)
    
    # Remove special characters (keep Vietnamese characters)
    text = re.sub(r'[^\w\sàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]', '', text)
    
    # Strip
    text = text.strip()
    
    return text


def augment_text(text: str, num_augmentations: int = 5) -> List[str]:
    """
    Augment text using synonym replacement (Vietnamese)
    
    Args:
        text: Input text
        num_augmentations: Number of augmented versions to generate
        
    Returns:
        List of augmented texts
    """
    # Simple augmentation: random word swap, deletion
    # For production, use nlpaug or similar
    
    words = text.split()
    augmented = []
    
    for _ in range(num_augmentations):
        # Random swap
        if len(words) > 1:
            aug_words = words.copy()
            idx1, idx2 = random.sample(range(len(words)), 2)
            aug_words[idx1], aug_words[idx2] = aug_words[idx2], aug_words[idx1]
            augmented.append(' '.join(aug_words))
    
    return augmented


def get_data_info(data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Get information about dataset"""
    
    info = {
        'total_samples': len(data),
        'fields': list(data[0].keys()) if data else [],
        'sample': data[0] if data else None
    }
    
    return info


if __name__ == "__main__":
    # Test data utilities
    test_data = [
        {'id': 1, 'text': 'Hello', 'label': 'A'},
        {'id': 2, 'text': 'World', 'label': 'B'},
        {'id': 3, 'text': 'Test', 'label': 'A'},
        {'id': 4, 'text': 'Data', 'label': 'B'},
        {'id': 5, 'text': 'Sample', 'label': 'A'}
    ]
    
    # Test split
    train, val, test = split_dataset(test_data)
    print(f"Train: {len(train)}, Val: {len(val)}, Test: {len(test)}")
    
    # Test validation
    validate_data_format(test_data, ['id', 'text', 'label'])
    
    # Test statistics
    stats = calculate_statistics(test_data, 'id')
    print(f"Statistics: {stats}")
    
    print("Data utilities test passed!")