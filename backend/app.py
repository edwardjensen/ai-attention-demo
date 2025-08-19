"""
AI Attention Mechanism Demonstration Backend

This module provides a Flask web server that demonstrates attention mechanisms
in AI language models using DistilBERT. It extracts attention weights and
serves them via Server-Sent Events for real-time visualization.

Author: AI Assistant
Date: August 2025
"""

import json
import logging
import os
import signal
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Generator, Any

import numpy as np
import torch
from flask import Flask, Response, jsonify, request, send_from_directory
from flask_cors import CORS
from transformers import AutoModel, AutoTokenizer, DistilBertModel, DistilBertTokenizer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
MODEL_NAME = "distilbert-base-uncased"
MAX_TEXT_LENGTH = 1000
PORT = 8080
HOST = "localhost"

# Global model and tokenizer (cached)
model: Optional[DistilBertModel] = None
tokenizer: Optional[DistilBertTokenizer] = None

app = Flask(__name__)
CORS(app, origins=[f"http://{HOST}:{PORT}"])


class AttentionExtractor:
    """Extract and process attention weights from DistilBERT model."""
    
    def __init__(self, model: DistilBertModel, tokenizer: DistilBertTokenizer):
        """Initialize with pre-loaded model and tokenizer.
        
        Args:
            model: Pre-loaded DistilBERT model
            tokenizer: Pre-loaded DistilBERT tokenizer
        """
        self.model = model
        self.tokenizer = tokenizer
        self.model.eval()
    
    def extract_attention_weights(
        self, 
        text: str
    ) -> Dict[str, Any]:
        """Extract attention weights from input text.
        
        Args:
            text: Input text to analyze (max 1000 characters)
            
        Returns:
            Dictionary containing tokens and attention data
            
        Raises:
            ValueError: If text exceeds character limit or is empty
        """
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
        
        if len(text) > MAX_TEXT_LENGTH:
            raise ValueError(f"Text exceeds maximum length of {MAX_TEXT_LENGTH} characters")
        
        # Tokenize input
        inputs = self.tokenizer(
            text, 
            return_tensors="pt", 
            truncation=True, 
            max_length=512,
            padding=True
        )
        
        # Get model outputs with attention weights
        with torch.no_grad():
            outputs = self.model(**inputs, output_attentions=True)
        
        # Extract tokens
        tokens = self.tokenizer.convert_ids_to_tokens(inputs['input_ids'][0])
        
        # Process attention weights
        attention_weights = outputs.attentions  # Tuple of tensors for each layer
        
        # Convert to numpy and process
        processed_attention = self._process_attention_weights(attention_weights, tokens)
        
        return {
            'tokens': tokens,
            'attention_data': processed_attention,
            'num_layers': len(attention_weights),
            'num_heads': attention_weights[0].shape[1]
        }
    
    def _process_attention_weights(
        self, 
        attention_weights: Tuple[torch.Tensor, ...], 
        tokens: List[str]
    ) -> Dict[str, Any]:
        """Process raw attention weights into visualization-ready format.
        
        Args:
            attention_weights: Tuple of attention tensors from each layer
            tokens: List of tokens
            
        Returns:
            Dictionary with processed attention data
        """
        num_layers = len(attention_weights)
        num_tokens = len(tokens)
        
        # Store layer-wise attention
        layer_attention = []
        
        for layer_idx, layer_attn in enumerate(attention_weights):
            # Shape: (batch_size, num_heads, seq_len, seq_len)
            # Average across heads: (seq_len, seq_len)
            avg_attention = layer_attn[0].mean(dim=0).numpy()
            
            layer_attention.append({
                'layer': layer_idx,
                'attention_matrix': avg_attention.tolist(),
                'shape': avg_attention.shape
            })
        
        # Calculate meaningful attention (average of last 4 layers)
        last_layers = min(4, num_layers)
        meaningful_attention = np.zeros((num_tokens, num_tokens))
        
        for i in range(last_layers):
            layer_idx = num_layers - 1 - i
            meaningful_attention += attention_weights[layer_idx][0].mean(dim=0).numpy()
        
        meaningful_attention /= last_layers
        
        # Find strongest attention relationships
        attention_relationships = self._extract_relationships(
            meaningful_attention, 
            tokens
        )
        
        return {
            'layer_attention': layer_attention,
            'meaningful_attention': meaningful_attention.tolist(),
            'relationships': attention_relationships
        }
    
    def _extract_relationships(
        self, 
        attention_matrix: np.ndarray, 
        tokens: List[str],
        threshold: float = 0.1
    ) -> List[Dict[str, Any]]:
        """Extract meaningful attention relationships.
        
        Args:
            attention_matrix: Averaged attention matrix
            tokens: List of tokens
            threshold: Minimum attention score to consider
            
        Returns:
            List of attention relationships
        """
        relationships = []
        
        for i, token_from in enumerate(tokens):
            for j, token_to in enumerate(tokens):
                if i != j and attention_matrix[i, j] > threshold:
                    relationships.append({
                        'from_token': token_from,
                        'to_token': token_to,
                        'from_index': i,
                        'to_index': j,
                        'strength': float(attention_matrix[i, j])
                    })
        
        # Sort by strength descending
        relationships.sort(key=lambda x: x['strength'], reverse=True)
        
        # Return top 20 relationships to avoid overwhelming visualization
        return relationships[:20]


def load_model() -> Tuple[DistilBertModel, DistilBertTokenizer]:
    """Load and cache the DistilBERT model and tokenizer.
    
    Returns:
        Tuple of loaded model and tokenizer
        
    Raises:
        RuntimeError: If model loading fails
    """
    try:
        logger.info(f"Loading model: {MODEL_NAME}")
        tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        model = AutoModel.from_pretrained(MODEL_NAME, output_attentions=True)
        logger.info("Model loaded successfully")
        return model, tokenizer
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        raise RuntimeError(f"Model loading failed: {e}")


def generate_attention_stream(text: str) -> Generator[str, None, None]:
    """Generate Server-Sent Events stream for attention visualization.
    
    Args:
        text: Input text to process
        
    Yields:
        SSE-formatted strings with attention data
    """
    try:
        extractor = AttentionExtractor(model, tokenizer)
        
        # Step 1: Send tokenization
        yield f"data: {json.dumps({'type': 'tokenization', 'status': 'processing'})}\n\n"
        
        # Extract attention weights
        attention_data = extractor.extract_attention_weights(text)
        
        # Step 2: Send tokens
        yield f"data: {json.dumps({'type': 'tokens', 'data': attention_data['tokens']})}\n\n"
        
        # Step 3: Send layer-by-layer attention (progressive)
        for i, layer_data in enumerate(attention_data['attention_data']['layer_attention']):
            yield f"data: {json.dumps({'type': 'layer_attention', 'layer': i, 'data': layer_data})}\n\n"
            # Small delay for visualization effect (simulated processing)
            
        # Step 4: Send meaningful attention relationships
        yield f"data: {json.dumps({'type': 'meaningful_attention', 'data': attention_data['attention_data']['meaningful_attention']})}\n\n"
        
        # Step 5: Send final relationships
        yield f"data: {json.dumps({'type': 'relationships', 'data': attention_data['attention_data']['relationships']})}\n\n"
        
        # Step 6: Send completion signal
        yield f"data: {json.dumps({'type': 'complete'})}\n\n"
        
    except Exception as e:
        logger.error(f"Error processing attention: {e}")
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"


@app.route('/api/v1/health')
def health_check() -> Dict[str, str]:
    """Health check endpoint.
    
    Returns:
        Dictionary with health status
    """
    return jsonify({'status': 'healthy', 'model': MODEL_NAME})


@app.route('/api/v1/attention', methods=['POST'])
def attention_endpoint() -> Response:
    """Main attention analysis endpoint.
    
    Returns:
        Server-Sent Events stream with attention data
    """
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return Response(
                f"data: {json.dumps({'type': 'error', 'message': 'Missing text field'})}\n\n",
                mimetype='text/event-stream'
            )
        
        text = data['text'].strip()
        if not text:
            return Response(
                f"data: {json.dumps({'type': 'error', 'message': 'Empty text provided'})}\n\n",
                mimetype='text/event-stream'
            )
        
        return Response(
            generate_attention_stream(text),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*'
            }
        )
        
    except Exception as e:
        logger.error(f"Error in attention endpoint: {e}")
        return Response(
            f"data: {json.dumps({'type': 'error', 'message': 'Internal server error'})}\n\n",
            mimetype='text/event-stream'
        )


@app.route('/')
def serve_index():
    """Serve the main HTML file."""
    return send_from_directory('../frontend', 'index.html')


@app.route('/<path:filename>')
def serve_static(filename: str):
    """Serve static files from frontend directory."""
    return send_from_directory('../frontend', filename)


def signal_handler(signum, frame):
    """Handle shutdown signals gracefully."""
    logger.info(f"Received signal {signum}, shutting down gracefully...")
    sys.exit(0)


def main():
    """Main application entry point."""
    global model, tokenizer
    
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        # Load model on startup
        model, tokenizer = load_model()
        
        logger.info(f"Starting server on {HOST}:{PORT}")
        app.run(
            host=HOST,
            port=PORT,
            debug=False,
            threaded=True
        )
        
    except Exception as e:
        logger.error(f"Failed to start application: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
