#!/bin/bash

# AI Attention Demo - Setup and Launch Script
# This script handles virtual environment setup, dependency installation, and app launch

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
VENV_DIR="$BACKEND_DIR/venv"
REQUIREMENTS_FILE="$BACKEND_DIR/requirements.txt"
APP_FILE="$BACKEND_DIR/app.py"
PYTHON_VERSION="3.11"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Python is available
check_python() {
    log_info "Checking Python installation..."
    
    if command -v python3 &> /dev/null; then
        PYTHON_CMD="python3"
    elif command -v python &> /dev/null; then
        PYTHON_CMD="python"
    else
        log_error "Python is not installed or not in PATH"
        log_error "Please install Python $PYTHON_VERSION or higher"
        exit 1
    fi
    
    # Check Python version
    PYTHON_VERSION_OUTPUT=$($PYTHON_CMD --version 2>&1)
    log_info "Found: $PYTHON_VERSION_OUTPUT"
    
    # Extract version number and check if it's >= 3.11
    PYTHON_VERSION_NUM=$($PYTHON_CMD -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
    if [[ $(echo "$PYTHON_VERSION_NUM >= 3.11" | bc -l) -eq 0 ]]; then
        log_warning "Python version $PYTHON_VERSION_NUM detected. Python 3.11+ recommended for optimal performance."
    fi
}

# Create virtual environment if it doesn't exist
setup_venv() {
    if [ ! -d "$VENV_DIR" ]; then
        log_info "Creating Python virtual environment..."
        cd "$BACKEND_DIR"
        $PYTHON_CMD -m venv venv
        log_success "Virtual environment created"
    else
        log_info "Virtual environment already exists"
    fi
}

# Activate virtual environment
activate_venv() {
    log_info "Activating virtual environment..."
    
    if [ -f "$VENV_DIR/bin/activate" ]; then
        source "$VENV_DIR/bin/activate"
        log_success "Virtual environment activated"
    else
        log_error "Virtual environment activation script not found"
        exit 1
    fi
}

# Install or update dependencies
install_dependencies() {
    log_info "Checking and installing dependencies..."
    
    if [ ! -f "$REQUIREMENTS_FILE" ]; then
        log_error "Requirements file not found: $REQUIREMENTS_FILE"
        exit 1
    fi
    
    # Check if pip needs upgrade
    pip install --upgrade pip --quiet
    
    # Check if dependencies are already installed
    if pip freeze | grep -q "torch\|transformers\|flask"; then
        log_info "Dependencies appear to be installed. Checking for updates..."
        pip install -r "$REQUIREMENTS_FILE" --upgrade --quiet
    else
        log_info "Installing dependencies (this may take a few minutes)..."
        pip install -r "$REQUIREMENTS_FILE"
    fi
    
    log_success "Dependencies installed/updated"
}

# Check if all required files exist
check_files() {
    log_info "Checking required files..."
    
    local missing_files=()
    
    if [ ! -f "$APP_FILE" ]; then
        missing_files+=("$APP_FILE")
    fi
    
    if [ ! -f "$REQUIREMENTS_FILE" ]; then
        missing_files+=("$REQUIREMENTS_FILE")
    fi
    
    if [ ! -d "$SCRIPT_DIR/frontend" ]; then
        missing_files+=("$SCRIPT_DIR/frontend")
    fi
    
    if [ ${#missing_files[@]} -ne 0 ]; then
        log_error "Missing required files/directories:"
        for file in "${missing_files[@]}"; do
            log_error "  - $file"
        done
        exit 1
    fi
    
    log_success "All required files found"
}

# Download models (optional pre-download)
download_models() {
    log_info "Pre-downloading AI models..."
    
    cat << 'EOF' > /tmp/download_models.py
import os
import sys
from transformers import AutoModel, AutoTokenizer

try:
    model_name = "distilbert-base-uncased"
    print(f"Downloading {model_name}...")
    
    # Download tokenizer
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    print("Tokenizer downloaded successfully")
    
    # Download model
    model = AutoModel.from_pretrained(model_name)
    print("Model downloaded successfully")
    
    print("All models downloaded and cached")
    
except Exception as e:
    print(f"Error downloading models: {e}")
    sys.exit(1)
EOF
    
    if python /tmp/download_models.py; then
        log_success "Models downloaded and cached"
    else
        log_warning "Model download failed, but app will download on first use"
    fi
    
    rm -f /tmp/download_models.py
}

# Check if port is available
check_port() {
    local port=${1:-8080}
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_warning "Port $port is already in use"
        log_info "You may need to kill the existing process or the app may already be running"
        log_info "Check: http://localhost:$port"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Launch the application
launch_app() {
    log_info "Starting AI Attention Demo..."
    log_info "The app will be available at: http://localhost:8080"
    log_info "Press Ctrl+C to stop the application"
    echo
    
    cd "$BACKEND_DIR"
    
    # Launch the app
    if python app.py; then
        log_success "Application stopped normally"
    else
        log_error "Application exited with an error"
        exit 1
    fi
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    deactivate 2>/dev/null || true
}

# Main execution
main() {
    echo "======================================"
    echo "   AI Attention Mechanism Demo"
    echo "======================================"
    echo
    
    # Set up cleanup trap
    trap cleanup EXIT
    
    # Parse command line arguments
    SKIP_MODEL_DOWNLOAD=false
    FORCE_REINSTALL=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-models)
                SKIP_MODEL_DOWNLOAD=true
                shift
                ;;
            --force-reinstall)
                FORCE_REINSTALL=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --skip-models      Skip pre-downloading AI models"
                echo "  --force-reinstall  Force reinstall all dependencies"
                echo "  --help, -h         Show this help message"
                echo ""
                echo "This script will:"
                echo "  1. Check Python installation"
                echo "  2. Create/activate virtual environment"
                echo "  3. Install/update dependencies"
                echo "  4. Pre-download AI models (optional)"
                echo "  5. Launch the application"
                echo ""
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                log_info "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Run setup steps
    check_python
    check_files
    setup_venv
    activate_venv
    
    if [ "$FORCE_REINSTALL" = true ]; then
        log_info "Force reinstalling dependencies..."
        pip uninstall -y $(pip freeze | cut -d= -f1) 2>/dev/null || true
    fi
    
    install_dependencies
    
    if [ "$SKIP_MODEL_DOWNLOAD" = false ]; then
        download_models
    fi
    
    check_port 8080
    
    echo
    log_success "Setup complete! Launching application..."
    echo
    
    launch_app
}

# Check if script is being sourced or executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
