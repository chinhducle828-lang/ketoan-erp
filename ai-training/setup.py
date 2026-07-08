"""
Setup script for AI Training Project
"""

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="ketoan-ai-training",
    version="1.0.0",
    author="Ketoan ERP Team",
    description="AI Training Project for Ketoan ERP - Vietnamese Accounting System",
    long_description=long_description,
    long_description_content_type="text/markdown",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
    python_requires=">=3.8",
    install_requires=[
        "torch>=2.0.0",
        "paddlepaddle>=2.5.0",
        "paddleocr>=2.7.0",
        "transformers>=4.30.0",
        "sentence-transformers>=2.2.0",
        "xgboost>=2.0.0",
        "prophet>=1.1.5",
        "qdrant-client>=1.5.0",
        "scikit-learn>=1.3.0",
        "pandas>=2.0.0",
        "numpy>=1.24.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.4.0",
            "pytest-cov>=4.1.0",
            "black>=23.0.0",
            "flake8>=6.1.0",
            "mypy>=1.5.0",
        ],
        "gpu": [
            "torch>=2.0.0+cu118",  # CUDA 11.8
        ],
    },
    entry_points={
        "console_scripts": [
            "ketoan-ai-train=scripts.train_all:main",
            "ketoan-ai-evaluate=evaluation.run_all_tests:main",
            "ketoan-ai-export=scripts.export_models:main",
            "ketoan-ai-generate-data=scripts.generate_synthetic_data:main",
        ],
    },
)