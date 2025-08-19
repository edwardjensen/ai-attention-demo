# AI Attention Mechanism Demo

An interactive web application that demonstrates attention mechanisms in AI language models, showing how AI systems use pattern recognition to understand relationships between words.

## Overview

This demo uses DistilBERT to visualize how attention mechanisms work in transformer models. Users can input text and see how the model focuses on different parts of the text to understand context and meaning.

**Core Thesis**: "AI knows nothing, but it's really good at pattern recognition"

## Part of AI Inference Demo Series

This is the **fourth demo** in a comprehensive series explaining AI inference, supplementary to [ai-confidence-demo](https://github.com/edwardjensen/ai-confidence-demo). While public AI APIs can demonstrate tokenization, embeddings, and confidence intervals, they cannot expose internal attention mechanisms due to their black-box nature. This standalone demo fills that gap by using a local model to visualize the attention patterns that drive AI understanding.

**Complete Series:**
1. **Tokenization** - How text becomes numbers
2. **Embeddings** - Vector representations of meaning  
3. **Confidence** - Model uncertainty and probability
4. **Attention** - This demo - relationship understanding (requires local model access)

## Features

- **Real-time Visualization**: See attention patterns as they're computed
- **Interactive Interface**: Hover over tokens to explore relationships
- **Progressive Display**: Watch how attention evolves through model layers
- **Accessible Design**: Screen reader support and keyboard navigation
- **Educational**: Clear explanations of what's happening under the hood

## Technical Stack

- **Backend**: Python 3.11+ with Flask and transformers
- **Frontend**: Vanilla JavaScript with D3.js and Tailwind CSS
- **Model**: DistilBERT (lightweight, ~250MB)
- **Communication**: Server-Sent Events for real-time updates

## Installation

### Prerequisites

- Python 3.11 or higher
- macOS/Linux environment (optimized for Apple Silicon)

### Setup

1. **Clone and navigate to the project**:
   ```bash
   cd /path/to/ai-attention-demo
   ```

2. **Set up Python virtual environment**:
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate  # On macOS/Linux
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the application**:
   ```bash
   python3 app.py
   ```

5. **Open your browser**:
   Navigate to `http://localhost:8080`

## Usage

1. **Enter text** in the input field (up to 1000 characters)
2. **Wait for processing** (automatically starts after 1 second pause)
3. **Watch the visualization**:
   - Tokens appear first
   - Attention patterns develop through layers
   - Final relationships are highlighted
4. **Interact with the visualization**:
   - Hover over tokens to see connections
   - Click on attention relationships
   - Use keyboard navigation for accessibility

## How It Works

### Tokenization
Your input text is broken into tokens (words or word parts) that the model can understand.

### Attention Computation
Each layer of the model computes attention weights - numbers that represent how much each token "pays attention" to every other token.

### Visualization
The demo shows:
- **Token relationships**: Lines connecting related words
- **Attention strength**: Line thickness and color intensity
- **Layer progression**: How understanding builds up through layers
- **Final patterns**: The most meaningful relationships

### Pattern Recognition
The model identifies patterns like:
- Subject-verb relationships
- Modifier-noun connections
- Contextual dependencies
- Semantic similarities

## API Documentation

### Endpoints

#### `GET /api/v1/health`
Health check endpoint.

**Response**:
```json
{
  "status": "healthy",
  "model": "distilbert-base-uncased"
}
```

#### `POST /api/v1/attention`
Main attention analysis endpoint.

**Request**:
```json
{
  "text": "Your input text here"
}
```

**Response**: Server-Sent Events stream with:
- Tokenization progress
- Layer-by-layer attention weights
- Final attention relationships
- Error messages (if any)

## Development

### Project Structure
```
ai-attention-demo/
├── backend/
│   ├── venv/              # Python virtual environment
│   ├── app.py             # Main Flask application
│   ├── requirements.txt   # Python dependencies
│   └── __init__.py        # Package marker
├── frontend/
│   ├── index.html         # Main HTML file
│   ├── styles.css         # Custom CSS styles
│   └── attention.js       # JavaScript visualization
├── tests/                 # Test files (temporary)
├── attention-demo-context.md  # Project documentation
└── README.md              # This file
```

### Testing

Run tests with pytest:
```bash
cd backend
source venv/bin/activate
pytest tests/
```

### Code Quality

The project follows:
- PEP 8 style guidelines
- Type hints for all functions
- Comprehensive docstrings
- Proper error handling
- Accessibility best practices

## Performance

- **Model loading**: ~2-3 seconds on first startup
- **Processing time**: <4 seconds for typical inputs
- **Memory usage**: ~500MB with model loaded
- **Optimized for**: Apple Silicon Macs

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Requires JavaScript enabled for visualization features.

## Accessibility

- Screen reader compatible
- Keyboard navigation support
- High contrast mode support
- ARIA labels for interactive elements
- Reduced motion support

## Troubleshooting

### Common Issues

**Model loading fails**:
- Ensure you have sufficient memory (>2GB available)
- Check internet connection for initial model download
- Verify Python version compatibility

**Visualization not appearing**:
- Check browser console for JavaScript errors
- Ensure JavaScript is enabled
- Try a different browser

**Performance issues**:
- Close other applications to free memory
- Use shorter input texts
- Restart the application

### Logs

Check the terminal running the Flask app for detailed error logs.

## Educational Context

This demo is part of a comprehensive suite explaining AI inference mechanisms, building upon [ai-confidence-demo](https://github.com/edwardjensen/ai-confidence-demo):

1. **Tokenization**: How text becomes numbers
2. **Embeddings**: Vector representations of meaning
3. **Confidence**: Model uncertainty and probability
4. **Attention**: This demo - relationship understanding

The first three demos can be implemented using public AI APIs, but attention visualization requires direct access to model internals, which is why this runs locally with DistilBERT. Together, these demos provide a complete picture of how AI language models process and understand text.

## Contributing

This is an educational demo. For improvements:
1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Ensure accessibility compliance

## License

Educational demo - see individual library licenses for dependencies.

## Acknowledgments

- Hugging Face for the transformers library
- D3.js for visualization capabilities
- DistilBERT authors for the efficient model
- Tailwind CSS for styling framework
