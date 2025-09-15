import os
import sys
import datetime
from flask import Flask, request, jsonify, send_file, after_this_request
from flask_cors import CORS
from transformers import pipeline
from deep_translator import GoogleTranslator
import tempfile
import io
import warnings
warnings.filterwarnings("ignore", category=FutureWarning)

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# ----------------- Load models -----------------
asr = None
summarizer = None

def load_asr_model():
    global asr
    if asr is None:
        # Using a better model for more accurate transcription
        # You can also try "openai/whisper-base" or "openai/whisper-small" for better accuracy
        asr = pipeline(
            "automatic-speech-recognition", 
            model="openai/whisper-small",  # Changed from tiny to small for better accuracy
            device=-1,  # CPU
            chunk_length_s=30,  # Process in 30-second chunks
            stride_length_s=5,  # 5-second overlap between chunks
        )
    return asr

def load_summarizer():
    global summarizer
    if summarizer is None:
        summarizer = pipeline("summarization", model="facebook/bart-large-cnn", device=-1)
    return summarizer

# Initialize models on startup
print("Loading ASR model... This may take a moment on first run.")
load_asr_model()
print("Loading summarizer model...")
load_summarizer()
print("All models loaded successfully!")

# ----------------- Helper Functions -----------------
def save_audio_file(audio_bytes, file_extension):
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    file_name = f"audio_{timestamp}.{file_extension}"
    with open(file_name, "wb") as f:
        f.write(audio_bytes)
    return file_name

def transcribe_audio(file_path, language="en"):
    try:
        # Enhanced transcription with better parameters
        result = asr(
            file_path,
            return_timestamps=True,  # Get timestamps for better accuracy
            generate_kwargs={
                "language": language if language != "auto" else None,
                "task": "transcribe",
                "temperature": 0.0,  # Lower temperature for more consistent results
                "no_speech_threshold": 0.6,  # Adjust silence detection
                "logprob_threshold": -1.0,  # Filter low-confidence predictions
                "compression_ratio_threshold": 2.4,  # Filter repetitive text
                "condition_on_previous_text": True,  # Use context from previous segments
            }
        )
        
        # Extract text from result
        if isinstance(result, dict):
            text = result.get("text", "").strip()
        else:
            text = str(result).strip()
            
        # Post-process the text to fix common errors
        text = post_process_transcript(text)
        
        return text if text else "No speech detected."
    except Exception as e:
        print(f"Transcription error: {e}")
        return f"Error during transcription: {e}"

def post_process_transcript(text):
    """Post-process the transcript to fix common ASR errors"""
    # Dictionary of common misrecognitions and their corrections
    corrections = {
        "subdate": "update",
        "sub date": "update", 
        "sub-date": "update",
        "updater": "update",
        "up date": "update",
        "what's subdate": "what's the update",
        "whats subdate": "what's the update",
        "the subdate": "the update",
        "an update": "the update",
        # Add more common corrections as needed
        "there": "their",  # Context-dependent, but common error
        "your": "you're",  # Context-dependent
        "its": "it's",     # Context-dependent
    }
    
    # Apply corrections (case-insensitive)
    corrected_text = text
    for wrong, correct in corrections.items():
        corrected_text = corrected_text.replace(wrong.lower(), correct.lower())
        corrected_text = corrected_text.replace(wrong.capitalize(), correct.capitalize())
        corrected_text = corrected_text.replace(wrong.upper(), correct.upper())
    
    return corrected_text

def translate_text(text, target_lang):
    try:
        return GoogleTranslator(source="auto", target=target_lang).translate(text)
    except Exception as e:
        return f"Translation error: {e}"

def summarize_text(text):
    try:
        # Only summarize if text is long enough
        if len(text.split()) < 20:
            return f"Text summary: {text}"  # Return original if too short
            
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
        
        # Get language parameter (optional)
        language = request.form.get('language', 'en')
        
        # Get file extension
        file_extension = audio_file.filename.split('.')[-1] if '.' in audio_file.filename else 'wav'
        
        # Save audio file temporarily
        audio_bytes = audio_file.read()
        audio_file_path = save_audio_file(audio_bytes, file_extension)
        
        # Transcribe with language specification
        transcript_text = transcribe_audio(audio_file_path, language)
        
        # Clean up temporary file
        if os.path.exists(audio_file_path):
            os.remove(audio_file_path)
        
        return jsonify({
            'transcript': transcript_text,
            'language_used': language,
            'success': True
        })
        
    except Exception as e:
        print(f"Error in transcribe endpoint: {e}")
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
        source_lang = request.form.get('source_lang', 'en')  # Language of the audio
        
        if audio_file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Get file extension
        file_extension = audio_file.filename.split('.')[-1] if '.' in audio_file.filename else 'wav'
        
        # Save audio file temporarily
        audio_bytes = audio_file.read()
        audio_file_path = save_audio_file(audio_bytes, file_extension)
        
        print(f"Processing audio file: {audio_file_path}")
        print(f"Source language: {source_lang}, Target language: {target_lang}")
        
        # Transcribe with source language specification
        transcript_text = transcribe_audio(audio_file_path, source_lang)
        print(f"Transcription result: {transcript_text}")
        
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
            'source_lang': source_lang,
            'target_lang': target_lang,
            'success': True
        })
        
    except Exception as e:
        print(f"Error in process_all: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/download_report', methods=['POST'])
def download_report():
    try:
        data = request.get_json()
        transcript = data.get('transcript', '')
        translated_text = data.get('translated_text', '')
        summary = data.get('summary', '')
        target_lang = data.get('target_lang', 'en')
        source_lang = data.get('source_lang', 'en')
        
        # Create the report content
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        export_text = f"""AI Voice Lab - Meeting Summary Report
Generated on: {timestamp}

{'='*60}
ORIGINAL TRANSCRIPT ({source_lang.upper()})
{'='*60}
{transcript}

{'='*60}
TRANSLATION ({target_lang.upper()})
{'='*60}
{translated_text}

{'='*60}
AI SUMMARY
{'='*60}
{summary}

{'='*60}
Report generated by AI Voice Lab
Transcription Quality: Enhanced with Whisper-Small model
Post-processing: Applied common error corrections
{'='*60}
"""
        
        # Create a BytesIO object to hold the file content
        file_buffer = io.BytesIO()
        file_buffer.write(export_text.encode('utf-8'))
        file_buffer.seek(0)
        
        # Generate filename with timestamp
        filename = f"meeting_summary_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        
        return send_file(
            file_buffer,
            as_attachment=True,
            download_name=filename,
            mimetype='text/plain'
        )
        
    except Exception as e:
        print(f"Error in download_report: {str(e)}")  # Debug logging
        return jsonify({'error': f'Error generating report: {str(e)}'}), 500

if __name__ == "__main__":
    working_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.append(working_dir)
    print("\n🎙️ AI Voice Lab Server Starting...")
    print("📝 Enhanced with better transcription accuracy!")
    print("🔧 Using Whisper-Small model with post-processing")
    print("🌐 Server will be available at: http://127.0.0.1:5000")
    print("="*60)
    app.run(debug=True, host='0.0.0.0', port=5000)