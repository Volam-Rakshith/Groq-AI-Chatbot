#!/usr/bin/env python3
"""
⚡ VR DEVELOPMENTS // GROQ TERMINAL AI
Universal Dev Server & Groq Proxy (Supports direct static hosting + Iframe proxying)
"""

import os
import json
import time
import requests
from flask import Flask, request, Response, jsonify, send_from_directory

app = Flask(__name__, static_folder='.', static_url_path='')

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, x-groq-key'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    return response

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/style.css')
def css():
    return send_from_directory('.', 'style.css', mimetype='text/css')

@app.route('/app.js')
def js():
    return send_from_directory('.', 'app.js', mimetype='application/javascript')

@app.route('/api/status', methods=['GET'])
def get_status():
    env_key = os.environ.get('GROQ_API_KEY', '').strip()
    return jsonify({
        "status": "online",
        "has_env_key": bool(env_key),
        "default_model": "openai/gpt-oss-120b",
        "brand": "VR DEVELOPMENTS"
    })

@app.route('/api/models', methods=['GET'])
def get_models():
    api_key = request.headers.get('Authorization', '').replace('Bearer ', '').strip()
    if not api_key:
        api_key = os.environ.get('GROQ_API_KEY', '').strip()

    if api_key:
        try:
            r = requests.get(
                'https://api.groq.com/openai/v1/models',
                headers={'Authorization': f'Bearer {api_key}'},
                timeout=10
            )
            return jsonify(r.json()), r.status_code
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    return jsonify({"error": "No API key provided"}), 400

@app.route('/api/chat', methods=['POST', 'OPTIONS'])
def proxy_chat():
    if request.method == 'OPTIONS':
        return '', 204

    data = request.get_json(silent=True) or {}
    api_key = request.headers.get('Authorization', '').replace('Bearer ', '').strip()
    if not api_key:
        api_key = data.get('api_key', '').strip()
    if not api_key:
        api_key = os.environ.get('GROQ_API_KEY', '').strip()

    if not api_key:
        return jsonify({"error": {"message": "No Groq API Key provided. Set via /key <gsk_...>"}}), 401

    model = data.get('model', 'openai/gpt-oss-120b')
    messages = data.get('messages', [])
    temperature = float(data.get('temperature', 0.7))

    # Clean retired model names if received
    if 'llama' in model:
        model = 'openai/gpt-oss-120b'

    groq_payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "temperature": temperature
    }

    try:
        groq_resp = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            },
            json=groq_payload,
            stream=True,
            timeout=30
        )

        if not groq_resp.ok:
            try:
                err_data = groq_resp.json()
            except Exception:
                err_data = {"error": {"message": f"Groq HTTP {groq_resp.status_code}"}}
            return jsonify(err_data), groq_resp.status_code

        def generate():
            for chunk in groq_resp.iter_lines():
                if chunk:
                    line = chunk.decode('utf-8')
                    yield f"{line}\n\n"

        return Response(generate(), mimetype='text/event-stream')

    except Exception as e:
        return jsonify({"error": {"message": f"Proxy error: {str(e)}"}}), 500

@app.route('/<path:path>')
def static_proxy(path):
    return send_from_directory('.', path)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"⚡ VR DEVELOPMENTS Groq Terminal Server on http://0.0.0.0:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
