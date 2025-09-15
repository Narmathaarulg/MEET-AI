import os
import sys
import datetime
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from transformers import pipeline
from deep_translator import GoogleTranslator
import tempfile
import io

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# ----------------- Load models -----------------
asr = None
summarizer = None

def load_asr_model():
    global asr
    if asr is None:
        asr = pipeline("automatic-speech-recognition", model="openai/whisper-tiny", device=-1)  # CPU
    return asr

def load_summarizer():
    global summarizer
    if summarizer is None:
        summarizer = pipeline("summarization", model="facebook/bart-large-cnn", device=-1)
    return summarizer

# Initialize models on startup
load_asr_model()
load_summarizer()

# ----------------- Helper Functions -----------------
def save_audio_file(audio_bytes, file_extension):
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    file_name = f"audio_{timestamp}.{file_extension}"
    with open(file_name, "wb") as f:
        f.write(audio_bytes)
    return file_name

def transcribe_audio(file_path):
    try:
        result = asr(file_path)
        text = result["text"].strip()
        return text if text else "No speech detected."
    except Exception as e:
        return f"Error during transcription: {e}"

def translate_text(text, target_lang):
    try:
        return GoogleTranslator(source="auto", target=target_lang).translate(text)
    except Exception as e:
        return f"Translation error: {e}"

def summarize_text(text):
    try:
        summary = summarizer(text, max_length=100, min_length=25, do_sample=False)
        return summary[0]['summary_text']
    except Exception as e:
        return f"Summarization error: {e}"

# ----------------- Routes -----------------
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'Flask server is running!', 'success': True})

@app.route('/api/transcribe', methods=['POST'])
def transcribe():
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        if audio_file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Get file extension
        file_extension = audio_file.filename.split('.')[-1] if '.' in audio_file.filename else 'wav'
        
        # Save audio file temporarily
        audio_bytes = audio_file.read()
        audio_file_path = save_audio_file(audio_bytes, file_extension)
        
        # Transcribe
        transcript_text = transcribe_audio(audio_file_path)
        
        # Clean up temporary file
        if os.path.exists(audio_file_path):
            os.remove(audio_file_path)
        
        return jsonify({
            'transcript': transcript_text,
            'success': True
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/translate', methods=['POST'])
def translate():
    try:
        data = request.get_json()
        text = data.get('text', '')
        target_lang = data.get('target_lang', 'en')
        
        if not text:
            return jsonify({'error': 'No text provided'}), 400
        
        translated_text = translate_text(text, target_lang)
        
        return jsonify({
            'translated_text': translated_text,
            'target_lang': target_lang,
            'success': True
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/summarize', methods=['POST'])
def summarize():
    try:
        data = request.get_json()
        text = data.get('text', '')
        
        if not text:
            return jsonify({'error': 'No text provided'}), 400
        
        summary_text = summarize_text(text)
        
        return jsonify({
            'summary': summary_text,
            'success': True
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/process_all', methods=['POST'])
def process_all():
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        target_lang = request.form.get('target_lang', 'en')
        
        if audio_file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Get file extension
        file_extension = audio_file.filename.split('.')[-1] if '.' in audio_file.filename else 'wav'
        
        # Save audio file temporarily
        audio_bytes = audio_file.read()
        audio_file_path = save_audio_file(audio_bytes, file_extension)
        
        # Transcribe
        transcript_text = transcribe_audio(audio_file_path)
        
        # Translate
        translated_text = translate_text(transcript_text, target_lang)
        
        # Summarize
        summary_text = summarize_text(transcript_text)
        
        # Clean up temporary file
        if os.path.exists(audio_file_path):
            os.remove(audio_file_path)
        
        return jsonify({
            'transcript': transcript_text,
            'translated_text': translated_text,
            'summary': summary_text,
            'target_lang': target_lang,
            'success': True
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/download_report', methods=['POST'])
def download_report():
    try:
        data = request.get_json()
        transcript = data.get('transcript', '')
        translated_text = data.get('translated_text', '')
        summary = data.get('summary', '')
        target_lang = data.get('target_lang', 'en')
        
        export_text = f"Transcript:\n{transcript}\n\nTranslated ({target_lang}):\n{translated_text}\n\nSummary:\n{summary}"
        
        # Create temporary file
        temp_file = tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt')
        temp_file.write(export_text)
        temp_file.close()
        
        return send_file(
            temp_file.name,
            as_attachment=True,
            download_name='meeting_summary.txt',
            mimetype='text/plain'
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == "__main__":
    working_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.append(working_dir)
    app.run(debug=True, host='0.0.0.0', port=5000)