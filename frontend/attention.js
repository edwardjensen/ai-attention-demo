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
            attentionViz: document.getElementById('visualization-container'),
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
        this.height = rect.height || 650;
        
        // Select the existing SVG element
        this.svg = d3.select('#attention-svg');
        
        // Clear any existing content
        this.svg.selectAll('*').remove();
        
        // Update SVG dimensions
        this.svg
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
     * Display tokens in the UI (filtered to show only meaningful words)
     */
    displayTokens(tokens) {
        this.currentTokens = tokens;
        const container = this.elements.tokensDisplay;
        container.innerHTML = '';
        
        // Filter out special tokens and system tokens for display
        const meaningfulTokens = tokens.filter((token, index) => {
            return !token.startsWith('[') &&  // Remove [CLS], [SEP], etc.
                   !token.startsWith('##') &&  // Remove subword tokens
                   token.length > 0 &&          // Remove empty tokens
                   token !== '.' &&             // Remove standalone punctuation
                   token !== ',' &&
                   token !== '!' &&
                   token !== '?';
        });
        
        meaningfulTokens.forEach((token, displayIndex) => {
            // Find original index for interaction mapping
            const originalIndex = tokens.indexOf(token);
            
            const tokenElement = document.createElement('span');
            tokenElement.className = 'token fade-in';
            tokenElement.textContent = token;
            tokenElement.setAttribute('data-index', originalIndex);
            tokenElement.setAttribute('data-display-index', displayIndex);
            tokenElement.setAttribute('role', 'listitem');
            tokenElement.setAttribute('tabindex', '0');
            
            // Add interaction handlers
            tokenElement.addEventListener('mouseenter', () => {
                this.highlightToken(originalIndex);
            });
            
            tokenElement.addEventListener('mouseleave', () => {
                this.unhighlightTokens();
            });
            
            tokenElement.addEventListener('click', () => {
                this.focusToken(originalIndex);
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
        
        // Filter out special tokens completely for visualization
        const filteredTokenData = tokens.map((token, index) => ({
            token: token,
            originalIndex: index,
            cleanToken: token.replace('##', '')
        })).filter(data => 
            !data.token.startsWith('[') &&  // Remove [CLS], [SEP], etc.
            !data.token.startsWith('##') &&  // Remove subword tokens
            data.token.length > 1 &&  // Remove single punctuation
            data.token !== '.'  // Remove periods specifically
        );
        
        if (filteredTokenData.length < 2) {
            this.showNoVisualizationMessage("Not enough meaningful words to visualize attention patterns");
            return;
        }
        
        // Use circular layout for better attention visualization
        this.renderWordOnlyVisualization(filteredTokenData, attentionMatrix);
    }
    
    /**
     * Show message when visualization isn't possible
     */
    showNoVisualizationMessage(message) {
        this.svg.selectAll('*').remove();
        
        this.svg.append('text')
            .attr('x', this.width / 2)
            .attr('y', this.height / 2)
            .attr('text-anchor', 'middle')
            .style('font-size', '16px')
            .style('fill', '#6b7280')
            .style('font-weight', '500')
            .text(message);
        
        this.svg.append('text')
            .attr('x', this.width / 2)
            .attr('y', this.height / 2 + 25)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', '#9ca3af')
            .text('Try a sentence with multiple related words');
    }
    
    /**
     * Render visualization with only meaningful words
     */
    renderWordOnlyVisualization(filteredTokenData, attentionMatrix) {
        // Conservative positioning to ensure tokens stay in bounds
        const padding = 50; // Larger padding for token labels and safety
        const centerX = this.width * 0.35;  // Move center left for horizontal space
        const centerY = this.height * 0.45;   // Move center slightly down for balance
        
        // Calculate maximum safe radius to fit within bounds
        const maxRadiusX = (this.width * 0.6 - padding) / 2;  // Leave space on right for legend
        const maxRadiusY = (this.height - 2 * padding) / 2;   // Leave space top/bottom
        const radius = Math.min(maxRadiusX, maxRadiusY, 140); // Cap at reasonable size
        
        // Position tokens around the circle
        const positions = filteredTokenData.map((data, i) => {
            const angle = (2 * Math.PI * i) / filteredTokenData.length - Math.PI / 2;
            return {
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle),
                token: data.cleanToken,
                originalIndex: data.originalIndex,
                displayIndex: i
            };
        });
        
        // Double-check bounds and adjust if any tokens are still outside
        const minX = Math.min(...positions.map(p => p.x));
        const maxX = Math.max(...positions.map(p => p.x));
        const minY = Math.min(...positions.map(p => p.y));
        const maxY = Math.max(...positions.map(p => p.y));
        
        // If still outside bounds, shrink further
        if (minX < padding || maxX > (this.width - padding) || 
            minY < padding || maxY > (this.height - padding)) {
            
            const safeRadius = Math.min(
                (this.width * 0.5 - 2 * padding) / 2,
                (this.height - 2 * padding) / 2
            ) * 0.8; // 80% for extra safety margin
            
            positions.forEach((pos, i) => {
                const angle = (2 * Math.PI * i) / filteredTokenData.length - Math.PI / 2;
                pos.x = centerX + safeRadius * Math.cos(angle);
                pos.y = centerY + safeRadius * Math.sin(angle);
            });
        }
        
        // Clear existing visualization
        this.svg.selectAll('*').remove();
        this.svg.append('g').attr('class', 'attention-lines');
        this.svg.append('g').attr('class', 'token-nodes');
        this.svg.append('g').attr('class', 'token-labels');
        
        // Find and draw word-to-word attention connections
        this.drawWordToWordAttention(positions, attentionMatrix);
        
        // Draw token nodes
        this.drawWordNodes(positions);
        
        // Draw token labels
        this.drawWordLabels(positions);
        
        // Add center explanation positioned for the new layout
        this.addWordAttentionExplanation(centerX, centerY);
    }
    
    /**
     * Draw attention between meaningful words only
     */
    drawWordToWordAttention(positions, attentionMatrix) {
        const linesGroup = this.svg.select('.attention-lines');
        
        // Find attention connections between words only
        const connections = [];
        
        for (let i = 0; i < positions.length; i++) {
            for (let j = 0; j < positions.length; j++) {
                if (i !== j) {
                    const fromIdx = positions[i].originalIndex;
                    const toIdx = positions[j].originalIndex;
                    
                    if (fromIdx < attentionMatrix.length && toIdx < attentionMatrix[fromIdx].length) {
                        const attention = attentionMatrix[fromIdx][toIdx];
                        
                        // Only show meaningful word-to-word attention
                        if (attention > 0.05) {
                            connections.push({
                                fromPos: positions[i],
                                toPos: positions[j],
                                fromIndex: i,
                                toIndex: j,
                                strength: attention,
                                fromToken: positions[i].token,
                                toToken: positions[j].token
                            });
                        }
                    }
                }
            }
        }
        
        // Sort by strength and take top connections
        connections.sort((a, b) => b.strength - a.strength);
        const topConnections = connections.slice(0, Math.min(12, connections.length));
        
        if (topConnections.length === 0) {
            this.showNoVisualizationMessage("No significant attention patterns between words detected");
            return;
        }
        
        // Draw the word-to-word connections
        topConnections.forEach((conn, index) => {
            // Create curved paths for better visualization
            const dx = conn.toPos.x - conn.fromPos.x;
            const dy = conn.toPos.y - conn.fromPos.y;
            const dr = Math.sqrt(dx * dx + dy * dy) * 1.2;
            
            const path = linesGroup.append('path')
                .attr('class', 'attention-line')
                .attr('d', `M${conn.fromPos.x},${conn.fromPos.y}A${dr},${dr} 0 0,1 ${conn.toPos.x},${conn.toPos.y}`)
                .attr('stroke', this.getAttentionColor(conn.strength))
                .attr('stroke-width', Math.max(2, conn.strength * 12))
                .attr('fill', 'none')
                .attr('opacity', 0)
                .attr('data-from', conn.fromIndex)
                .attr('data-to', conn.toIndex)
                .attr('data-strength', conn.strength.toFixed(3))
                .style('cursor', 'pointer')
                .style('marker-end', 'url(#arrowhead)');
            
            // Add arrowhead marker
            if (index === 0) {
                this.addArrowheadMarker();
            }
            
            // Animate lines appearing
            path.transition()
                .delay(index * 200)
                .duration(1000)
                .attr('opacity', Math.max(0.7, conn.strength));
            
            // Add hover effects
            path.on('mouseover', (event) => {
                path.attr('stroke-width', Math.max(4, conn.strength * 18))
                    .attr('opacity', 1);
                
                this.showWordConnectionTooltip(event, conn);
                this.highlightWordPair(conn.fromIndex, conn.toIndex);
            })
            .on('mouseout', () => {
                path.attr('stroke-width', Math.max(2, conn.strength * 12))
                    .attr('opacity', Math.max(0.7, conn.strength));
                
                this.hideTooltip();
                this.unhighlightTokens();
            });
        });
    }
    
    /**
     * Draw word nodes with better styling
     */
    drawWordNodes(positions) {
        const nodesGroup = this.svg.select('.token-nodes');
        
        const nodes = nodesGroup.selectAll('.token-circle')
            .data(positions)
            .enter()
            .append('circle')
            .attr('class', 'token-circle word-token')
            .attr('cx', d => d.x)
            .attr('cy', d => d.y)
            .attr('r', 0)
            .attr('data-index', d => d.displayIndex)
            .style('cursor', 'pointer');
        
        // Set nodes to final state immediately (no animation)
        nodes.attr('r', 10);
        
        // Add interactions
        nodes.on('mouseenter', (event, d) => {
            this.highlightWordConnections(d.displayIndex);
            this.showTokenTooltip(event, d);
        })
        .on('mouseleave', () => {
            this.unhighlightTokens();
            this.hideTooltip();
        })
        .on('click', (event, d) => {
            this.focusToken(d.displayIndex);
        });
    }
    
    /**
     * Draw word labels
     */
    drawWordLabels(positions) {
        const labelsGroup = this.svg.select('.token-labels');
        
        const labels = labelsGroup.selectAll('.token-label')
            .data(positions)
            .enter()
            .append('text')
            .attr('class', 'token-label word-label')
            .attr('x', d => d.x)
            .attr('y', d => d.y + 30)
            .text(d => d.token)
            .attr('data-index', d => d.displayIndex)
            .style('opacity', 0);
        
        // Set labels to final state immediately (no animation)
        labels.style('opacity', 1);
    }
    
    /**
     * Add explanation for word attention with custom positioning
     */
    addWordAttentionExplanation(centerX, centerY) {
        // Use default center if not provided
        const x = centerX || this.width / 2;
        const y = centerY || this.height / 2;
        
        const centerGroup = this.svg.append('g').attr('class', 'center-explanation');
        
        centerGroup.append('text')
            .attr('x', x)
            .attr('y', y - 15)
            .attr('text-anchor', 'middle')
            .style('font-size', '14px')
            .style('fill', '#374151')
            .style('font-weight', 'bold')
            .text('Word Attention');
        
        centerGroup.append('text')
            .attr('x', x)
            .attr('y', y)
            .attr('text-anchor', 'middle')
            .style('font-size', '11px')
            .style('fill', '#6b7280')
            .text('How words relate');
        
        centerGroup.append('text')
            .attr('x', x)
            .attr('y', y + 15)
            .attr('text-anchor', 'middle')
            .style('font-size', '10px')
            .style('fill', '#9ca3af')
            .text('to each other');
    }
    
    /**
     * Show tooltip for individual tokens
     */
    showTokenTooltip(event, tokenData) {
        const tooltip = d3.select('body').append('div')
            .attr('class', 'attention-tooltip')
            .style('position', 'absolute')
            .style('background', 'rgba(0, 0, 0, 0.9)')
            .style('color', 'white')
            .style('padding', '12px 16px')
            .style('border-radius', '8px')
            .style('font-size', '14px')
            .style('pointer-events', 'none')
            .style('z-index', '1000')
            .style('opacity', 0)
            .style('box-shadow', '0 4px 12px rgba(0, 0, 0, 0.2)');
        
        tooltip.html(`
            <div style="font-weight: bold; margin-bottom: 8px;">Token: "${tokenData.token}"</div>
            <div style="font-size: 12px; color: #cbd5e1; margin-bottom: 4px;">
                Position: ${tokenData.displayIndex + 1} of ${this.svg.selectAll('.token-circle').size()}
            </div>
            <div style="font-size: 11px; color: #94a3b8;">
                💡 Click to focus on this token's connections
            </div>
        `);
        
        tooltip.transition()
            .duration(200)
            .style('opacity', 1);
        
        tooltip.style('left', (event.pageX + 15) + 'px')
            .style('top', (event.pageY - 10) + 'px');
    }
    
    /**
     * Show tooltip for word connections
     */
    showWordConnectionTooltip(event, connection) {
        const tooltip = d3.select('body').append('div')
            .attr('class', 'attention-tooltip')
            .style('position', 'absolute')
            .style('background', 'rgba(0, 0, 0, 0.9)')
            .style('color', 'white')
            .style('padding', '12px 16px')
            .style('border-radius', '8px')
            .style('font-size', '14px')
            .style('pointer-events', 'none')
            .style('z-index', '1000')
            .style('opacity', 0)
            .style('box-shadow', '0 4px 12px rgba(0, 0, 0, 0.2)');
        
        const percentage = (connection.strength * 100).toFixed(1);
        const strengthDesc = connection.strength > 0.3 ? 'Very Strong' : 
                           connection.strength > 0.2 ? 'Strong' : 
                           connection.strength > 0.1 ? 'Moderate' : 'Weak';
        
        tooltip.html(`
            <div style="font-weight: bold; margin-bottom: 6px; font-size: 16px;">
                "${connection.fromToken}" → "${connection.toToken}"
            </div>
            <div style="font-size: 12px; color: #cbd5e1; margin-bottom: 4px;">
                ${strengthDesc} attention: ${percentage}%
            </div>
            <div style="font-size: 11px; color: #94a3b8;">
                The AI focuses on "${connection.toToken}" when processing "${connection.fromToken}"
            </div>
        `);
        
        tooltip.transition()
            .duration(200)
            .style('opacity', 1);
        
        tooltip.style('left', (event.pageX + 15) + 'px')
            .style('top', (event.pageY - 10) + 'px');
    }
    
    /**
     * Highlight connections for a specific word
     */
    highlightWordConnections(tokenIndex) {
        // Highlight the word using direct DOM manipulation to prevent movement
        this.svg.selectAll('.token-circle').nodes().forEach((node, i) => {
            if (i === tokenIndex) {
                node.classList.add('highlighted');
            } else {
                node.classList.remove('highlighted', 'source', 'target');
            }
        });
        
        this.svg.selectAll('.token-label').nodes().forEach((node, i) => {
            if (i === tokenIndex) {
                node.classList.add('highlighted');
            } else {
                node.classList.remove('highlighted');
            }
        });
        
        // Highlight related lines
        this.svg.selectAll('.attention-line')
            .style('opacity', function() {
                const from = parseInt(this.getAttribute('data-from'));
                const to = parseInt(this.getAttribute('data-to'));
                return (from === tokenIndex || to === tokenIndex) ? 1.0 : 0.2;
            })
            .attr('stroke-width', function() {
                const from = parseInt(this.getAttribute('data-from'));
                const to = parseInt(this.getAttribute('data-to'));
                const strength = parseFloat(this.getAttribute('data-strength'));
                return (from === tokenIndex || to === tokenIndex) 
                    ? Math.max(4, strength * 18) 
                    : Math.max(2, strength * 12);
            });
    }
    
    /**
     * Highlight a pair of words without any movement
     */
    highlightWordPair(fromIndex, toIndex) {
        this.svg.selectAll('.token-circle').nodes().forEach((node, i) => {
            node.classList.remove('highlighted', 'source', 'target');
            if (i === fromIndex) {
                node.classList.add('highlighted', 'source');
            } else if (i === toIndex) {
                node.classList.add('highlighted', 'target');
            }
        });
        
        this.svg.selectAll('.token-label').nodes().forEach((node, i) => {
            if (i === fromIndex || i === toIndex) {
                node.classList.add('highlighted');
            } else {
                node.classList.remove('highlighted');
            }
        });
    }
    
    /**
     * Draw meaningful attention lines with better filtering
     */
    drawMeaningfulAttentionLines(positions, attentionMatrix) {
        const linesGroup = this.svg.select('.attention-lines');
        
        // Find all non-trivial attention connections
        const connections = [];
        
        for (let i = 0; i < positions.length; i++) {
            for (let j = 0; j < positions.length; j++) {
                if (i !== j) {
                    const fromIdx = positions[i].originalIndex;
                    const toIdx = positions[j].originalIndex;
                    
                    if (fromIdx < attentionMatrix.length && toIdx < attentionMatrix[fromIdx].length) {
                        const attention = attentionMatrix[fromIdx][toIdx];
                        
                        // Skip trivial connections (special tokens to themselves, very weak connections)
                        const isFromSpecial = positions[i].isSpecial;
                        const isToSpecial = positions[j].isSpecial;
                        const isMeaningful = attention > 0.08 && !(isFromSpecial && isToSpecial);
                        
                        if (isMeaningful) {
                            connections.push({
                                fromPos: positions[i],
                                toPos: positions[j],
                                fromIndex: i,
                                toIndex: j,
                                strength: attention,
                                fromToken: positions[i].token,
                                toToken: positions[j].token,
                                isSpecialConnection: isFromSpecial || isToSpecial
                            });
                        }
                    }
                }
            }
        }
        
        // Sort by strength and take meaningful connections
        connections.sort((a, b) => b.strength - a.strength);
        const meaningfulConnections = connections.slice(0, 15);
        
        if (meaningfulConnections.length === 0) {
            // If no meaningful connections, show a message
            this.svg.append('text')
                .attr('x', this.width / 2)
                .attr('y', this.height / 2)
                .attr('text-anchor', 'middle')
                .style('font-size', '14px')
                .style('fill', '#6b7280')
                .text('No strong attention patterns detected in this text');
            return;
        }
        
        // Draw the connections with improved styling
        meaningfulConnections.forEach((conn, index) => {
            // Create curved paths for better visualization
            const dx = conn.toPos.x - conn.fromPos.x;
            const dy = conn.toPos.y - conn.fromPos.y;
            const dr = Math.sqrt(dx * dx + dy * dy) * 1.5;
            
            const path = linesGroup.append('path')
                .attr('class', 'attention-line')
                .attr('d', `M${conn.fromPos.x},${conn.fromPos.y}A${dr},${dr} 0 0,1 ${conn.toPos.x},${conn.toPos.y}`)
                .attr('stroke', this.getAttentionColor(conn.strength))
                .attr('stroke-width', Math.max(2, conn.strength * 10))
                .attr('fill', 'none')
                .attr('opacity', 0)
                .attr('data-from', conn.fromIndex)
                .attr('data-to', conn.toIndex)
                .attr('data-strength', conn.strength.toFixed(3))
                .style('cursor', 'pointer')
                .style('marker-end', 'url(#arrowhead)');
            
            // Add arrowhead marker
            if (index === 0) {
                this.addArrowheadMarker();
            }
            
            // Animate lines appearing
            path.transition()
                .delay(index * 150)
                .duration(800)
                .attr('opacity', Math.max(0.6, conn.strength));
            
            // Add hover effects
            path.on('mouseover', (event) => {
                path.attr('stroke-width', Math.max(4, conn.strength * 15))
                    .attr('opacity', 1);
                
                this.showImprovedTooltip(event, conn);
                this.highlightTokenPair(conn.fromIndex, conn.toIndex);
            })
            .on('mouseout', () => {
                path.attr('stroke-width', Math.max(2, conn.strength * 10))
                    .attr('opacity', Math.max(0.6, conn.strength));
                
                this.hideTooltip();
                this.unhighlightTokens();
            });
        });
    }
    
    /**
     * Add arrowhead marker for attention direction
     */
    addArrowheadMarker() {
        const defs = this.svg.append('defs');
        
        defs.append('marker')
            .attr('id', 'arrowhead')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 8)
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', '#374151');
    }
    
    /**
     * Add center explanation
     */
    addCenterExplanation() {
        const centerGroup = this.svg.append('g').attr('class', 'center-explanation');
        
        centerGroup.append('text')
            .attr('x', this.width / 2)
            .attr('y', this.height / 2 - 10)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', '#4b5563')
            .style('font-weight', 'bold')
            .text('Attention Flow');
        
        centerGroup.append('text')
            .attr('x', this.width / 2)
            .attr('y', this.height / 2 + 10)
            .attr('text-anchor', 'middle')
            .style('font-size', '10px')
            .style('fill', '#6b7280')
            .text('Hover to explore');
    }
    
    /**
     * Draw improved token nodes
     */
    drawImprovedTokenNodes(positions) {
        const nodesGroup = this.svg.select('.token-nodes');
        
        const nodes = nodesGroup.selectAll('.token-circle')
            .data(positions)
            .enter()
            .append('circle')
            .attr('class', d => `token-circle ${d.isSpecial ? 'special-token' : 'content-token'}`)
            .attr('cx', d => d.x)
            .attr('cy', d => d.y)
            .attr('r', 0)
            .attr('data-index', d => d.displayIndex)
            .style('cursor', 'pointer');
        
        // Set nodes to final state immediately (no animation)
        nodes.attr('r', d => d.isSpecial ? 6 : 8);
        
        // Add interactions
        nodes.on('mouseenter', (event, d) => {
            this.highlightTokenConnections(d.displayIndex);
        })
        .on('mouseleave', () => {
            this.unhighlightTokens();
        });
    }
    
    /**
     * Draw improved token labels
     */
    drawImprovedTokenLabels(positions) {
        const labelsGroup = this.svg.select('.token-labels');
        
        const labels = labelsGroup.selectAll('.token-label')
            .data(positions)
            .enter()
            .append('text')
            .attr('class', d => `token-label ${d.isSpecial ? 'special-label' : 'content-label'}`)
            .attr('x', d => d.x)
            .attr('y', d => d.y + 25)
            .text(d => d.token)
            .attr('data-index', d => d.displayIndex)
            .style('opacity', 0);
        
        // Set labels to final state immediately (no animation)
        labels.style('opacity', d => d.isSpecial ? 0.7 : 1);
    }
    
    /**
     * Show improved tooltip
     */
    showImprovedTooltip(event, connection) {
        const tooltip = d3.select('body').append('div')
            .attr('class', 'attention-tooltip')
            .style('position', 'absolute')
            .style('background', 'rgba(0, 0, 0, 0.9)')
            .style('color', 'white')
            .style('padding', '10px 14px')
            .style('border-radius', '6px')
            .style('font-size', '13px')
            .style('pointer-events', 'none')
            .style('z-index', '1000')
            .style('opacity', 0)
            .style('box-shadow', '0 4px 6px rgba(0, 0, 0, 0.1)');
        
        const percentage = (connection.strength * 100).toFixed(1);
        const strengthDesc = connection.strength > 0.3 ? 'Strong' : 
                           connection.strength > 0.15 ? 'Moderate' : 'Weak';
        
        tooltip.html(`
            <div style="font-weight: bold; margin-bottom: 4px;">
                "${connection.fromToken}" → "${connection.toToken}"
            </div>
            <div style="font-size: 11px; color: #cbd5e1;">
                ${strengthDesc} attention: ${percentage}%
            </div>
        `);
        
        tooltip.transition()
            .duration(200)
            .style('opacity', 1);
        
        tooltip.style('left', (event.pageX + 15) + 'px')
            .style('top', (event.pageY - 10) + 'px');
    }
    
    /**
     * Draw selective attention lines (only strongest connections)
     */
    drawSelectiveAttentionLines(positions, attentionMatrix) {
        const linesGroup = this.svg.select('.attention-lines');
        
        // Calculate all attention weights and sort by strength
        const connections = [];
        
        for (let i = 0; i < positions.length; i++) {
            for (let j = 0; j < positions.length; j++) {
                if (i !== j) {
                    const fromIdx = positions[i].originalIndex;
                    const toIdx = positions[j].originalIndex;
                    const attention = attentionMatrix[fromIdx] && attentionMatrix[fromIdx][toIdx] 
                        ? attentionMatrix[fromIdx][toIdx] : 0;
                    
                    if (attention > 0.05) { // Only significant connections
                        connections.push({
                            from: i,
                            to: j,
                            fromPos: positions[i],
                            toPos: positions[j],
                            strength: attention,
                            fromToken: positions[i].token,
                            toToken: positions[j].token
                        });
                    }
                }
            }
        }
        
        // Sort by strength and take top connections
        connections.sort((a, b) => b.strength - a.strength);
        const topConnections = connections.slice(0, Math.min(20, connections.length));
        
        // Draw the connections
        topConnections.forEach((conn, index) => {
            const line = linesGroup.append('line')
                .attr('class', 'attention-line')
                .attr('x1', conn.fromPos.x)
                .attr('y1', conn.fromPos.y)
                .attr('x2', conn.toPos.x)
                .attr('y2', conn.toPos.y)
                .attr('stroke', this.getAttentionColor(conn.strength))
                .attr('stroke-width', Math.max(1, conn.strength * 8))
                .attr('opacity', 0)
                .attr('data-from', conn.from)
                .attr('data-to', conn.to)
                .attr('data-strength', conn.strength.toFixed(3))
                .style('cursor', 'pointer');
            
            // Animate lines appearing
            line.transition()
                .delay(index * 100)
                .duration(500)
                .attr('opacity', Math.max(0.4, conn.strength));
            
            // Add hover effects
            line.on('mouseover', (event) => {
                // Highlight this connection
                line.attr('stroke-width', Math.max(3, conn.strength * 12))
                    .attr('opacity', 1);
                
                // Show tooltip
                this.showConnectionTooltip(event, conn);
                
                // Highlight related tokens
                this.highlightTokenPair(conn.from, conn.to);
            })
            .on('mouseout', () => {
                line.attr('stroke-width', Math.max(1, conn.strength * 8))
                    .attr('opacity', Math.max(0.4, conn.strength));
                
                this.hideTooltip();
                this.unhighlightTokens();
            });
        });
    }
    
    /**
     * Draw enhanced token nodes with better interactivity
     */
    drawEnhancedTokenNodes(positions) {
        const nodesGroup = this.svg.select('.token-nodes');
        
        const nodes = nodesGroup.selectAll('.token-circle')
            .data(positions)
            .enter()
            .append('circle')
            .attr('class', 'token-circle')
            .attr('cx', d => d.x)
            .attr('cy', d => d.y)
            .attr('r', 0)
            .attr('data-index', d => d.displayIndex)
            .style('cursor', 'pointer');
        
        // Set nodes to final state immediately (no animation)
        nodes.attr('r', 8);
        
        // Add interactions
        nodes.on('mouseenter', (event, d) => {
            this.highlightTokenConnections(d.displayIndex);
            this.announceToScreenReader(`Token: ${d.token}`);
        })
        .on('mouseleave', () => {
            this.unhighlightTokens();
        })
        .on('click', (event, d) => {
            this.focusToken(d.displayIndex);
        });
    }
    
    /**
     * Draw enhanced token labels
     */
    drawEnhancedTokenLabels(positions, layout) {
        const labelsGroup = this.svg.select('.token-labels');
        
        const labels = labelsGroup.selectAll('.token-label')
            .data(positions)
            .enter()
            .append('text')
            .attr('class', 'token-label')
            .attr('x', d => d.x)
            .attr('y', d => layout === 'linear' ? d.y - 20 : d.y + 25)
            .text(d => d.token.replace('##', ''))
            .attr('data-index', d => d.displayIndex)
            .style('opacity', 0)
            .style('cursor', 'pointer');
        
        // Set labels to final state immediately (no animation)
        labels.style('opacity', 1);
        
        // Add click handlers to labels too
        labels.on('click', (event, d) => {
            this.focusToken(d.displayIndex);
        });
    }
    
    /**
     * Show tooltip for attention connections
     */
    showConnectionTooltip(event, connection) {
        const tooltip = d3.select('body').append('div')
            .attr('class', 'attention-tooltip')
            .style('position', 'absolute')
            .style('background', 'rgba(0, 0, 0, 0.8)')
            .style('color', 'white')
            .style('padding', '8px 12px')
            .style('border-radius', '4px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('z-index', '1000')
            .style('opacity', 0);
        
        tooltip.html(`
            <strong>${connection.fromToken}</strong> → <strong>${connection.toToken}</strong><br>
            Attention: ${(connection.strength * 100).toFixed(1)}%
        `);
        
        tooltip.transition()
            .duration(200)
            .style('opacity', 1);
        
        tooltip.style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
    }
    
    /**
     * Hide tooltip
     */
    hideTooltip() {
        d3.selectAll('.attention-tooltip').remove();
    }
    
    /**
     * Add interaction instructions
     */
    addInteractionInstructions() {
        if (!this.svg.select('.instructions').empty()) return;
        
        const instructions = this.svg.append('text')
            .attr('class', 'instructions')
            .attr('x', this.width / 2)
            .attr('y', this.height - 20)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', '#6b7280')
            .text('Hover over tokens or lines to explore attention patterns');
        
        // Fade out instructions after a few seconds
        setTimeout(() => {
            instructions.transition()
                .duration(2000)
                .style('opacity', 0)
                .remove();
        }, 5000);
    }
    
    /**
     * Highlight connections for a specific token
     */
    highlightTokenConnections(tokenIndex) {
        // Highlight the token
        this.svg.selectAll('.token-circle')
            .classed('highlighted', (d, i) => i === tokenIndex);
        
        this.svg.selectAll('.token-label')
            .classed('highlighted', (d, i) => i === tokenIndex);
        
        // Highlight related lines
        this.svg.selectAll('.attention-line')
            .style('opacity', function() {
                const from = parseInt(this.getAttribute('data-from'));
                const to = parseInt(this.getAttribute('data-to'));
                return (from === tokenIndex || to === tokenIndex) ? 1.0 : 0.1;
            })
            .attr('stroke-width', function() {
                const from = parseInt(this.getAttribute('data-from'));
                const to = parseInt(this.getAttribute('data-to'));
                const strength = parseFloat(this.getAttribute('data-strength'));
                return (from === tokenIndex || to === tokenIndex) 
                    ? Math.max(3, strength * 12) 
                    : Math.max(1, strength * 8);
            });
    }
    
    /**
     * Highlight a pair of tokens
     */
    highlightTokenPair(fromIndex, toIndex) {
        this.svg.selectAll('.token-circle')
            .classed('highlighted', (d, i) => i === fromIndex || i === toIndex)
            .classed('source', (d, i) => i === fromIndex)
            .classed('target', (d, i) => i === toIndex);
        
        this.svg.selectAll('.token-label')
            .classed('highlighted', (d, i) => i === fromIndex || i === toIndex);
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
        
        // Use direct DOM manipulation instead of D3 classed() to prevent repositioning
        this.svg.selectAll('.token-circle').nodes().forEach(node => {
            node.classList.remove('highlighted', 'source', 'target');
        });
        
        this.svg.selectAll('.token-label').nodes().forEach(node => {
            node.classList.remove('highlighted');
        });
        
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
     * Display attention relationships between words only
     */
    displayRelationships(relationships) {
        const container = this.elements.relationshipsList;
        container.innerHTML = '';
        
        // Filter to only show relationships between actual words (using original tokens)
        const wordRelationships = relationships.filter(rel => {
            const fromToken = rel.from_token;
            const toToken = rel.to_token;
            
            // Exclude special tokens and punctuation, but be more permissive
            const isFromWord = !fromToken.startsWith('[') && 
                              !fromToken.startsWith('##') && 
                              fromToken.length > 0 && 
                              fromToken !== '.' &&
                              fromToken !== ',' &&
                              fromToken !== '!' &&
                              fromToken !== '?';
            const isToWord = !toToken.startsWith('[') && 
                            !toToken.startsWith('##') && 
                            toToken.length > 0 && 
                            toToken !== '.' &&
                            toToken !== ',' &&
                            toToken !== '!' &&
                            toToken !== '?';
            
            // Lower the threshold to catch more relationships
            return isFromWord && isToWord && rel.strength > 0.03;
        });
        
        // Sort by strength and take top relationships
        wordRelationships.sort((a, b) => b.strength - a.strength);
        const topWordRelationships = wordRelationships.slice(0, 8);
        
        if (topWordRelationships.length === 0) {
            const noDataItem = document.createElement('div');
            noDataItem.className = 'relationship-item';
            noDataItem.innerHTML = `
                <div class="text-sm text-gray-500 italic text-center py-4">
                    <div class="mb-2">💭 No strong word-to-word attention patterns detected.</div>
                    <div class="text-xs">Try sentences with multiple related concepts like:</div>
                    <div class="text-xs mt-1 font-mono">"The cat chased the mouse through the garden"</div>
                </div>
            `;
            container.appendChild(noDataItem);
            this.elements.relationshipsContainer.classList.remove('hidden');
            return;
        }
        
        topWordRelationships.forEach((rel, index) => {
            const item = document.createElement('div');
            item.className = 'relationship-item slide-in';
            item.style.animationDelay = `${index * 0.15}s`;
            
            const strength = Math.round(rel.strength * 100);
            const strengthDesc = rel.strength > 0.2 ? 'Very Strong' : 
                               rel.strength > 0.1 ? 'Strong' : 
                               rel.strength > 0.05 ? 'Moderate' : 'Weak';
            
            // Clean up token display (remove ## prefixes)
            const fromToken = rel.from_token.replace('##', '');
            const toToken = rel.to_token.replace('##', '');
            
            item.innerHTML = `
                <div class="flex items-center space-x-3">
                    <div class="relationship-strength">
                        <div class="relationship-strength-bar" style="width: ${Math.max(strength, 10)}%"></div>
                    </div>
                    <div class="flex-1">
                        <div class="relationship-tokens">
                            <span class="font-semibold text-blue-800">"${fromToken}"</span>
                            <span class="relationship-arrow text-gray-400">→</span>
                            <span class="font-semibold text-green-800">"${toToken}"</span>
                            <span class="text-xs text-gray-500 ml-2 font-medium">${strengthDesc}</span>
                        </div>
                        <div class="text-xs text-gray-600 mt-1">
                            ${this.getWordRelationshipExplanation(fromToken, toToken, rel.strength)}
                        </div>
                    </div>
                    <div class="text-lg font-bold text-gray-400">
                        ${strength}%
                    </div>
                </div>
            `;
            
            // Add interaction - need to map back to display indices
            item.addEventListener('mouseenter', () => {
                // Find the display indices for these tokens
                const fromDisplayIndex = this.findTokenDisplayIndex(fromToken);
                const toDisplayIndex = this.findTokenDisplayIndex(toToken);
                
                if (fromDisplayIndex !== -1 && toDisplayIndex !== -1) {
                    this.highlightRelationship(fromDisplayIndex, toDisplayIndex);
                }
            });
            
            item.addEventListener('mouseleave', () => {
                this.unhighlightTokens();
            });
            
            container.appendChild(item);
        });
        
        this.elements.relationshipsContainer.classList.remove('hidden');
    }
    
    /**
     * Find display index for a token in the current visualization
     */
    findTokenDisplayIndex(tokenText) {
        // Look through the current visualization tokens
        const labels = this.svg.selectAll('.token-label').nodes();
        
        for (let i = 0; i < labels.length; i++) {
            const labelText = labels[i].textContent;
            if (labelText === tokenText || labelText.includes(tokenText)) {
                return i;
            }
        }
        
        return -1;
    }
    
    /**
     * Get explanation for word relationship
     */
    getWordRelationshipExplanation(fromToken, toToken, strength) {
        if (strength > 0.3) {
            return `When processing "${fromToken}", the AI strongly focuses on "${toToken}"`;
        } else if (strength > 0.2) {
            return `"${fromToken}" has a strong connection to "${toToken}"`;
        } else if (strength > 0.1) {
            return `The AI moderately associates "${fromToken}" with "${toToken}"`;
        } else {
            return `Weak attention from "${fromToken}" to "${toToken}"`;
        }
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
