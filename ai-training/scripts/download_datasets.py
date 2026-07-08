"""
Download public datasets for training
"""

import os
import requests
import zipfile
import tarfile
from pathlib import Path
from tqdm import tqdm
import logging

logger = logging.getLogger(__name__)


def download_file(url: str, output_path: Path, desc: str = "Downloading") -> None:
    """
    Download file with progress bar
    
    Args:
        url: URL to download
        output_path: Path to save file
        desc: Description for progress bar
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    response = requests.get(url, stream=True, timeout=30)
    response.raise_for_status()
    
    total_size = int(response.headers.get('content-length', 0))
    
    with open(output_path, 'wb') as f, tqdm(
        desc=desc,
        total=total_size,
        unit='iB',
        unit_scale=True,
        unit_divisor=1024,
    ) as pbar:
        for data in response.iter_content(chunk_size=1024):
            size = f.write(data)
            pbar.update(size)
    
    logger.info(f"Downloaded: {output_path}")


def extract_archive(archive_path: Path, extract_to: Path) -> None:
    """
    Extract zip or tar.gz archive
    
    Args:
        archive_path: Path to archive file
        extract_to: Directory to extract to
    """
    extract_to.mkdir(parents=True, exist_ok=True)
    
    if archive_path.suffix == '.zip':
        with zipfile.ZipFile(archive_path, 'r') as zip_ref:
            zip_ref.extractall(extract_to)
    elif archive_path.suffix in ['.gz', '.tar']:
        with tarfile.open(archive_path, 'r:gz') as tar_ref:
            tar_ref.extractall(extract_to)
    
    logger.info(f"Extracted: {archive_path} → {extract_to}")


def download_sroie_dataset(output_dir: Path = Path("data/raw/sroie")) -> None:
    """
    Download SROIE 2019 dataset (Scanned Receipt OCR)
    
    Args:
        output_dir: Directory to save dataset
    """
    logger.info("Downloading SROIE 2019 dataset...")
    
    # SROIE 2019 dataset URLs
    base_url = "https://github.com/ticod/sroie2019/raw/master"
    
    # Create directories
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Note: SROIE requires manual download from competition website
    # This is a placeholder - user needs to download from:
    # https://rrc.cvc.uab.es/?ch=13
    
    logger.warning(
        "SROIE 2019 requires manual download from:\n"
        "https://rrc.cvc.uab.es/?ch=13\n"
        "Please download and place in: data/raw/sroie/"
    )
    
    # Create README for manual download
    readme = output_dir / "README.md"
    readme.write_text(
        "# SROIE 2019 Dataset\n\n"
        "Please download from: https://rrc.cvc.uab.es/?ch=13\n"
        "Extract the files to this directory.\n"
    )


def download_cord_dataset(output_dir: Path = Path("data/raw/cord")) -> None:
    """
    Download CORD dataset (Consolidated Receipt Dataset)
    
    Args:
        output_dir: Directory to save dataset
    """
    logger.info("CORD dataset info...")
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # CORD is available on HuggingFace
    logger.info(
        "CORD dataset available on HuggingFace:\n"
        "https://huggingface.co/datasets/naver-clova-ix/cord-v1\n\n"
        "Use huggingface-cli to download:\n"
        "huggingface-cli download naver-clova-ix/cord-v1 --local-dir data/raw/cord/"
    )
    
    readme = output_dir / "README.md"
    readme.write_text(
        "# CORD Dataset\n\n"
        "Download from HuggingFace:\n"
        "huggingface-cli download naver-clova-ix/cord-v1 --local-dir ./\n"
    )


def download_spider_dataset(output_dir: Path = Path("data/raw/spider")) -> None:
    """
    Download Spider dataset (Text-to-SQL)
    
    Args:
        output_dir: Directory to save dataset
    """
    logger.info("Downloading Spider dataset...")
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Spider dataset URL
    spider_url = "https://drive.google.com/uc?export=download&id=1TqD0dLIIF12P0M4k8Qv3J7jGQa3Mx0nG"
    
    try:
        # Try to download (may fail due to Google Drive restrictions)
        download_file(spider_url, output_dir / "spider.zip", "Spider dataset")
        extract_archive(output_dir / "spider.zip", output_dir)
    except Exception as e:
        logger.warning(
            f"Failed to download Spider dataset: {e}\n"
            "Please download manually from:\n"
            "https://yuchenlin.xyz/spider/\n"
            "or https://huggingface.co/datasets/spider"
        )


def setup_directories() -> None:
    """Create necessary directories"""
    dirs = [
        "data/raw/ocr",
        "data/raw/nlp",
        "data/raw/self_fix",
        "data/raw/rag",
        "data/processed",
        "data/synthetic",
        "data/ground_truth",
    ]
    
    for dir_path in dirs:
        Path(dir_path).mkdir(parents=True, exist_ok=True)
        logger.info(f"Created directory: {dir_path}")


def main():
    """Main function to download all datasets"""
    logging.basicConfig(level=logging.INFO)
    logger.info("Starting dataset download...")
    
    # Setup directories
    setup_directories()
    
    # Download datasets
    download_sroie_dataset()
    download_cord_dataset()
    download_spider_dataset()
    
    logger.info("\n" + "="*60)
    logger.info("Dataset download setup complete!")
    logger.info("="*60)
    logger.info("\nNext steps:")
    logger.info("1. Manually download SROIE from: https://rrc.cvc.uab.es/?ch=13")
    logger.info("2. Download CORD from HuggingFace")
    logger.info("3. Download Spider from: https://yuchenlin.xyz/spider/")
    logger.info("4. Run: python scripts/generate_synthetic_data.py")
    logger.info("="*60)


if __name__ == "__main__":
    main()