document.addEventListener('DOMContentLoaded', () => {
  
  // State variables
  let mediaRecorder = null;
  let audioChunks = [];
  let recordedBlob = null;
  let audioContext = null;
  let analyserNode = null;
  let visualizerAnimId = null;
  let timerInterval = null;
  let recordStartTime = 0;

  let selectedUploadFile = null;

  // DOM Elements
  const modelStatusDot = document.getElementById('model-status-dot');
  const modelStatusText = document.getElementById('model-status-text');
  const statSpeciesCount = document.getElementById('stat-species-count');
  const statSamplesCount = document.getElementById('stat-samples-count');
  const categoriesBadgesContainer = document.getElementById('categories-badges');

  // Tabs
  const tabMicBtn = document.getElementById('tab-mic-btn');
  const tabFileBtn = document.getElementById('tab-file-btn');
  const tabMicContent = document.getElementById('tab-mic-content');
  const tabFileContent = document.getElementById('tab-file-content');

  // Mic elements
  const micIdleState = document.getElementById('mic-idle-state');
  const visualizerCanvas = document.getElementById('visualizer-canvas');
  const recTimer = document.getElementById('rec-timer');
  const recordStartBtn = document.getElementById('record-start-btn');
  const recordStopBtn = document.getElementById('record-stop-btn');
  const micPreviewContainer = document.getElementById('mic-preview-container');
  const micAudioPlayer = document.getElementById('mic-audio-player');
  const classifyMicBtn = document.getElementById('classify-mic-btn');

  // File upload elements
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const filePreviewContainer = document.getElementById('file-preview-container');
  const selectedFilename = document.getElementById('selected-filename');
  const selectedFilesize = document.getElementById('selected-filesize');
  const fileAudioPlayer = document.getElementById('file-audio-player');
  const classifyFileBtn = document.getElementById('classify-file-btn');

  // Results elements
  const topMatchCategoryBadge = document.getElementById('top-match-category-badge');
  const topMatchSpecies = document.getElementById('top-match-species');
  const topMatchBadge = document.getElementById('top-match-badge');
  const topMatchSub = document.getElementById('top-match-sub');
  const similarityList = document.getElementById('similarity-list');

  // Control buttons
  const trainModelBtn = document.getElementById('train-model-btn');
  const generateSamplesBtn = document.getElementById('generate-samples-btn');
  const toastContainer = document.getElementById('toast-container');

  // Initial Load
  fetchModelStatus();

  // Tab Switcher
  tabMicBtn.addEventListener('click', () => {
    tabMicBtn.className = 'flex-1 text-center py-2 font-semibold text-emerald-400 border-b-2 border-emerald-400 transition-colors flex items-center justify-center space-x-2';
    tabFileBtn.className = 'flex-1 text-center py-2 font-semibold text-slate-400 hover:text-slate-200 border-b-2 border-transparent transition-colors flex items-center justify-center space-x-2';
    tabMicContent.classList.remove('hidden');
    tabFileContent.classList.add('hidden');
  });

  tabFileBtn.addEventListener('click', () => {
    tabFileBtn.className = 'flex-1 text-center py-2 font-semibold text-emerald-400 border-b-2 border-emerald-400 transition-colors flex items-center justify-center space-x-2';
    tabMicBtn.className = 'flex-1 text-center py-2 font-semibold text-slate-400 hover:text-slate-200 border-b-2 border-transparent transition-colors flex items-center justify-center space-x-2';
    tabFileContent.classList.remove('hidden');
    tabMicContent.classList.add('hidden');
  });

  // Model Status Fetch
  async function fetchModelStatus() {
    try {
      const response = await fetch('/api/status');
      if (!response.ok) throw new Error('Status check failed');
      const data = await response.json();
      updateModelStatusUI(data);
    } catch (err) {
      try {
        const res = await fetch('/', { headers: { 'Accept': 'application/json' } });
        const data = await res.json();
        updateModelStatusUI(data);
      } catch (e) {
        modelStatusDot.className = 'w-3 h-3 rounded-full bg-rose-500';
        modelStatusText.textContent = 'Server Offline';
      }
    }
  }

  function updateModelStatusUI(data) {
    if (data.is_trained) {
      modelStatusDot.className = 'w-3 h-3 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400';
      modelStatusText.textContent = `Model Trained (${data.species_count || 0} profiles)`;
    } else {
      modelStatusDot.className = 'w-3 h-3 rounded-full bg-amber-400 animate-pulse';
      modelStatusText.textContent = 'Model Untrained';
    }

    statSpeciesCount.textContent = data.species_count || 0;
    statSamplesCount.textContent = data.sample_count || 0;

    // Categories Badges
    const categories = data.categories || [];
    if (categories.length > 0) {
      categoriesBadgesContainer.innerHTML = categories.map(cat => `
        <span class="bg-teal-950/80 text-teal-300 text-[11px] font-semibold px-2.5 py-1 rounded-md border border-teal-500/20">
          📁 ${cat}
        </span>
      `).join('');
    } else {
      categoriesBadgesContainer.innerHTML = '<span class="text-xs text-slate-500">None trained yet</span>';
    }
  }

  // Microphone Recording Logic
  recordStartBtn.addEventListener('click', async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream);

      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 256;
      source.connect(analyserNode);

      visualizerCanvas.classList.remove('hidden');
      micIdleState.classList.add('hidden');
      recTimer.classList.remove('hidden');
      drawWaveform();

      recordStartTime = Date.now();
      timerInterval = setInterval(updateTimer, 1000);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        clearInterval(timerInterval);
        cancelAnimationFrame(visualizerAnimId);
        visualizerCanvas.classList.add('hidden');
        recTimer.classList.add('hidden');
        micIdleState.classList.remove('hidden');
        
        stream.getTracks().forEach(track => track.stop());

        recordedBlob = new Blob(audioChunks, { type: 'audio/wav' });
        micAudioPlayer.src = URL.createObjectURL(recordedBlob);
        micPreviewContainer.classList.remove('hidden');
        showToast('Audio recorded successfully!', 'success');
      };

      mediaRecorder.start();
      recordStartBtn.classList.add('hidden');
      recordStopBtn.classList.remove('hidden');
      micPreviewContainer.classList.add('hidden');

    } catch (err) {
      showToast(`Microphone access error: ${err.message}`, 'error');
    }
  });

  recordStopBtn.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      recordStartBtn.classList.remove('hidden');
      recordStopBtn.classList.add('hidden');
    }
  });

  function updateTimer() {
    const elapsedSec = Math.floor((Date.now() - recordStartTime) / 1000);
    const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
    const secs = String(elapsedSec % 60).padStart(2, '0');
    recTimer.textContent = `${mins}:${secs}`;
  }

  function drawWaveform() {
    const canvasCtx = visualizerCanvas.getContext('2d');
    const width = visualizerCanvas.width = visualizerCanvas.offsetWidth;
    const height = visualizerCanvas.height = visualizerCanvas.offsetHeight;
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function render() {
      visualizerAnimId = requestAnimationFrame(render);
      analyserNode.getByteFrequencyData(dataArray);

      canvasCtx.fillStyle = '#0f172a';
      canvasCtx.fillRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * height;

        const gradient = canvasCtx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, '#059669');
        gradient.addColorStop(1, '#34d399');

        canvasCtx.fillStyle = gradient;
        canvasCtx.fillRect(x, height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    }
    render();
  }

  // File Upload Logic
  dropzone.addEventListener('click', () => fileInput.click());

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('dropzone-active');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dropzone-active');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt.files.length > 0) handleSelectedFile(dt.files[0]);
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleSelectedFile(e.target.files[0]);
  });

  function handleSelectedFile(file) {
    selectedUploadFile = file;
    selectedFilename.textContent = file.name;
    selectedFilesize.textContent = formatBytes(file.size);
    fileAudioPlayer.src = URL.createObjectURL(file);
    filePreviewContainer.classList.remove('hidden');
    showToast(`Loaded file '${file.name}'`, 'info');
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Classification Execution
  classifyMicBtn.addEventListener('click', () => {
    if (!recordedBlob) {
      showToast('No audio recording found!', 'error');
      return;
    }
    const formData = new FormData();
    formData.append('file', recordedBlob, 'mic_recording.wav');
    performClassification(formData, classifyMicBtn);
  });

  classifyFileBtn.addEventListener('click', () => {
    if (!selectedUploadFile) {
      showToast('Please select an audio file first!', 'error');
      return;
    }
    const formData = new FormData();
    formData.append('file', selectedUploadFile);
    performClassification(formData, classifyFileBtn);
  });

  async function performClassification(formData, btnElement) {
    const originalText = btnElement.innerHTML;
    btnElement.disabled = true;
    btnElement.innerHTML = `
      <svg class="animate-spin h-5 w-5 text-slate-950" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>Extracting Bioacoustic Features...</span>
    `;

    try {
      const response = await fetch('/classify', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Classification failed');
      }

      const result = await response.json();
      renderClassificationResults(result);
      showToast('Classification complete!', 'success');

    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      btnElement.disabled = false;
      btnElement.innerHTML = originalText;
    }
  }

  function renderClassificationResults(data) {
    const topMatch = data.top_match;
    const allMatches = data.all_matches || [];

    if (topMatch) {
      topMatchCategoryBadge.textContent = topMatch.category || 'Category';
      topMatchSpecies.textContent = topMatch.species;
      topMatchBadge.textContent = topMatch.similarity_score;
      topMatchSub.textContent = `Match Confidence: ${topMatch.similarity_score} in category '${topMatch.category}'`;
    }

    if (allMatches.length > 0) {
      similarityList.innerHTML = allMatches.map(m => {
        const percentageNum = parseFloat(m.similarity.replace('%', '')) || 0;
        const colorClass = percentageNum > 70 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' :
                           percentageNum > 40 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' :
                           'bg-gradient-to-r from-slate-600 to-slate-500';

        return `
          <div class="space-y-1.5 bg-slate-950/40 p-3 rounded-xl border border-slate-800">
            <div class="flex justify-between text-xs font-semibold items-center">
              <div class="flex items-center space-x-2 truncate">
                <span class="text-xs text-teal-400 bg-teal-950/80 border border-teal-500/20 px-1.5 py-0.5 rounded font-mono">${m.category}</span>
                <span class="text-slate-200 truncate">${m.species}</span>
              </div>
              <span class="text-emerald-400 font-mono pl-2">${m.similarity}</span>
            </div>
            <div class="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div class="${colorClass} h-2.5 rounded-full transition-all duration-700 ease-out" style="width: ${Math.min(100, Math.max(2, percentageNum))}%"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Model Training Logic
  trainModelBtn.addEventListener('click', async () => {
    trainModelBtn.disabled = true;
    const origHtml = trainModelBtn.innerHTML;
    trainModelBtn.innerHTML = `
      <svg class="animate-spin h-5 w-5 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>Scanning Categories & Training Centroids...</span>
    `;

    try {
      const response = await fetch('/train', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Training failed');

      showToast(`Training complete! Retrained on ${data.sample_count} audio files across ${data.species_count} bird species profiles.`, 'success');
      fetchModelStatus();
    } catch (err) {
      showToast(`Training Error: ${err.message}`, 'error');
    } finally {
      trainModelBtn.disabled = false;
      trainModelBtn.innerHTML = origHtml;
    }
  });

  generateSamplesBtn.addEventListener('click', async () => {
    generateSamplesBtn.disabled = true;
    const origText = generateSamplesBtn.textContent;
    generateSamplesBtn.textContent = 'Generating Synthetic Audio...';

    try {
      const response = await fetch('/api/generate-samples', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Generation failed');

      showToast('Synthetic bioacoustic dataset generated! Retraining...', 'info');
      trainModelBtn.click();
    } catch (err) {
      showToast(`Generation Error: ${err.message}`, 'error');
    } finally {
      generateSamplesBtn.disabled = false;
      generateSamplesBtn.textContent = origText;
    }
  });

  // Toast System
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const bg = type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-emerald-200' :
               type === 'error' ? 'bg-rose-900/90 border-rose-500 text-rose-200' :
               'bg-slate-900/90 border-teal-500 text-teal-200';

    toast.className = `flex items-center space-x-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-xl text-xs font-semibold transform transition-all duration-300 translate-y-2 opacity-0 ${bg}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️'}</span>
      <span>${message}</span>
    `;

    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

});
