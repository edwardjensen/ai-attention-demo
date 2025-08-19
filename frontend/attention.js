/**
 * AI Attention Mechanism Demo - Frontend JavaScript
 * 
 * This module handles the interactive visualization of attention mechanisms
 * in AI language models using D3.js for rendering and Server-Sent Events
 * for real-time data streaming.
 * 
 * Author: AI Assistant
 * Date: August 2025
 */

class AttentionVisualizer {
    constructor() {
        this.currentTokens = [];
        this.currentAttentionData = null;
        this.currentRelationships = [];
        this.eventSource = null;
        this.debounceTimer = null;
        this.isProcessing = false;
        this.svg = null;
        this.width = 0;
        this.height = 0;
        
        this.initializeElements();
        this.setupEventListeners();
        this.initializeVisualization();
    }
    
    /**
     * Initialize DOM elements and cache references
     */
    initializeElements() {
        this.elements = {
            textInput: document.getElementById('text-input'),
            charCount: document.getElementById('char-count'),
            processingStatus: document.getElementById('processing-status'),
            visualizationSection: document.getElementById('visualization-section'),
            progressIndicator: document.getElementById('progress-indicator'),
            tokensDisplay: document.getElementById('tokens-display'),
            attentionViz: document.getElementById('attention-viz'),
            layerInfo: document.getElementById('layer-info'),
            relationshipsContainer: document.getElementById('relationships-container'),
            relationshipsList: document.getElementById('relationships-list')
        };
    }
    
    /**
     * Set up event listeners for user interactions
     */
    setupEventListeners() {
        // Text input with debouncing
        this.elements.textInput.addEventListener('input', (e) => {
            this.updateCharCount(e.target.value.length);
            this.debounceInput(e.target.value);
        });
        
        // Handle paste events
        this.elements.textInput.addEventListener('paste', (e) => {
            setTimeout(() => {
                const text = e.target.value;
                this.updateCharCount(text.length);
                this.debounceInput(text);
            }, 10);
        });
        
        // Keyboard accessibility
        this.elements.textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.processText(e.target.value);
            }
        });
    }
    
    /**
     * Update character count display
     */
    updateCharCount(length) {
        this.elements.charCount.textContent = `${length} / 1000 characters`;
        
        if (length > 900) {
            this.elements.charCount.className = 'text-sm text-red-600 font-medium';
        } else if (length > 800) {
            this.elements.charCount.className = 'text-sm text-yellow-600';
        } else {
            this.elements.charCount.className = 'text-sm text-gray-500';
        }
    }
    
    /**
     * Debounce text input to avoid excessive API calls
     */
    debounceInput(text) {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        if (text.trim().length === 0) {
            this.hideVisualization();
            return;
        }
        
        this.debounceTimer = setTimeout(() => {
            if (!this.isProcessing && text.trim().length > 0) {
                this.processText(text.trim());
            }
        }, 1000);
    }
    
    /**
     * Initialize D3.js visualization container
     */
    initializeVisualization() {
        const container = this.elements.attentionViz;
        const rect = container.getBoundingClientRect();
        this.width = rect.width || 800;
        this.height = rect.height || 400;
        
        this.svg = d3.select(container)
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('viewBox', `0 0 ${this.width} ${this.height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');
        
        // Add groups for different elements
        this.svg.append('g').attr('class', 'attention-lines');
        this.svg.append('g').attr('class', 'token-nodes');
        this.svg.append('g').attr('class', 'token-labels');
    }
    
    /**
     * Process text through the backend API
     */
    async processText(text) {
        if (this.isProcessing) {
            return;
        }
        
        try {
            this.isProcessing = true;
            this.showProcessingState();
            this.clearVisualization();
            
            // Close existing EventSource if any
            if (this.eventSource) {
                this.eventSource.close();
            }
            
            // Start Server-Sent Events connection
            const response = await fetch('/api/v1/attention', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: text })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.handleSSEStream(response);
            
        } catch (error) {
            console.error('Error processing text:', error);
            this.showError(`Error: ${error.message}`);
            this.isProcessing = false;
        }
    }
    
    /**
     * Handle Server-Sent Events stream
     */
    handleSSEStream(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        const readStream = async () => {
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');
                    
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6));
                                this.handleSSEMessage(data);
                            } catch (e) {
                                console.error('Error parsing SSE data:', e);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error reading stream:', error);
                this.showError('Connection error occurred');
            } finally {
                this.isProcessing = false;
            }
        };
        
        readStream();
    }
    
    /**
     * Handle individual SSE messages
     */
    handleSSEMessage(data) {
        switch (data.type) {
            case 'tokenization':
                this.updateStatus('Tokenizing text...');
                break;
                
            case 'tokens':
                this.displayTokens(data.data);
                this.updateStatus('Analyzing attention patterns...');
                break;
                
            case 'layer_attention':
                this.updateLayerProgress(data.layer);
                this.updateStatus(`Processing layer ${data.layer + 1}...`);
                break;
                
            case 'meaningful_attention':
                this.currentAttentionData = data.data;
                this.updateStatus('Generating visualization...');
                break;
                
            case 'relationships':
                this.currentRelationships = data.data;
                this.displayRelationships(data.data);
                this.updateStatus('Finalizing visualization...');
                break;
                
            case 'complete':
                this.renderAttentionVisualization();
                this.updateStatus('Complete!');
                this.hideProcessingIndicator();
                this.isProcessing = false;
                break;
                
            case 'error':
                this.showError(data.message);
                this.isProcessing = false;
                break;
        }
    }
    
    /**
     * Display tokens in the UI
     */
    displayTokens(tokens) {
        this.currentTokens = tokens;
        const container = this.elements.tokensDisplay;
        container.innerHTML = '';
        
        tokens.forEach((token, index) => {
            const tokenElement = document.createElement('span');
            tokenElement.className = 'token fade-in';
            tokenElement.textContent = token;
            tokenElement.setAttribute('data-index', index);
            tokenElement.setAttribute('role', 'listitem');
            tokenElement.setAttribute('tabindex', '0');
            
            // Add interaction handlers
            tokenElement.addEventListener('mouseenter', () => {
                this.highlightToken(index);
            });
            
            tokenElement.addEventListener('mouseleave', () => {
                this.unhighlightTokens();
            });
            
            tokenElement.addEventListener('click', () => {
                this.focusToken(index);
            });
            
            container.appendChild(tokenElement);
        });
        
        this.elements.visualizationSection.classList.remove('hidden');
    }
    
    /**
     * Render the main attention visualization using D3.js
     */
    renderAttentionVisualization() {
        if (!this.currentTokens.length || !this.currentAttentionData) {
            return;
        }
        
        const tokens = this.currentTokens;
        const attentionMatrix = this.currentAttentionData;
        
        // Calculate positions for tokens in a circle
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const radius = Math.min(this.width, this.height) * 0.35;
        
        const positions = tokens.map((token, i) => {
            const angle = (2 * Math.PI * i) / tokens.length - Math.PI / 2;
            return {
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle),
                token: token,
                index: i
            };
        });
        
        // Clear existing visualization
        this.svg.selectAll('*').remove();
        this.svg.append('g').attr('class', 'attention-lines');
        this.svg.append('g').attr('class', 'token-nodes');
        this.svg.append('g').attr('class', 'token-labels');
        
        // Draw attention lines
        this.drawAttentionLines(positions, attentionMatrix);
        
        // Draw token nodes
        this.drawTokenNodes(positions);
        
        // Draw token labels
        this.drawTokenLabels(positions);
    }
    
    /**
     * Draw attention lines between tokens
     */
    drawAttentionLines(positions, attentionMatrix) {
        const linesGroup = this.svg.select('.attention-lines');
        const maxAttention = d3.max(attentionMatrix.flat());
        
        for (let i = 0; i < positions.length; i++) {
            for (let j = 0; j < positions.length; j++) {
                if (i !== j) {
                    const attention = attentionMatrix[i][j];
                    const normalizedAttention = attention / maxAttention;
                    
                    if (normalizedAttention > 0.1) { // Only show significant attention
                        const line = linesGroup.append('line')
                            .attr('class', 'attention-line')
                            .attr('x1', positions[i].x)
                            .attr('y1', positions[i].y)
                            .attr('x2', positions[j].x)
                            .attr('y2', positions[j].y)
                            .attr('stroke', this.getAttentionColor(normalizedAttention))
                            .attr('stroke-width', Math.max(1, normalizedAttention * 5))
                            .attr('opacity', Math.max(0.3, normalizedAttention))
                            .attr('data-from', i)
                            .attr('data-to', j);
                    }
                }
            }
        }
    }
    
    /**
     * Draw token nodes
     */
    drawTokenNodes(positions) {
        const nodesGroup = this.svg.select('.token-nodes');
        
        nodesGroup.selectAll('.token-circle')
            .data(positions)
            .enter()
            .append('circle')
            .attr('class', 'token-circle')
            .attr('cx', d => d.x)
            .attr('cy', d => d.y)
            .attr('r', 6)
            .attr('data-index', d => d.index)
            .on('mouseenter', (event, d) => {
                this.highlightToken(d.index);
            })
            .on('mouseleave', () => {
                this.unhighlightTokens();
            })
            .on('click', (event, d) => {
                this.focusToken(d.index);
            });
    }
    
    /**
     * Draw token labels
     */
    drawTokenLabels(positions) {
        const labelsGroup = this.svg.select('.token-labels');
        
        labelsGroup.selectAll('.token-label')
            .data(positions)
            .enter()
            .append('text')
            .attr('class', 'token-label')
            .attr('x', d => d.x)
            .attr('y', d => d.y + 20)
            .text(d => d.token)
            .attr('data-index', d => d.index);
    }
    
    /**
     * Get color for attention strength
     */
    getAttentionColor(strength) {
        const colors = d3.scaleSequential(d3.interpolateViridis)
            .domain([0, 1]);
        return colors(strength);
    }
    
    /**
     * Highlight a specific token and its connections
     */
    highlightToken(index) {
        // Highlight token in tokens display
        this.elements.tokensDisplay.querySelectorAll('.token').forEach((token, i) => {
            if (i === index) {
                token.classList.add('active');
            } else {
                token.classList.remove('active');
            }
        });
        
        // Highlight in visualization
        this.svg.selectAll('.token-circle')
            .classed('highlighted', (d, i) => i === index);
        
        this.svg.selectAll('.token-label')
            .classed('highlighted', (d, i) => i === index);
        
        // Highlight related attention lines
        this.svg.selectAll('.attention-line')
            .style('opacity', function() {
                const from = parseInt(this.getAttribute('data-from'));
                const to = parseInt(this.getAttribute('data-to'));
                return (from === index || to === index) ? 0.8 : 0.1;
            });
    }
    
    /**
     * Remove token highlighting
     */
    unhighlightTokens() {
        this.elements.tokensDisplay.querySelectorAll('.token')
            .forEach(token => token.classList.remove('active'));
        
        this.svg.selectAll('.token-circle')
            .classed('highlighted', false);
        
        this.svg.selectAll('.token-label')
            .classed('highlighted', false);
        
        this.svg.selectAll('.attention-line')
            .style('opacity', null);
    }
    
    /**
     * Focus on a specific token (for accessibility)
     */
    focusToken(index) {
        this.highlightToken(index);
        
        // Announce to screen readers
        const token = this.currentTokens[index];
        this.announceToScreenReader(`Focused on token: ${token}`);
    }
    
    /**
     * Display attention relationships
     */
    displayRelationships(relationships) {
        const container = this.elements.relationshipsList;
        container.innerHTML = '';
        
        relationships.slice(0, 10).forEach((rel, index) => {
            const item = document.createElement('div');
            item.className = 'relationship-item slide-in';
            item.style.animationDelay = `${index * 0.1}s`;
            
            const strength = Math.round(rel.strength * 100);
            
            item.innerHTML = `
                <div class="relationship-strength">
                    <div class="relationship-strength-bar" style="width: ${strength}%"></div>
                </div>
                <div class="relationship-tokens">
                    <span class="font-medium">${rel.from_token}</span>
                    <span class="relationship-arrow">→</span>
                    <span class="font-medium">${rel.to_token}</span>
                    <span class="text-xs text-gray-500 ml-2">(${strength}%)</span>
                </div>
            `;
            
            // Add interaction
            item.addEventListener('mouseenter', () => {
                this.highlightRelationship(rel.from_index, rel.to_index);
            });
            
            item.addEventListener('mouseleave', () => {
                this.unhighlightTokens();
            });
            
            container.appendChild(item);
        });
        
        this.elements.relationshipsContainer.classList.remove('hidden');
    }
    
    /**
     * Highlight a specific relationship
     */
    highlightRelationship(fromIndex, toIndex) {
        // Highlight tokens
        this.elements.tokensDisplay.querySelectorAll('.token').forEach((token, i) => {
            if (i === fromIndex) {
                token.classList.add('source');
            } else if (i === toIndex) {
                token.classList.add('target');
            } else {
                token.classList.remove('source', 'target', 'active');
            }
        });
        
        // Highlight in visualization
        this.svg.selectAll('.attention-line')
            .style('opacity', function() {
                const from = parseInt(this.getAttribute('data-from'));
                const to = parseInt(this.getAttribute('data-to'));
                return (from === fromIndex && to === toIndex) ? 1.0 : 0.1;
            });
    }
    
    /**
     * Update processing status
     */
    updateStatus(message) {
        this.elements.processingStatus.textContent = message;
        this.elements.processingStatus.className = 'text-sm text-blue-600';
    }
    
    /**
     * Show error message
     */
    showError(message) {
        this.elements.processingStatus.textContent = message;
        this.elements.processingStatus.className = 'text-sm text-red-600';
        this.hideProcessingIndicator();
    }
    
    /**
     * Show processing state
     */
    showProcessingState() {
        this.elements.progressIndicator.classList.remove('hidden');
        this.elements.textInput.classList.add('processing');
    }
    
    /**
     * Hide processing indicator
     */
    hideProcessingIndicator() {
        this.elements.progressIndicator.classList.add('hidden');
        this.elements.textInput.classList.remove('processing');
    }
    
    /**
     * Update layer processing progress
     */
    updateLayerProgress(currentLayer) {
        this.elements.layerInfo.textContent = `Processing layer ${currentLayer + 1}`;
    }
    
    /**
     * Clear visualization
     */
    clearVisualization() {
        this.elements.tokensDisplay.innerHTML = '';
        this.elements.relationshipsList.innerHTML = '';
        this.elements.relationshipsContainer.classList.add('hidden');
        
        if (this.svg) {
            this.svg.selectAll('*').remove();
        }
        
        this.currentTokens = [];
        this.currentAttentionData = null;
        this.currentRelationships = [];
    }
    
    /**
     * Hide visualization section
     */
    hideVisualization() {
        this.elements.visualizationSection.classList.add('hidden');
        this.clearVisualization();
    }
    
    /**
     * Announce to screen readers (for accessibility)
     */
    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = message;
        
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.attentionVisualizer = new AttentionVisualizer();
    
    // Handle window resize
    window.addEventListener('resize', () => {
        if (window.attentionVisualizer.svg) {
            window.attentionVisualizer.initializeVisualization();
            if (window.attentionVisualizer.currentTokens.length > 0) {
                window.attentionVisualizer.renderAttentionVisualization();
            }
        }
    });
});

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AttentionVisualizer;
}
