"""
RAG Model Training Pipeline - PhoBERT Embeddings + Qdrant Vector Database
"""

import os
import sys
import logging
from pathlib import Path
import yaml
import json
import time
from typing import Dict, List, Tuple, Any
import numpy as np
from tqdm import tqdm
from rank_bm25 import BM25Okapi

# ML/NLP
from sentence_transformers import SentenceTransformer
from sentence_transformers import CrossEncoder
from qdrant_client import QdrantClient
from qdrant_client.http import models
from sklearn.model_selection import train_test_split
from sklearn.metrics import precision_score, recall_score, f1_score

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent.parent))

from utils.logger import setup_logger, TrainingLogger
from utils.gpu_utils import check_gpu_availability, optimize_gpu_memory
from utils.data_utils import load_json, save_json

logger = logging.getLogger(__name__)


class RAGTrainer:
    """RAG model trainer for Vietnamese accounting Q&A"""
    
    def __init__(self, config_path: str = "config/config.yaml"):
        """Initialize trainer with configuration"""
        self.config = self._load_config(config_path)
        self.logger = setup_logger("rag_training", level="INFO")
        self.training_logger = TrainingLogger()
        
        # Setup device
        self.device = self._setup_device()
        
        # Paths
        self.data_dir = Path(self.config['paths']['data_processed'])
        self.model_save_dir = Path(self.config['paths']['models_trained'])
        self.model_save_dir.mkdir(parents=True, exist_ok=True)
        
        # Model configuration
        self.rag_config = self.config['models']['rag']
        
        # Metrics
        self.best_precision_at_5 = 0.0
        self.best_mrr = 0.0
        
        # BM25 index for hybrid search
        self.bm25 = None
        self.documents = []
        
        # Cross-encoder re-ranker
        self.reranker = None
        
        self.logger.info("RAG Trainer initialized")
    
    def _load_config(self, config_path: str) -> Dict:
        """Load configuration"""
        with open(config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    
    def _setup_device(self) -> str:
        """Setup training device"""
        gpu_info = check_gpu_availability()
        
        if gpu_info['available']:
            self.logger.info(f"Using GPU: {gpu_info['name']}")
            optimize_gpu_memory()
            return "cuda"
        else:
            self.logger.warning("GPU not available, using CPU")
            return "cpu"
    
    def load_data(self, data_type: str = "train") -> List[Dict]:
        """
        Load RAG dataset
        
        Args:
            data_type: 'train', 'val', or 'test'
            
        Returns:
            List of Q&A pairs
        """
        # Try synthetic data first
        synthetic_path = Path(f"data/synthetic/rag/rag_qa_pairs.json") if data_type == "train" else None
        processed_path = self.data_dir / "rag" / data_type / "rag_qa_pairs.json"
        
        # Try multiple paths
        if synthetic_path and synthetic_path.exists():
            self.logger.info(f"Loading synthetic data from: {synthetic_path}")
            data = load_json(synthetic_path)
        elif processed_path.exists():
            self.logger.info(f"Loading processed data from: {processed_path}")
            data = load_json(processed_path)
        else:
            self.logger.error(f"No data found for {data_type}")
            return []
        
        self.logger.info(f"Loaded {len(data)} Q&A pairs for {data_type}")
        return data
    
    def initialize_embedding_model(self):
        """Initialize sentence transformer model"""
        self.logger.info(f"Loading embedding model: {self.rag_config['embedding_model']}")
        
        model = SentenceTransformer(
            self.rag_config['embedding_model'],
            device=self.device
        )
        
        self.logger.info(f"Embedding model loaded: {model.__class__.__name__}")
        self.logger.info(f"Embedding dimension: {model.get_sentence_embedding_dimension()}")
        
        return model
    
    def initialize_vector_db(self) -> QdrantClient:
        """Initialize Qdrant vector database"""
        self.logger.info("Initializing Qdrant vector database...")
        
        # Use in-memory for training, persistent for production
        client = QdrantClient(":memory:")  # In-memory for training
        
        # Create collection
        collection_name = "accounting_knowledge"
        
        # Check if collection exists, delete if so
        try:
            client.delete_collection(collection_name)
        except:
            pass
        
        # Create new collection
        client.create_collection(
            collection_name=collection_name,
            vectors_config=models.VectorParams(
                size=self.rag_config['embedding_dim'],
                distance=models.Distance.COSINE
            )
        )
        
        self.logger.info(f"Vector database initialized: {collection_name}")
        return client, collection_name
    
    def chunk_document(self, text: str, chunk_size: int = 512, 
                       chunk_overlap: int = 50) -> List[str]:
        """
        Split document into chunks for embedding
        
        Args:
            text: Document text
            chunk_size: Maximum chunk size (tokens)
            chunk_overlap: Overlap between chunks
            
        Returns:
            List of text chunks
        """
        # Improved chunking for Vietnamese text
        # Split by sentences first (using common Vietnamese sentence endings)
        import re
        
        # Split by sentence endings: . ! ? ; and newlines
        sentences = re.split(r'(?<=[.!?;])\s+|\n+', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        chunks = []
        current_chunk = []
        current_length = 0
        
        for sentence in sentences:
            sentence_length = len(sentence.split())
            
            # If single sentence exceeds chunk_size, split it
            if sentence_length > chunk_size:
                if current_chunk:
                    chunks.append(' '.join(current_chunk))
                    current_chunk = []
                    current_length = 0
                
                # Split long sentence into multiple chunks
                words = sentence.split()
                for i in range(0, len(words), chunk_size - chunk_overlap):
                    chunk_words = words[i:i + chunk_size]
                    chunks.append(' '.join(chunk_words))
                continue
            
            # If adding this sentence exceeds chunk_size, save current chunk
            if current_length + sentence_length > chunk_size and current_chunk:
                chunks.append(' '.join(current_chunk))
                # Keep overlap sentences
                overlap_sentences = []
                overlap_length = 0
                for s in reversed(current_chunk):
                    s_len = len(s.split())
                    if overlap_length + s_len <= chunk_overlap:
                        overlap_sentences.insert(0, s)
                        overlap_length += s_len
                    else:
                        break
                current_chunk = overlap_sentences
                current_length = overlap_length
            
            current_chunk.append(sentence)
            current_length += sentence_length
        
        # Add remaining chunk
        if current_chunk:
            chunks.append(' '.join(current_chunk))
        
        return chunks
    
    def build_vector_index(self, model, client: QdrantClient, 
                          collection_name: str, data: List[Dict]) -> None:
        """
        Build vector index from Q&A pairs with hybrid search support
        
        Args:
            model: Embedding model
            client: Qdrant client
            collection_name: Collection name
            data: List of Q&A pairs
        """
        self.logger.info(f"Building vector index with {len(data)} Q&A pairs...")
        
        # Prepare documents for embedding
        self.documents = []
        for qa in data:
            # Combine question and answer for better retrieval
            doc_text = f"Câu hỏi: {qa['question']}\nTrả lời: {qa['answer']}"
            self.documents.append({
                'text': doc_text,
                'question': qa['question'],
                'answer': qa['answer'],
                'category': qa.get('category', 'general'),
                'id': qa['id']
            })
        
        # Build BM25 index for hybrid search
        if self.rag_config.get('use_hybrid_search', False):
            self.logger.info("Building BM25 index for hybrid search...")
            tokenized_docs = [doc['text'].lower().split() for doc in self.documents]
            self.bm25 = BM25Okapi(tokenized_docs)
            self.logger.info(f"BM25 index built with {len(tokenized_docs)} documents")
        
        # Initialize re-ranker
        if self.rag_config.get('use_reranker', False):
            self.logger.info(f"Loading re-ranker model: {self.rag_config['reranker_model']}")
            self.reranker = CrossEncoder(self.rag_config['reranker_model'], device=self.device)
            self.logger.info("Re-ranker model loaded")
        
        # Generate embeddings
        self.logger.info("Generating embeddings...")
        texts = [doc['text'] for doc in self.documents]
        embeddings = model.encode(texts, show_progress_bar=True, batch_size=32)
        
        # Upload to Qdrant
        self.logger.info("Uploading to vector database...")
        
        points = []
        for i, (doc, embedding) in enumerate(zip(self.documents, embeddings)):
            points.append(
                models.PointStruct(
                    id=i,
                    vector=embedding.tolist(),
                    payload={
                        'text': doc['text'],
                        'question': doc['question'],
                        'answer': doc['answer'],
                        'category': doc['category'],
                        'doc_id': doc['id']
                    }
                )
            )
        
        # Upload in batches
        batch_size = 100
        for i in tqdm(range(0, len(points), batch_size), desc="Uploading"):
            batch = points[i:i + batch_size]
            client.upsert(
                collection_name=collection_name,
                points=batch
            )
        
        self.logger.info(f"Vector index built: {len(points)} vectors uploaded")
    
    def retrieve(self, model, client: QdrantClient, collection_name: str,
                 query: str, top_k: int = 5, category_filter: str = None) -> List[Dict]:
        """
        Retrieve relevant documents for a query with hybrid search and re-ranking support
        
        Args:
            model: Embedding model
            client: Qdrant client
            collection_name: Collection name
            query: User query
            top_k: Number of results to retrieve
            category_filter: Optional category to filter results
            
        Returns:
            List of retrieved documents with scores
        """
        # Generate query embedding
        query_embedding = model.encode(query)
        
        # Stage 1: Hybrid search (BM25 + Vector) to get candidates
        reranker_top_k = self.rag_config.get('reranker_top_k', 20)
        
        if self.rag_config.get('use_hybrid_search', False) and self.bm25 is not None:
            # BM25 scores
            tokenized_query = query.lower().split()
            bm25_scores = self.bm25.get_scores(tokenized_query)
            
            # Get top BM25 candidates
            bm25_top_indices = np.argsort(bm25_scores)[-reranker_top_k:][::-1]
            
            # Vector search on BM25 candidates
            bm25_weight = self.rag_config.get('bm25_weight', 0.3)
            vector_weight = self.rag_config.get('vector_weight', 0.7)
            
            # Search vector database with larger limit
            response = client.query_points(
                collection_name=collection_name,
                query=query_embedding.tolist(),
                limit=reranker_top_k
            )
            
            # Combine scores
            vector_scores = {}
            for result in response.points:
                vector_scores[result.id] = result.score
            
            # Rerank using hybrid scoring
            hybrid_scores = []
            for idx in bm25_top_indices:
                if idx in vector_scores:
                    bm25_score = bm25_scores[idx]
                    vector_score = vector_scores[idx]
                    # Normalize BM25 score (typically 0-10 range)
                    normalized_bm25 = min(bm25_score / 10.0, 1.0)
                    hybrid_score = (bm25_weight * normalized_bm25) + (vector_weight * vector_score)
                    hybrid_scores.append((idx, hybrid_score))
            
            # Sort by hybrid score
            hybrid_scores.sort(key=lambda x: x[1], reverse=True)
            candidate_indices = [idx for idx, _ in hybrid_scores]
        else:
            # Pure vector search
            response = client.query_points(
                collection_name=collection_name,
                query=query_embedding.tolist(),
                limit=reranker_top_k
            )
            candidate_indices = [result.id for result in response.points]
        
        # Stage 2: Re-ranking with Cross-Encoder
        if self.rag_config.get('use_reranker', False) and self.reranker is not None and len(candidate_indices) > 0:
            self.logger.info("Applying Cross-Encoder re-ranking...")
            
            # Prepare query-document pairs for re-ranking
            reranker_pairs = []
            for idx in candidate_indices:
                if idx < len(self.documents):
                    doc = self.documents[idx]
                    reranker_pairs.append([query, doc['text']])
            
            # Get re-ranking scores
            reranker_scores = self.reranker.predict(reranker_pairs)
            
            # Sort by re-ranker score
            reranked_indices = [(candidate_indices[i], reranker_scores[i]) 
                               for i in range(len(candidate_indices))]
            reranked_indices.sort(key=lambda x: x[1], reverse=True)
            top_indices = [idx for idx, _ in reranked_indices[:top_k]]
        else:
            top_indices = candidate_indices[:top_k]
        
        # Format results
        retrieved = []
        for idx in top_indices:
            if idx < len(self.documents):
                doc = self.documents[idx]
                retrieved.append({
                    'id': doc['id'],
                    'score': 1.0,
                    'question': doc['question'],
                    'answer': doc['answer'],
                    'category': doc['category']
                })
        
        return retrieved
    
    def evaluate_retrieval(self, model, client: QdrantClient, 
                          collection_name: str, test_data: List[Dict]) -> Dict[str, float]:
        """
        Evaluate retrieval quality
        
        Args:
            model: Embedding model
            client: Qdrant client
            collection_name: Collection name
            test_data: Test Q&A pairs
            
        Returns:
            Dictionary with metrics
        """
        self.logger.info(f"Evaluating retrieval on {len(test_data)} samples...")
        
        top_k = self.rag_config['top_k']
        
        # Metrics
        precision_at_k = {k: [] for k in [1, 3, 5]}
        reciprocal_ranks = []
        ndcg_scores = []
        
        for qa in tqdm(test_data, desc="Evaluating"):
            query = qa['question']
            correct_answer = qa['answer']
            
            # Retrieve
            results = self.retrieve(model, client, collection_name, query, top_k=top_k)
            
            # Check if correct answer is in retrieved results
            correct_id = qa['id']
            found = False
            rank = 0
            
            for i, result in enumerate(results):
                if result['id'] == correct_id:
                    found = True
                    rank = i + 1
                    break
            
            # Precision@K
            for k in [1, 3, 5]:
                if found and rank <= k:
                    precision_at_k[k].append(1.0)
                else:
                    precision_at_k[k].append(0.0)
            
            # MRR (Mean Reciprocal Rank)
            if found:
                reciprocal_ranks.append(1.0 / rank)
            else:
                reciprocal_ranks.append(0.0)
            
            # NDCG (Normalized Discounted Cumulative Gain)
            dcg = 0.0
            for i, result in enumerate(results):
                if result['id'] == correct_id:
                    dcg = 1.0 / np.log2(i + 2)  # i+2 because log2(1) = 0
                    break
            
            idcg = 1.0  # Ideal DCG (found at rank 1)
            ndcg = dcg / idcg if idcg > 0 else 0.0
            ndcg_scores.append(ndcg)
        
        # Calculate metrics
        metrics = {
            'precision_at_1': np.mean(precision_at_k[1]),
            'precision_at_3': np.mean(precision_at_k[3]),
            'precision_at_5': np.mean(precision_at_k[5]),
            'mrr': np.mean(reciprocal_ranks),
            'ndcg': np.mean(ndcg_scores),
            'num_samples': len(test_data)
        }
        
        self.logger.info("Retrieval Evaluation Results:")
        for key, value in metrics.items():
            if isinstance(value, float):
                self.logger.info(f"  {key}: {value:.4f}")
        
        return metrics
    
    def train(self) -> None:
        """Main training loop"""
        self.logger.info("="*60)
        self.logger.info("Starting RAG Model Training")
        self.logger.info("="*60)
        
        start_time = time.time()
        
        # Load data
        train_data = self.load_data("train")
        val_data = self.load_data("val")
        
        if len(train_data) == 0:
            self.logger.error("No training data found! Run generate_synthetic_data.py first.")
            return
        
        # Split train into train/val if no val data
        if len(val_data) == 0:
            self.logger.info("Splitting training data into train/val...")
            train_data, val_data = train_test_split(
                train_data, 
                test_size=0.2, 
                random_state=42
            )
        
        # Initialize embedding model
        embedding_model = self.initialize_embedding_model()
        
        # Initialize vector database
        client, collection_name = self.initialize_vector_db()
        
        # Build vector index with training data
        self.build_vector_index(embedding_model, client, collection_name, train_data)
        
        # Evaluate on validation set
        if len(val_data) > 0:
            val_metrics = self.evaluate_retrieval(
                embedding_model, client, collection_name, val_data
            )
            
            # Save best model
            if val_metrics['precision_at_5'] > self.best_precision_at_5:
                self.best_precision_at_5 = val_metrics['precision_at_5']
                self.best_mrr = val_metrics['mrr']
                
                # Save embedding model
                model_save_path = self.model_save_dir / "rag_embedding_model"
                embedding_model.save(str(model_save_path))
                
                self.logger.info(f"✓ Best model saved (P@5: {self.best_precision_at_5:.4f})")
        
        # Final results
        self.logger.info("\n" + "="*60)
        self.logger.info("Training Complete!")
        self.logger.info("="*60)
        
        total_time = time.time() - start_time
        self.logger.info(f"Total time: {total_time:.2f} seconds")
        self.logger.info(f"Best Precision@5: {self.best_precision_at_5:.4f}")
        self.logger.info(f"Best MRR: {self.best_mrr:.4f}")
        
        # Save results
        results = {
            'model': self.rag_config['embedding_model'],
            'best_precision_at_5': self.best_precision_at_5,
            'best_mrr': self.best_mrr,
            'training_time': total_time,
            'num_qa_pairs': len(train_data) + len(val_data),
            'config': self.rag_config
        }
        
        results_file = self.model_save_dir / "rag_evaluation.json"
        save_json(results, results_file)
        
        self.logger.info(f"Results saved to: {results_file}")


def main():
    """Main function"""
    trainer = RAGTrainer()
    trainer.train()


if __name__ == "__main__":
    main()