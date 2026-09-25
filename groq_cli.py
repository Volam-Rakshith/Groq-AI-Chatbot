#!/usr/bin/env python3
"""
⚡ GROQ TERMINAL AI - Python CLI
Colorful terminal-styled AI chatbot powered by Groq LPUs.
Run with: python3 groq_cli.py
"""

import os
import sys
import time
import argparse
from typing import List, Dict

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.markdown import Markdown
    from rich.table import Table
    from rich.text import Text
    from rich.live import Live
    from rich.prompt import Prompt
except ImportError:
    print("Error: 'rich' library is required. Install with: pip install rich")
    sys.exit(1)

try:
    from groq import Groq, AuthenticationError, APIError
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False

console = Console()

DEFAULT_MODELS = [
    ("openai/gpt-oss-120b", "OpenAI GPT-OSS 120B", "Flagship open reasoning model (~500 tok/s, Production)"),
    ("openai/gpt-oss-20b", "OpenAI GPT-OSS 20B", "Ultra-fast reasoning model (~1000 tok/s, Production)"),
    ("qwen/qwen3.8-27b", "Qwen 3.8 27B", "Alibaba Cloud model on Groq LPUs (~450 tok/s)"),
    ("minimaxai/minimax-m2.7", "MiniMax M2.7", "Enterprise large context model (~260 tok/s)")
]

PERSONAS = {
    "cyberpunk": "You are a rogue cyberpunk AI netrunner named ZERO-X on a high-speed Groq neural link. Respond with edgy futuristic flair and technical depth.",
    "coder": "You are an elite Senior Staff Software Architect. Provide production-grade, optimized, elegant code with algorithmic complexity analysis.",
    "snarky": "You are a witty, mildly sarcastic terminal AI. You give helpful and correct answers while lightly poking fun at the user.",
    "eli5": "You are a friendly teacher who explains complex ideas in super simple terms using fun metaphors.",
    "default": "You are an ultra-fast, intelligent, and helpful AI assistant running on Groq LPUs inside a colorful terminal."
}

ASCII_BANNER = r"""
  ____ ____   ___   ___    _____ _____ ____  __  __ ___ _   _    _    _     
 / ___|  _ \ / _ \ / _ \  |_   _| ____|  _ \|  \/  |_ _| \ | |  / \  | |    
| |  _| |_) | | | | | | |   | | |  _| | |_) | |\/| || ||  \| | / _ \ | |    
| |_| |  _ <| |_| | |_| |   | | | |___|  _ <| |  | || || |\  |/ ___ \| |___ 
 \____|_| \_\\___/ \__\_\   |_| |_____|_| \_\_|  |_|___|_| \_/_/   \_\_____|
"""

class GroqTerminalChat:
    def __init__(self, model: str = "openai/gpt-oss-120b", api_key: str = None, persona: str = "default"):
        self.model = model
        self.api_key = api_key or os.environ.get("GROQ_API_KEY", "").strip()
        self.persona = persona
        self.system_prompt = PERSONAS.get(persona, PERSONAS["default"])
        self.history: List[Dict[str, str]] = []
        self.total_tokens = 0
        self.start_time = time.time()
        self.client = None

        if self.api_key and GROQ_AVAILABLE:
            try:
                self.client = Groq(api_key=self.api_key)
            except Exception:
                self.client = None

    def print_banner(self):
        console.clear()
        banner_text = Text(ASCII_BANNER, style="bold cyan")
        console.print(banner_text)
        
        status_color = "bold green" if self.client else "bold yellow"
        status_text = "● LIVE GROQ LPU ONLINE" if self.client else "● DEMO PREVIEW (No API Key set)"
        
        info_panel = Panel(
            f"[{status_color}]{status_text}[/{status_color}]  |  "
            f"[bold magenta]Model:[/bold magenta] {self.model}  |  "
            f"[bold yellow]Persona:[/bold yellow] {self.persona}\n"
            f"[dim]Type [bold white]/help[/bold white] for commands, [bold white]/key[/bold white] to set your Groq key, or [bold white]/exit[/bold white] to quit.[/dim]",
            title="[bold yellow]⚡ GROQ LPU INFERENCE ENGINE[/bold yellow]",
            border_style="cyan"
        )
        console.print(info_panel)
        console.print()

    def show_help(self):
        table = Table(title="⚡ Terminal Commands", border_style="cyan", show_header=True)
        table.add_column("Command", style="bold yellow", width=16)
        table.add_column("Description", style="white")

        commands = [
            ("/help", "Show this commands manual"),
            ("/models", "List supported Groq models & performance speeds"),
            ("/model <id>", "Switch current AI model (e.g. /model llama-3.1-8b-instant)"),
            ("/key <api_key>", "Set your Groq API key (starts with gsk_...)"),
            ("/persona <name>", "Select persona: cyberpunk, coder, snarky, eli5, default"),
            ("/system <prompt>", "Set custom system instructions"),
            ("/stats", "Display session token throughput and compute stats"),
            ("/clear", "Clear the terminal screen"),
            ("/exit or /quit", "Exit the terminal chatbot")
        ]
        for cmd, desc in commands:
            table.add_row(cmd, desc)
        console.print(table)
        console.print()

    def show_models(self):
        table = Table(title="🤖 Groq Accelerated Models", border_style="magenta", show_header=True)
        table.add_column("Model ID", style="bold cyan")
        table.add_column("Name", style="bold white")
        table.add_column("Specifications & Speed", style="dim white")

        for mid, name, desc in DEFAULT_MODELS:
            active_marker = " [bold green]★ ACTIVE[/bold green]" if mid == self.model else ""
            table.add_row(mid + active_marker, name, desc)
        console.print(table)
        console.print()

    def show_stats(self):
        uptime = round((time.time() - self.start_time) / 60, 1)
        mode = "[bold green]LIVE LPU[/bold green]" if self.client else "[bold yellow]DEMO SIMULATION[/bold yellow]"
        
        table = Table(title="📊 Telemetry & Token Counter", border_style="green")
        table.add_column("Metric", style="bold yellow")
        table.add_column("Value", style="bold white")
        
        table.add_row("Engine Status", mode)
        table.add_row("Current Model", self.model)
        table.add_row("Active Persona", self.persona)
        table.add_row("Session Tokens", str(self.total_tokens))
        table.add_row("Session Uptime", f"{uptime} minutes")
        table.add_row("API Key Configured", "Yes" if bool(self.api_key) else "No (Demo)")
        
        console.print(table)
        console.print()

    def set_key(self, key: str):
        key = key.strip()
        if not key:
            console.print("[bold red]API key cannot be empty.[/bold red]\n")
            return
        
        with console.status("[bold cyan]Authenticating with Groq LPU cluster...[/bold cyan]", spinner="dots"):
            try:
                test_client = Groq(api_key=key)
                models = test_client.models.list()
                self.api_key = key
                self.client = test_client
                console.print(f"[bold green]✔ Authentication successful! Connected to Groq ({len(models.data)} models available).[/bold green]\n")
            except Exception as e:
                console.print(f"[bold red]✖ Authentication failed: {e}[/bold red]\n")

    def execute_command(self, cmd_line: str) -> bool:
        parts = cmd_line.strip().split(maxsplit=1)
        cmd = parts[0].lower()
        arg = parts[1].strip() if len(parts) > 1 else ""

        if cmd in ("/exit", "/quit", "/q"):
            console.print("[bold yellow]⚡ Disconnecting from Groq Terminal. Goodbye![/bold yellow]")
            return False
        elif cmd in ("/help", "/h", "/?"):
            self.show_help()
        elif cmd == "/models":
            self.show_models()
        elif cmd == "/model":
            if arg:
                self.model = arg
                console.print(f"[bold green]Switched active model to:[/bold green] [bold cyan]{self.model}[/bold cyan]\n")
            else:
                console.print(f"[bold yellow]Current model:[/bold yellow] [bold cyan]{self.model}[/bold cyan]. Use: /model <id>\n")
        elif cmd == "/key":
            if arg:
                self.set_key(arg)
            else:
                key_input = Prompt.ask("[bold yellow]Enter Groq API Key (starts with gsk_)[/bold yellow]", password=True)
                if key_input:
                    self.set_key(key_input)
        elif cmd == "/persona":
            if arg in PERSONAS:
                self.persona = arg
                self.system_prompt = PERSONAS[arg]
                console.print(f"[bold green]Switched persona to:[/bold green] [bold yellow]{arg.upper()}[/bold yellow]\n")
            else:
                console.print(f"[bold yellow]Available personas:[/bold yellow] {', '.join(PERSONAS.keys())}\n")
        elif cmd == "/system":
            if arg:
                self.system_prompt = arg
                self.persona = "custom"
                console.print(f"[bold green]System prompt updated to:[/bold green] {arg}\n")
            else:
                console.print(f"[bold yellow]Current system prompt:[/bold yellow] {self.system_prompt}\n")
        elif cmd in ("/clear", "/cls"):
            self.print_banner()
        elif cmd == "/stats":
            self.show_stats()
        else:
            console.print(f"[bold red]Unknown command: {cmd}. Type /help for assistance.[/bold red]\n")
        return True

    def stream_chat(self, user_prompt: str):
        self.history.append({"role": "user", "content": user_prompt})
        messages = [{"role": "system", "content": self.system_prompt}] + self.history[-8:]

        console.print(f"[bold cyan]⚡ GROQ LPU[/bold cyan] [dim][{self.model}][/dim]:", style="bold cyan")

        if not self.client:
            # Simulated demo response
            demo_text = (
                f"### ⚡ Groq Terminal AI (Demo Mode)\n\n"
                f"You asked: **\"{user_prompt}\"**\n\n"
                f"This terminal is running in **Demo Simulation Mode**.\n\n"
                f"To unlock real-time live generation on Groq's Tensor Streaming LPUs (~800 tok/s):\n"
                f"1. Grab your free key at **https://console.groq.com/keys**\n"
                f"2. Enter command: `/key <your_groq_api_key>` or set `export GROQ_API_KEY=gsk_...`\n\n"
                f"```bash\n# Example command:\n/model llama-3.1-8b-instant\n```\n"
            )
            words = demo_text.split(" ")
            accumulated = ""
            start = time.time()
            with Live(console=console, refresh_per_second=20) as live:
                for i, w in enumerate(words):
                    chunk = w if i == 0 else " " + w
                    accumulated += chunk
                    self.total_tokens += 1
                    time.sleep(0.015)
                    live.update(Markdown(accumulated))
            
            elapsed = time.time() - start
            speed = round(len(words) / elapsed, 1)
            console.print(f"[dim]⚡ [yellow]{speed} tok/s[/yellow] • {len(words)} tokens • {round(elapsed, 2)}s • [yellow]DEMO[/yellow][/dim]\n")
            self.history.append({"role": "assistant", "content": demo_text})
            return

        # Live inference
        accumulated = ""
        start = time.time()
        first_token = None
        token_count = 0

        try:
            stream = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                stream=True,
                temperature=0.7
            )

            with Live(console=console, refresh_per_second=24) as live:
                for chunk in stream:
                    if chunk.choices and len(chunk.choices) > 0:
                        content = chunk.choices[0].delta.content or ""
                        if content:
                            if first_token is None:
                                first_token = time.time()
                            accumulated += content
                            token_count += 1
                            self.total_tokens += 1
                            live.update(Markdown(accumulated))

            elapsed = time.time() - start
            ttft = round((first_token - start) * 1000, 1) if first_token else 0
            speed = round(token_count / (elapsed - (ttft / 1000)), 1) if (elapsed - (ttft / 1000)) > 0 else 0

            console.print(
                f"[dim]⚡ [bold yellow]{speed} tok/s[/bold yellow] • "
                f"[bold cyan]{token_count} tokens[/bold cyan] • "
                f"TTFT: [bold magenta]{ttft}ms[/bold magenta] • "
                f"{round(elapsed, 2)}s[/dim]\n"
            )
            self.history.append({"role": "assistant", "content": accumulated})

        except KeyboardInterrupt:
            console.print("\n[yellow][Interrupted by user][/yellow]\n")
        except AuthenticationError:
            console.print("\n[bold red]✖ Groq API Authentication Error: Invalid or expired key. Use /key to set a new key.[/bold red]\n")
        except APIError as e:
            console.print(f"\n[bold red]✖ Groq API Error: {e}[/bold red]\n")
        except Exception as e:
            console.print(f"\n[bold red]✖ Error: {e}[/bold red]\n")

    def run(self):
        self.print_banner()

        while True:
            try:
                prompt_prefix = f"[bold cyan]⚡ groq[/bold cyan] [dim][{self.model.split('-')[0]}][/dim] [bold green]❯[/bold green] "
                user_input = console.input(prompt_prefix).strip()

                if not user_input:
                    continue

                if user_input.startswith("/"):
                    continue_loop = self.execute_command(user_input)
                    if not continue_loop:
                        break
                else:
                    self.stream_chat(user_input)

            except (KeyboardInterrupt, EOFError):
                console.print("\n[bold yellow]⚡ Session terminated. Have a great day![/bold yellow]")
                break

def main():
    parser = argparse.ArgumentParser(description="Groq Terminal AI Chatbot")
    parser.add_argument("--model", "-m", default="llama-3.3-70b-versatile", help="Groq model ID")
    parser.add_argument("--persona", "-p", default="default", help="Persona: cyberpunk, coder, snarky, eli5, default")
    parser.add_argument("--key", "-k", default=None, help="Groq API Key")
    parser.add_argument("query", nargs="*", help="Optional single prompt to execute immediately")

    args = parser.parse_args()

    app = GroqTerminalChat(model=args.model, api_key=args.key, persona=args.persona)

    if args.query:
        query_text = " ".join(args.query)
        app.stream_chat(query_text)
    else:
        app.run()

if __name__ == "__main__":
    main()
