# Xerow MCP Agent - Local Testing Guide

This guide describes how to run and test the **MCP Commerce Agent** in isolation, without running the full monorepo stack.

## Prerequisites
- **Python 3.10+** (Python 3.14 is verified)
- **Ollama** installed and running locally.
- **Supabase** credentials (in `.env`).

## Setup (First Run Only)

1.  **Navigate to the agent directory**
    ```bash
    cd apps/mcp-agent
    ```

2.  **Create virtual environment & Install dependencies**
    You can use the provided setup script command:
    ```bash
    pnpm setup
    ```
    *Or manually:*
    ```bash
    python3 -m venv env
    source env/bin/activate
    pip install -r requirements.txt
    ```

3.  **Configure Environment**
    Ensure a `.env` file exists in `apps/mcp-agent/` with your Supabase keys:
    ```ini
    SUPABASE_URL=...
    SUPABASE_KEY=...
    OPENAI_API_KEY=... (optional, if using OpenAI embedding)
    ```

4.  **Start Ollama**
    Ensure Ollama is running and has the llama3 model pulled:
    ```bash
    ollama run llama3.1:8b
    ```

## Running the Agent

To start the interactice CLI agent:

1.  **Using pnpm script** (from `apps/mcp-agent`):
    ```bash
    pnpm dev
    ```

2.  **Or Manually**:
    ```bash
    source env/bin/activate
    python3 -u agent.py
    ```

## Usage
Once running, you can interact with the agent directly in the terminal:
```text
> I need running shoes under $100
```

## Troubleshooting
- **Imports failing?** Make sure you activated the environment (`source env/bin/activate`).
- **Ollama connection error?** Ensure Ollama is running on port 11434.
