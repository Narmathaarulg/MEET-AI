import React, { useState, useRef } from 'react';
import { Upload, Mic, MicOff, Download, Play, Pause, FileText, Globe, Sparkles, Zap, Volume2 } from 'lucide-react';

const App = () => {
  const [activeTab, setActiveTab] = useState('record');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [transcriptText, setTranscriptText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [summaryText, setSummaryText] = useState('');
  const [targetLang, setTargetLang] = useState('en');
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);

  const API_BASE_URL = 'http://127.0.0.1:5000';

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'ta', name: 'Tamil', flag: '🇮🇳' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷' }
  ];

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        setAudioUrl(URL.createObjectURL(audioBlob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Error accessing microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setAudioBlob(file);
      setAudioUrl(URL.createObjectURL(file));
    }
  };

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const processAudio = async () => {
    if (!audioBlob) {
      alert('No audio available to transcribe!');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.wav');
    formData.append('target_lang', targetLang);

    try {
      const response = await fetch(`${API_BASE_URL}/api/process_all`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setTranscriptText(data.transcript);
        setTranslatedText(data.translated_text);
        setSummaryText(data.summary);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error processing audio. Make sure the Flask server is running on http://127.0.0.1:5000');
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = async () => {
    if (!transcriptText) {
      alert('No transcript available to download!');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/download_report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: transcriptText,
          translated_text: translatedText,
          summary: summaryText,
          target_lang: targetLang
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'meeting_summary.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        alert('Error downloading report');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error downloading report');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-10 left-10 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute top-10 right-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-4000"></div>
      </div>

      {/* Floating Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 animate-bounce">
          <Sparkles className="w-6 h-6 text-yellow-300 opacity-60" />
        </div>
        <div className="absolute top-1/3 right-1/3 animate-bounce animation-delay-1000">
          <Zap className="w-5 h-5 text-blue-300 opacity-60" />
        </div>
        <div className="absolute bottom-1/4 right-1/4 animate-bounce animation-delay-2000">
          <Volume2 className="w-6 h-6 text-purple-300 opacity-60" />
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-extrabold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-4 drop-shadow-2xl">
            🎙️ AI Voice Lab
          </h1>
          <p className="text-xl text-gray-300 font-light tracking-wide">
            Multilingual Transcription & Intelligent Summarization
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 shadow-2xl overflow-hidden mb-8">
          {/* Tabs */}
          <div className="flex relative">
            <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-cyan-400 to-purple-500 transition-all duration-500" 
                 style={{ width: '50%', transform: `translateX(${activeTab === 'upload' ? '100%' : '0%'})` }}></div>
            
            <button
              className={`flex-1 py-6 px-8 text-center font-semibold text-lg transition-all duration-300 ${
                activeTab === 'record'
                  ? 'text-white bg-gradient-to-r from-purple-500/20 to-pink-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
              onClick={() => setActiveTab('record')}
            >
              <Mic className="inline-block mr-3 w-6 h-6" />
              Record Audio
            </button>
            <button
              className={`flex-1 py-6 px-8 text-center font-semibold text-lg transition-all duration-300 ${
                activeTab === 'upload'
                  ? 'text-white bg-gradient-to-r from-purple-500/20 to-pink-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
              onClick={() => setActiveTab('upload')}
            >
              <Upload className="inline-block mr-3 w-6 h-6" />
              Upload Audio
            </button>
          </div>

          <div className="p-8">
            {/* Record Audio Tab */}
            {activeTab === 'record' && (
              <div className="text-center space-y-8">
                <div className="relative">
                  <button
                    className={`relative px-12 py-6 rounded-full font-bold text-lg text-white transition-all duration-500 transform hover:scale-105 ${
                      isRecording
                        ? 'bg-gradient-to-r from-red-500 to-pink-600 shadow-lg shadow-red-500/50 animate-pulse'
                        : 'bg-gradient-to-r from-blue-500 to-purple-600 shadow-lg shadow-blue-500/50 hover:shadow-xl'
                    }`}
                    onClick={isRecording ? stopRecording : startRecording}
                  >
                    <div className="flex items-center justify-center space-x-3">
                      {isRecording ? (
                        <>
                          <MicOff className="w-6 h-6" />
                          <span>Stop Recording</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-6 h-6" />
                          <span>Start Recording</span>
                        </>
                      )}
                    </div>
                    {isRecording && (
                      <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-pink-600 rounded-full blur opacity-75 animate-pulse"></div>
                    )}
                  </button>
                </div>
                
                {audioUrl && (
                  <div className="bg-white/5 rounded-2xl p-6 backdrop-blur-sm border border-white/10">
                    <div className="flex items-center justify-center space-x-6 mb-6">
                      <button
                        className="p-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full hover:scale-110 transition-transform shadow-lg shadow-green-500/30"
                        onClick={togglePlayback}
                      >
                        {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                      </button>
                      <span className="text-white font-medium">Click to play your recording</span>
                    </div>
                    <audio
                      ref={audioRef}
                      src={audioUrl}
                      controls
                      className="w-full max-w-md mx-auto rounded-lg"
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => setIsPlaying(false)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Upload Audio Tab */}
            {activeTab === 'upload' && (
              <div className="space-y-8">
                <div 
                  className="border-2 border-dashed border-purple-400/50 rounded-3xl p-12 text-center cursor-pointer transition-all duration-300 hover:border-purple-400 hover:bg-white/5 group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="space-y-4">
                    <div className="mx-auto w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Upload className="w-10 h-10 text-white" />
                    </div>
                    <div>
                      <p className="text-xl text-white font-medium mb-2">Drop your audio file here</p>
                      <p className="text-gray-400">or click to browse</p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                </div>
                
                {audioUrl && (
                  <div className="bg-white/5 rounded-2xl p-6 backdrop-blur-sm border border-white/10">
                    <audio
                      src={audioUrl}
                      controls
                      className="w-full max-w-md mx-auto rounded-lg"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 shadow-2xl p-8 mb-8">
          <div className="flex flex-col lg:flex-row items-center justify-center gap-6">
            <div className="relative">
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="appearance-none bg-white/10 border border-white/30 text-white px-6 py-4 pr-12 rounded-2xl focus:ring-4 focus:ring-purple-500/50 focus:border-purple-400 backdrop-blur-sm font-medium min-w-48"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code} className="bg-gray-800 text-white">
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
              <Globe className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-300 pointer-events-none" />
            </div>
            
            <button
              className="px-10 py-4 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-bold rounded-2xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-300 flex items-center space-x-3 shadow-lg shadow-emerald-500/30"
              onClick={processAudio}
              disabled={loading || !audioBlob}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  <span>Processing Magic...</span>
                </>
              ) : (
                <>
                  <FileText className="w-6 h-6" />
                  <span>Transform Audio</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results */}
        {transcriptText && (
          <div className="space-y-8 animate-fade-in">
            {/* Transcript */}
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 shadow-2xl p-8 hover:bg-white/15 transition-all duration-300">
              <div className="flex items-center space-x-4 mb-6">
                <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl">
                  <FileText className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-white">Original Transcript</h2>
              </div>
              <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                <p className="text-gray-200 leading-relaxed text-lg">{transcriptText}</p>
              </div>
            </div>

            {/* Translation */}
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 shadow-2xl p-8 hover:bg-white/15 transition-all duration-300">
              <div className="flex items-center space-x-4 mb-6">
                <div className="p-3 bg-gradient-to-r from-pink-500 to-rose-600 rounded-2xl">
                  <Globe className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-white">
                  Translated ({languages.find(l => l.code === targetLang)?.flag} {languages.find(l => l.code === targetLang)?.name})
                </h2>
              </div>
              <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                <p className="text-gray-200 leading-relaxed text-lg">{translatedText}</p>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 shadow-2xl p-8 hover:bg-white/15 transition-all duration-300">
              <div className="flex items-center space-x-4 mb-6">
                <div className="p-3 bg-gradient-to-r from-emerald-500 to-cyan-600 rounded-2xl">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-white">AI Summary</h2>
              </div>
              <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                <p className="text-gray-200 leading-relaxed text-lg">{summaryText}</p>
              </div>
            </div>

            {/* Download Button */}
            <div className="text-center">
              <button
                className="px-10 py-4 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold rounded-2xl hover:scale-105 transition-all duration-300 flex items-center space-x-3 mx-auto shadow-lg shadow-violet-500/30"
                onClick={downloadReport}
              >
                <Download className="w-6 h-6" />
                <span>Download Complete Report</span>
              </button>
            </div>
          </div>
        )}
      </div>


    </div>
  );
};

export default App;