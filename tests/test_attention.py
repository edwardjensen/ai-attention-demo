"""
Test suite for AI Attention Demo backend

This module contains unit tests for the attention extraction logic
and API endpoints.

Author: AI Assistant
Date: August 2025
"""

import json
import pytest
from unittest.mock import Mock, patch
import numpy as np
import torch

# Import the application modules
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app import AttentionExtractor, app, load_model


class TestAttentionExtractor:
    """Test cases for AttentionExtractor class."""
    
    def setup_method(self):
        """Set up test fixtures."""
        # Create mock model and tokenizer
        self.mock_model = Mock()
        self.mock_tokenizer = Mock()
        
        # Configure mock tokenizer
        self.mock_tokenizer.convert_ids_to_tokens.return_value = ['[CLS]', 'hello', 'world', '[SEP]']
        self.mock_tokenizer.return_value = {
            'input_ids': torch.tensor([[101, 7592, 2088, 102]]),
            'attention_mask': torch.tensor([[1, 1, 1, 1]])
        }
        
        # Configure mock model outputs
        mock_attention = torch.rand(1, 8, 4, 4)  # (batch, heads, seq_len, seq_len)
        mock_outputs = Mock()
        mock_outputs.attentions = (mock_attention, mock_attention, mock_attention)
        self.mock_model.return_value = mock_outputs
        
        self.extractor = AttentionExtractor(self.mock_model, self.mock_tokenizer)
    
    def test_extract_attention_weights_valid_input(self):
        """Test attention extraction with valid input."""
        text = "hello world"
        result = self.extractor.extract_attention_weights(text)
        
        assert 'tokens' in result
        assert 'attention_data' in result
        assert 'num_layers' in result
        assert 'num_heads' in result
        
        assert result['tokens'] == ['[CLS]', 'hello', 'world', '[SEP]']
        assert result['num_layers'] == 3
        assert result['num_heads'] == 8
    
    def test_extract_attention_weights_empty_input(self):
        """Test attention extraction with empty input."""
        with pytest.raises(ValueError, match="Text cannot be empty"):
            self.extractor.extract_attention_weights("")
    
    def test_extract_attention_weights_too_long(self):
        """Test attention extraction with input that's too long."""
        long_text = "word " * 300  # Exceeds 1000 character limit
        with pytest.raises(ValueError, match="Text exceeds maximum length"):
            self.extractor.extract_attention_weights(long_text)
    
    def test_process_attention_weights(self):
        """Test attention weight processing."""
        # Create mock attention weights
        attention_weights = (
            torch.rand(1, 8, 4, 4),
            torch.rand(1, 8, 4, 4),
            torch.rand(1, 8, 4, 4)
        )
        tokens = ['[CLS]', 'hello', 'world', '[SEP]']
        
        result = self.extractor._process_attention_weights(attention_weights, tokens)
        
        assert 'layer_attention' in result
        assert 'meaningful_attention' in result
        assert 'relationships' in result
        
        assert len(result['layer_attention']) == 3
        assert len(result['meaningful_attention']) == 4
        assert len(result['meaningful_attention'][0]) == 4
    
    def test_extract_relationships(self):
        """Test relationship extraction."""
        attention_matrix = np.array([
            [0.1, 0.8, 0.05, 0.05],
            [0.2, 0.1, 0.6, 0.1],
            [0.15, 0.7, 0.1, 0.05],
            [0.05, 0.05, 0.05, 0.85]
        ])
        tokens = ['[CLS]', 'hello', 'world', '[SEP]']
        
        relationships = self.extractor._extract_relationships(attention_matrix, tokens)
        
        assert isinstance(relationships, list)
        assert len(relationships) <= 20  # Should limit to top 20
        
        # Check that relationships are sorted by strength
        for i in range(len(relationships) - 1):
            assert relationships[i]['strength'] >= relationships[i + 1]['strength']
        
        # Check relationship structure
        if relationships:
            rel = relationships[0]
            assert 'from_token' in rel
            assert 'to_token' in rel
            assert 'from_index' in rel
            assert 'to_index' in rel
            assert 'strength' in rel


class TestAPI:
    """Test cases for Flask API endpoints."""
    
    def setup_method(self):
        """Set up test client."""
        app.config['TESTING'] = True
        self.client = app.test_client()
    
    def test_health_endpoint(self):
        """Test health check endpoint."""
        response = self.client.get('/api/v1/health')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert 'status' in data
        assert 'model' in data
        assert data['status'] == 'healthy'
    
    @patch('app.model')
    @patch('app.tokenizer')
    def test_attention_endpoint_valid_input(self, mock_tokenizer, mock_model):
        """Test attention endpoint with valid input."""
        # Configure mocks
        mock_tokenizer.convert_ids_to_tokens.return_value = ['hello', 'world']
        mock_tokenizer.return_value = {
            'input_ids': torch.tensor([[101, 7592, 2088, 102]]),
            'attention_mask': torch.tensor([[1, 1, 1, 1]])
        }
        
        mock_attention = torch.rand(1, 8, 4, 4)
        mock_outputs = Mock()
        mock_outputs.attentions = (mock_attention,)
        mock_model.return_value = mock_outputs
        mock_model.eval.return_value = None
        
        response = self.client.post('/api/v1/attention', 
                                  json={'text': 'hello world'},
                                  headers={'Content-Type': 'application/json'})
        
        assert response.status_code == 200
        assert response.content_type == 'text/event-stream; charset=utf-8'
    
    def test_attention_endpoint_missing_text(self):
        """Test attention endpoint with missing text field."""
        response = self.client.post('/api/v1/attention', 
                                  json={},
                                  headers={'Content-Type': 'application/json'})
        
        assert response.status_code == 200
        data = response.data.decode('utf-8')
        assert 'Missing text field' in data
    
    def test_attention_endpoint_empty_text(self):
        """Test attention endpoint with empty text."""
        response = self.client.post('/api/v1/attention', 
                                  json={'text': '   '},
                                  headers={'Content-Type': 'application/json'})
        
        assert response.status_code == 200
        data = response.data.decode('utf-8')
        assert 'Empty text provided' in data


class TestModelLoading:
    """Test cases for model loading functionality."""
    
    @patch('app.AutoTokenizer.from_pretrained')
    @patch('app.AutoModel.from_pretrained')
    def test_load_model_success(self, mock_model, mock_tokenizer):
        """Test successful model loading."""
        mock_tokenizer.return_value = Mock()
        mock_model.return_value = Mock()
        
        model, tokenizer = load_model()
        
        assert model is not None
        assert tokenizer is not None
        mock_tokenizer.assert_called_once()
        mock_model.assert_called_once()
    
    @patch('app.AutoTokenizer.from_pretrained')
    @patch('app.AutoModel.from_pretrained')
    def test_load_model_failure(self, mock_model, mock_tokenizer):
        """Test model loading failure."""
        mock_tokenizer.side_effect = Exception("Network error")
        
        with pytest.raises(RuntimeError, match="Model loading failed"):
            load_model()


# Fixtures for test data
@pytest.fixture
def sample_text():
    """Sample text for testing."""
    return "The cat sat on the mat because it was comfortable."


@pytest.fixture
def sample_tokens():
    """Sample tokens for testing."""
    return ['[CLS]', 'the', 'cat', 'sat', 'on', 'the', 'mat', 'because', 'it', 'was', 'comfortable', '.', '[SEP]']


@pytest.fixture
def sample_attention_matrix():
    """Sample attention matrix for testing."""
    size = 13  # Length of sample_tokens
    return np.random.rand(size, size)


if __name__ == '__main__':
    pytest.main([__file__])
