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

  // Chart & Waveform state
  let birdGrades = {};
  let gradeChart = null;
  let micWavesurfer = null;
  let fileWavesurfer = null;
  let currentAudioPoints = [];
  let currentAudioDuration = 0;

  // Registered Birds and Active Profile state
  let registeredBirds = JSON.parse(localStorage.getItem('registeredBirds')) || [];
  let activeBirdId = localStorage.getItem('activeBirdId') || '';
  let resetPassword = localStorage.getItem('resetPassword') || '1234';

  // Live Video & Camera state
  let videoStream = null;
  let videoRecorder = null;
  let videoChunks = [];
  let recordedVideoBlob = null;
  let isCameraActive = false;

  const lineColors = {
    'S+': 'green',
    'A': 'yellow',
    'B': 'maroon',
    'C': 'blue',
    'N/A': 'black'
  };

  const gradeScores = {
    'S+': 100,
    'A': 85,
    'B': 70,
    'C': 50,
    'N/A': 0
  };

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
  const tabLeaderboardBtn = document.getElementById('tab-leaderboard-btn');

  // Mic elements
  const micIdleState = document.getElementById('mic-idle-state');
  const visualizerCanvas = document.getElementById('visualizer-canvas');
  const recTimer = document.getElementById('rec-timer');
  const recordStartBtn = document.getElementById('record-start-btn');
  const recordStopBtn = document.getElementById('record-stop-btn');
  const micPreviewContainer = document.getElementById('mic-preview-container');
  const micPlayBtn = document.getElementById('mic-play-btn');
  const classifyMicBtn = document.getElementById('classify-mic-btn');

  // File upload elements
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const filePreviewContainer = document.getElementById('file-preview-container');
  const selectedFilename = document.getElementById('selected-filename');
  const selectedFilesize = document.getElementById('selected-filesize');
  const filePlayBtn = document.getElementById('file-play-btn');
  const classifyFileBtn = document.getElementById('classify-file-btn');

  // Results elements
  const topMatchCategoryBadge = document.getElementById('top-match-category-badge');
  const topMatchSpecies = document.getElementById('top-match-species');
  const topMatchBadge = document.getElementById('top-match-badge');
  const topMatchSub = document.getElementById('top-match-sub');

  // Score Widget elements
  const audioScoreBadge = document.getElementById('audio-score-badge');

  // Active Bird & Leaderboard elements
  const activeBirdSelect = document.getElementById('active-bird-select');
  const showAddBirdBtn = document.getElementById('show-add-bird-btn');
  const addBirdForm = document.getElementById('add-bird-form');
  const closeAddBirdBtn = document.getElementById('close-add-bird-btn');
  const newBirdName = document.getElementById('new-bird-name');
  const newOwnerName = document.getElementById('new-owner-name');
  const activeBirdBadge = document.getElementById('active-bird-badge');
  const leaderboardList = document.getElementById('leaderboard-list');
  const deleteBirdBtn = document.getElementById('delete-bird-btn');
  const resetScoresBtn = document.getElementById('reset-scores-btn');
  const changePasswordBtn = document.getElementById('change-password-btn');
  const scoreCircleProgress = document.getElementById('score-circle-progress');
  const audioScoreText = document.getElementById('audio-score-text');
  const audioEvaluationRating = document.getElementById('audio-evaluation-rating');
  const scoreDetailsList = document.getElementById('score-details-list');
  const similarityList = document.getElementById('similarity-list');
  const tabCameraBtn = document.getElementById('tab-camera-btn');
  const tabChartBtn = document.getElementById('tab-chart-btn');
  const cameraTabContent = document.getElementById('camera-tab-content');
  const chartTabContent = document.getElementById('chart-tab-content');
  const leaderboardTabContent = document.getElementById('leaderboard-tab-content');
  const audioInputContainer = document.getElementById('audio-input-container');
  const classificationWidgetContainer = document.getElementById('classification-widget-container');
  const scoreWidgetContainer = document.getElementById('score-widget-container');
  // Control buttons
  const trainModelBtn = document.getElementById('train-model-btn');
  const generateSamplesBtn = document.getElementById('generate-samples-btn');
  const toastContainer = document.getElementById('toast-container');

  fetchModelStatus();
  fetchBirdGrades();
  initializeWavesurfer();
  initializeBirdsAndLeaderboard();
  setupCameraToggle();

  // Tab Switcher
  tabMicBtn.addEventListener('click', () => {
    tabMicBtn.className = 'flex-1 text-center py-2 font-semibold text-blue-400 border-b-2 border-blue-400 transition-colors flex items-center justify-center space-x-2';
    tabFileBtn.className = 'flex-1 text-center py-2 font-semibold text-slate-400 hover:text-slate-200 border-b-2 border-transparent transition-colors flex items-center justify-center space-x-2';
    tabMicContent.classList.remove('hidden');
    tabFileContent.classList.add('hidden');
  });

  // tabFileBtn.addEventListener('click', () => {
  //   tabFileBtn.className = 'flex-1 text-center py-2 font-semibold text-emerald-400 border-b-2 border-emerald-400 transition-colors flex items-center justify-center space-x-2';
  //   tabMicBtn.className = 'flex-1 text-center py-2 font-semibold text-slate-400 hover:text-slate-200 border-b-2 border-transparent transition-colors flex items-center justify-center space-x-2';
  //   tabFileContent.classList.remove('hidden');
  //   tabMicContent.classList.add('hidden');
  // });

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
      modelStatusDot.className = 'w-3 h-3 rounded-full bg-blue-500 shadow-sm shadow-blue-500/20';
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
        <span class="bg-blue-950/80 text-blue-300 text-[11px] font-semibold px-2.5 py-1 rounded-md border border-blue-500/20">
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
      // Auto start camera if not active
      if (!isCameraActive) {
        await startCamera(true);
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream);

      // Hide download container at start of recording
      const mediaDownloadContainer = document.getElementById('media-download-container');
      if (mediaDownloadContainer) {
        mediaDownloadContainer.classList.add('hidden');
      }

      // Synchronize Live Video Recording
      if (videoStream) {
        videoChunks = [];
        
        // Combine video tracks from uvicorn camera with audio tracks from uvicorn microphone stream
        const combinedStream = new MediaStream([
          ...videoStream.getVideoTracks(),
          ...stream.getAudioTracks()
        ]);

        let options = { mimeType: 'video/webm;codecs=vp9,opus' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = { mimeType: 'video/webm' };
        }
        try {
          videoRecorder = new MediaRecorder(combinedStream, options);
          videoRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              videoChunks.push(e.data);
            }
          };
            videoRecorder.onstop = () => {
              recordedVideoBlob = new Blob(videoChunks, { type: 'video/webm' });
              const downloadVideoBtn = document.getElementById('download-video-btn');
              if (downloadVideoBtn) {
                downloadVideoBtn.href = URL.createObjectURL(recordedVideoBlob);
                downloadVideoBtn.download = `bird_video_${Date.now()}.webm`;
                updateDownloadFilenames();
              }
            };
          videoRecorder.start();
          document.getElementById('camera-recording-indicator').classList.remove('hidden');
        } catch (recErr) {
          console.error("Failed to start video recorder:", recErr);
        }
      }

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
        
        // Populate audio download button
        const downloadAudioBtn = document.getElementById('download-audio-btn');
        if (downloadAudioBtn) {
          downloadAudioBtn.href = URL.createObjectURL(recordedBlob);
          downloadAudioBtn.download = `bird_audio_${Date.now()}.wav`;
          updateDownloadFilenames();
        }

        micWavesurfer.loadBlob(recordedBlob);
        micPreviewContainer.classList.remove('hidden');
        showToast('Audio recorded successfully!', 'success');
        loadAudioWaveform(recordedBlob);
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
    // Stop video recorder synchronously
    if (videoRecorder && videoRecorder.state !== 'inactive') {
      videoRecorder.stop();
      document.getElementById('camera-recording-indicator').classList.add('hidden');
    }
    // Auto stop camera preview when stopping recording
    stopCamera(true);
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
    fileWavesurfer.loadBlob(file);
    filePreviewContainer.classList.remove('hidden');
    showToast(`Loaded file '${file.name}'`, 'info');
    loadAudioWaveform(file);
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
      tabChartBtn.click();

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
      // topMatchCategoryBadge.textContent = topMatch.category || 'Category';
      // topMatchSpecies.textContent = topMatch.species;
      // topMatchBadge.textContent = topMatch.similarity_score;
      // topMatchSub.textContent = `Match Confidence: ${topMatch.similarity_score} in category '${topMatch.category}'`;
      
      // Color and update the chart based on classification result
      updateChartColorForClassification(data);
    }

    if (allMatches.length > 0) {
      similarityList.innerHTML = allMatches.map(m => {
        const percentageNum = parseFloat(m.similarity.replace('%', '')) || 0;
        const colorClass = percentageNum > 70 ? 'bg-blue-600' :
                           percentageNum > 40 ? 'bg-blue-800/80' :
                           'bg-slate-700';
        const segSpecies = m.species.split('|')[1] || 'Unknown';

        return `
          <div class="space-y-1.5 bg-slate-950/40 p-3 rounded-xl border border-slate-800">
             <div class="flex justify-between text-xs font-semibold items-center">
               <div class="flex flex-col items-left space-x-2 truncate">
                 <span class="text-xs text-blue-400 bg-blue-950/80 border border-blue-500/20 px-1.5 py-0.5 rounded font-mono">${m.category}</span>
                 <span class="text-slate-200 truncate">${segSpecies}</span>
               </div>
               <span class="text-blue-400 font-mono pl-2">${m.similarity}</span>
             </div>
            <div class="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div class="${colorClass} h-2.5 rounded-full transition-all duration-700 ease-out" style="width: ${Math.min(100, Math.max(2, percentageNum))}%"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    // --- Audio Evaluation Scoring Logic ---
    if (data.is_multi && data.segments && data.segments.length > 0) {
      const segments = data.segments;
      let totalScore = 0;
      let count = 0;

      const detailsHtml = segments.map(seg => {
        const gradeInfo = birdGrades[seg.species];
        const grade = gradeInfo ? gradeInfo.grade : 'N/A';
        const baseScore = gradeScores[grade] || 0;
        const percentage = seg.percentage_num !== undefined ? seg.percentage_num : (parseFloat(seg.similarity.replace('%', '')) || 0);
        const roundedPercentage = Math.ceil(percentage);
        const score = Math.round(baseScore * (roundedPercentage / 100));
        
        totalScore += score;
        count += 1;

        let gradeColor = 'text-slate-400';
        if (grade === 'S+') gradeColor = 'text-blue-400';
        else if (grade === 'A') gradeColor = 'text-yellow-400';
        else if (grade === 'B') gradeColor = 'text-rose-400';
        else if (grade === 'C') gradeColor = 'text-blue-400';

        return `
          <div class="flex justify-between items-center bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
            <div class="truncate pr-2">
              <div class="flex items-center space-x-1.5">
                <span class="font-bold text-[10px] text-blue-400 bg-blue-950/80 border border-blue-500/20 px-1 py-0.2 rounded font-mono">SEG ${seg.segment_index}</span>
                <span class="text-[10px] text-slate-400">(${seg.start_time}s - ${seg.end_time}s)</span>
              </div>
              <div class="text-xs font-semibold text-slate-200 mt-1 truncate">${seg.species}</div>
            </div>
            <div class="text-right flex-shrink-0">
              <span class="font-bold font-mono text-sm ${gradeColor}">${grade}</span>
              <div class="text-[12px] text-slate-400 font-semibold font-mono">+${score} pts</div>
              <span class="text-[10px] text-slate-400 font-semibold font-mono">(${baseScore} x ${roundedPercentage}%)</span>
            </div>
          </div>
        `;
      }).join('');

      const finalScore = totalScore;

      // Update progress ring & text labels
      audioScoreBadge.textContent = `${finalScore} pts`;
      audioScoreText.textContent = finalScore;

      // Circumference is 2 * PI * 40 = 251.2
      const displayPercentage = Math.min(100, finalScore);
      const offset = 251.2 - (displayPercentage / 100) * 251.2;
      scoreCircleProgress.style.strokeDashoffset = offset;

      // Evaluation rating and class styling
      let ratingText = 'POOR';
      let ratingClass = 'bg-rose-950/80 text-rose-300 border border-rose-500/20';
      if (finalScore >= 100) {
        ratingText = 'EXCELLENT';
        ratingClass = 'bg-blue-950/80 text-blue-300 border border-blue-500/20';
      } else if (finalScore >= 70) {
        ratingText = 'GOOD';
        ratingClass = 'bg-blue-900/40 text-blue-200 border border-blue-800/20';
      } else if (finalScore >= 45) {
        ratingText = 'FAIR';
        ratingClass = 'bg-blue-950/80 text-blue-300 border border-blue-500/20';
      }

      audioEvaluationRating.textContent = ratingText;
      audioEvaluationRating.className = `text-[10px] font-bold px-2.5 py-0.5 rounded uppercase tracking-wider ${ratingClass}`;

      scoreDetailsList.innerHTML = detailsHtml;

      // --- Save to Active Bird History ---
      if (activeBirdId) {
        const activeBird = registeredBirds.find(b => b.id === activeBirdId);
        if (activeBird) {
          // Push new evaluation history
          activeBird.history.push({
            timestamp: new Date().toISOString(),
            score: finalScore,
            topSpecies: topMatch ? topMatch.species : 'Unknown',
            segmentsCount: segments.length
          });

          // Update highest score if this is a personal best!
          if (finalScore > activeBird.highestScore) {
            activeBird.highestScore = finalScore;
            showToast(`New personal high score for ${activeBird.birdName}! 🎉`, 'success');
          }

          saveBirdsToStorage();
          renderLeaderboard();
        }
      }
    } else {
      // Reset score widget if no multi-class data
      audioScoreBadge.textContent = '0 pts';
      audioScoreText.textContent = '0';
      scoreCircleProgress.style.strokeDashoffset = 251.2;
      audioEvaluationRating.textContent = 'No Evaluation';
      audioEvaluationRating.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase tracking-wider';
      scoreDetailsList.innerHTML = '<p class="text-slate-500 italic text-center py-2">Evaluate audio to view breakdown details.</p>';
    }

    // --- Show Download recorded media buttons if applicable ---
    const mediaDownloadContainer = document.getElementById('media-download-container');
    if (mediaDownloadContainer) {
      if (recordedBlob || recordedVideoBlob) {
        mediaDownloadContainer.classList.remove('hidden');
      } else {
        mediaDownloadContainer.classList.add('hidden');
      }
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
      fetchBirdGrades();
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

  // Fetch bird grades and render the chart
  async function fetchBirdGrades() {
    try {
      const response = await fetch('/static/bird_grades.json');
      if (!response.ok) throw new Error('Failed to fetch bird grades');
      birdGrades = await response.json();
      initializeChart();
    } catch (err) {
      console.error("Error loading bird grades JSON:", err);
    }
  }

  function initializeChart() {
    const canvas = document.getElementById('grade-duration-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (gradeChart) {
      gradeChart.destroy();
    }

    gradeChart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label: 'Wave Strength',
          data: [], // Starts empty
          borderColor: '#64748b', // Slate gray default
          backgroundColor: 'rgba(100, 116, 139, 0.1)',
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'linear',
            title: {
              display: true,
              text: 'Sound Length (seconds)',
              color: '#94a3b8',
              font: {
                weight: 'semibold'
              }
            },
            grid: {
              color: '#334155',
              borderColor: '#334155'
            },
            ticks: {
              color: '#94a3b8'
            }
          },
          y: {
            min: 0,
            max: 1.1,
            title: {
              display: true,
              text: 'Wave Strength',
              color: '#94a3b8',
              font: {
                weight: 'semibold'
              }
            },
            grid: {
              color: '#334155',
              borderColor: '#334155'
            },
            ticks: {
              color: '#94a3b8'
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            labels: {
              color: '#f8fafc'
            }
          },
          tooltip: {
            enabled: true,
            callbacks: {
              label: function(context) {
                return ` Strength: ${context.parsed.y} at ${context.parsed.x}s`;
              }
            }
          }
        }
      }
    });
  }

  async function loadAudioWaveform(blobOrFile) {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    try {
      const arrayBuffer = await blobOrFile.arrayBuffer();
      const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const channelData = decodedBuffer.getChannelData(0);
      const numPoints = 150;
      const step = Math.floor(channelData.length / numPoints);
      const dataPoints = [];
      const duration = decodedBuffer.duration;

      for (let i = 0; i < numPoints; i++) {
        const start = i * step;
        let maxVal = 0;
        for (let j = 0; j < step; j++) {
          const val = Math.abs(channelData[start + j]);
          if (val > maxVal) maxVal = val;
        }
        const time = (start / channelData.length) * duration;
        dataPoints.push({ x: Number(time.toFixed(2)), y: Number(maxVal.toFixed(3)) });
      }

      currentAudioPoints = dataPoints;
      currentAudioDuration = duration;

      if (gradeChart) {
        gradeChart.data.datasets = [{
          label: 'Wave Strength',
          data: dataPoints,
          borderColor: '#64748b', // Reset to default gray
          backgroundColor: 'rgba(100, 116, 139, 0.1)',
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          tension: 0.3
        }];
        
        gradeChart.options.scales.x.max = Number(duration.toFixed(2));
        gradeChart.update();
      }
    } catch (err) {
      console.error("Error decoding audio for chart:", err);
    }
  }

  function updateChartColorForClassification(data) {
    if (!gradeChart || !data) return;

    const topMatch = data.top_match;
    const segments = data.segments || [];

    if (segments.length > 0 && currentAudioPoints.length > 0) {
      // Build segmented multi-line datasets!
      const datasets = [];
      let lastEndTime = 0.0;

      segments.forEach(seg => {
        // 1. If there's a silent gap, insert a Gap dataset
        if (seg.start_time > lastEndTime + 0.1) {
          const gapPoints = currentAudioPoints.filter(p => p.x >= lastEndTime && p.x <= seg.start_time);
          if (gapPoints.length > 0) {
            datasets.push({
              label: 'Silence / Gap',
              data: gapPoints,
              borderColor: '#475569', // Slate-600
              backgroundColor: 'rgba(71, 85, 105, 0.05)',
              borderWidth: 1.5,
              pointRadius: 0,
              fill: true,
              tension: 0.3
            });
          }
        }

        // 2. Add the segment dataset colored by grade
        const grade = birdGrades[seg.species] ? birdGrades[seg.species].grade : 'N/A';
        const color = lineColors[grade] || '#64748b';
        let fillBg = 'rgba(100, 116, 139, 0.1)';
        if (color === 'green') fillBg = 'rgba(16, 185, 129, 0.1)';
        else if (color === 'yellow') fillBg = 'rgba(245, 158, 11, 0.1)';
        else if (color === 'maroon') fillBg = 'rgba(128, 0, 0, 0.1)';
        else if (color === 'blue') fillBg = 'rgba(59, 130, 246, 0.1)';
        else if (color === 'black') fillBg = 'rgba(0, 0, 0, 0.15)';

        const segPoints = currentAudioPoints.filter(p => p.x >= seg.start_time && p.x <= seg.end_time);
        if (segPoints.length > 0) {
          datasets.push({
            label: `Seg ${seg.segment_index} (${seg.start_time}s-${seg.end_time}s): ${seg.species} [Grade ${grade}]`,
            data: segPoints,
            borderColor: color,
            backgroundColor: fillBg,
            borderWidth: 2.5,
            pointRadius: 0,
            fill: true,
            tension: 0.3
          });
        }

        lastEndTime = seg.end_time;
      });

      // 3. If there is a trailing gap, add it
      if (lastEndTime < currentAudioDuration) {
        const trailingPoints = currentAudioPoints.filter(p => p.x >= lastEndTime && p.x <= currentAudioDuration);
        if (trailingPoints.length > 0) {
          datasets.push({
            label: 'Silence / Gap',
            data: trailingPoints,
            borderColor: '#475569',
            backgroundColor: 'rgba(71, 85, 105, 0.05)',
            borderWidth: 1.5,
            pointRadius: 0,
            fill: true,
            tension: 0.3
          });
        }
      }

      gradeChart.data.datasets = datasets;
      gradeChart.update();
    } else if (topMatch) {
      // Fallback single line coloring
      const speciesName = topMatch.species;
      const matchedInfo = birdGrades[speciesName];
      const grade = matchedInfo ? matchedInfo.grade : 'N/A';
      const color = lineColors[grade] || '#64748b';

      gradeChart.data.datasets = [{
        label: `Wave Strength (Grade ${grade} - ${speciesName})`,
        data: currentAudioPoints,
        borderColor: color,
        backgroundColor: color === 'green' ? 'rgba(16, 185, 129, 0.1)' :
                         color === 'yellow' ? 'rgba(245, 158, 11, 0.1)' :
                         color === 'maroon' ? 'rgba(128, 0, 0, 0.1)' :
                         color === 'blue' ? 'rgba(59, 130, 246, 0.1)' :
                         color === 'black' ? 'rgba(0, 0, 0, 0.15)' :
                         'rgba(100, 116, 139, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        tension: 0.3
      }];
      gradeChart.update();
    }
  }

  function initializeWavesurfer() {
    micWavesurfer = WaveSurfer.create({
      container: '#mic-waveform',
      waveColor: '#475569',
      progressColor: '#10b981',
      cursorColor: '#34d399',
      cursorWidth: 2,
      barWidth: 3,
      barGap: 3,
      barRadius: 3,
      height: 64,
      responsive: true
    });

    fileWavesurfer = WaveSurfer.create({
      container: '#file-waveform',
      waveColor: '#475569',
      progressColor: '#0d9488',
      cursorColor: '#2dd4bf',
      cursorWidth: 2,
      barWidth: 3,
      barGap: 3,
      barRadius: 3,
      height: 64,
      responsive: true
    });

    // Configure Play buttons
    micPlayBtn.addEventListener('click', () => {
      micWavesurfer.playPause();
    });

    filePlayBtn.addEventListener('click', () => {
      fileWavesurfer.playPause();
    });

    // Update button text or state on play/pause
    micWavesurfer.on('play', () => { micPlayBtn.textContent = '❚❚'; });
    micWavesurfer.on('pause', () => { micPlayBtn.textContent = '▶'; });

    fileWavesurfer.on('play', () => { filePlayBtn.textContent = '❚❚'; });
    fileWavesurfer.on('pause', () => { filePlayBtn.textContent = '▶'; });
  }

  // Toast System
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const bg = type === 'success' ? 'bg-blue-900/90 border-blue-500 text-blue-200' :
               type === 'error' ? 'bg-rose-900/90 border-rose-500 text-rose-200' :
               'bg-slate-900/90 border-blue-800 text-blue-200';

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

  function initializeBirdsAndLeaderboard() {
    // 1. Render dropdown and rankings list
    renderBirdSelect();
    renderLeaderboard();
    updateActiveBirdUI();

    // 2. Add Bird Form handlers
    showAddBirdBtn.addEventListener('click', () => {
      addBirdForm.classList.remove('hidden');
    });

    closeAddBirdBtn.addEventListener('click', () => {
      addBirdForm.classList.add('hidden');
      addBirdForm.reset();
    });

    addBirdForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const birdName = newBirdName.value.trim();
      const ownerName = newOwnerName.value.trim();

      if (birdName && ownerName) {
        // Create new bird profile
        const newBird = {
          id: 'bird_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          birdName: birdName,
          ownerName: ownerName,
          highestScore: 0,
          history: []
        };

        registeredBirds.push(newBird);
        activeBirdId = newBird.id;
        
        saveBirdsToStorage();
        renderBirdSelect();
        renderLeaderboard();
        updateActiveBirdUI();

        // Reset and hide form
        addBirdForm.reset();
        addBirdForm.classList.add('hidden');
        showToast(`Profile for '${birdName}' created & activated!`, 'success');
      }
    });

    // 3. Dropdown Selection handler
    activeBirdSelect.addEventListener('change', (e) => {
      activeBirdId = e.target.value;
      saveBirdsToStorage();
      updateActiveBirdUI();
      renderLeaderboard();
    });

    // 4. Delete active bird profile handler
    deleteBirdBtn.addEventListener('click', () => {
      if (!activeBirdId) {
        showToast('Please select a bird profile to delete.', 'error');
        return;
      }

      const activeBird = registeredBirds.find(b => b.id === activeBirdId);
      if (!activeBird) return;

      const confirmDelete = confirm(`Are you sure you want to delete profile '${activeBird.birdName}'? This cannot be undone.`);
      if (confirmDelete) {
        registeredBirds = registeredBirds.filter(b => b.id !== activeBirdId);
        activeBirdId = '';

        saveBirdsToStorage();
        renderBirdSelect();
        renderLeaderboard();
        updateActiveBirdUI();
        showToast('Profile deleted successfully.', 'success');
      }
    });

    // 5. Reset scores handler (Requires password verification)
    resetScoresBtn.addEventListener('click', () => {
      if (registeredBirds.length === 0) {
        showToast('No registered bird profiles to reset.', 'error');
        return;
      }

      const passwordInput = prompt('Enter reset password to clear all leaderboards and history records:');
      if (passwordInput === null) return; // cancelled

      if (passwordInput === resetPassword) {
        registeredBirds.forEach(bird => {
          bird.highestScore = 0;
          bird.history = [];
        });

        saveBirdsToStorage();
        renderLeaderboard();
        showToast('Leaderboard and evaluation histories reset successfully.', 'success');
      } else {
        showToast('Incorrect reset password! Operation aborted.', 'error');
      }
    });

    // 6. Change reset password handler
    changePasswordBtn.addEventListener('click', () => {
      const currentInput = prompt('Enter current password to verify identity:');
      if (currentInput === null) return;

      if (currentInput === resetPassword) {
        const newPass = prompt('Enter new reset password:');
        if (!newPass) {
          showToast('New password cannot be empty.', 'error');
          return;
        }
        
        resetPassword = newPass;
        localStorage.setItem('resetPassword', resetPassword);
        showToast('Reset password changed successfully.', 'success');
      } else {
        showToast('Incorrect password verification! Operation aborted.', 'error');
      }
    });
  }

  function saveBirdsToStorage() {
    localStorage.setItem('registeredBirds', JSON.stringify(registeredBirds));
    localStorage.setItem('activeBirdId', activeBirdId);
  }

  function renderBirdSelect() {
    // Keep first option
    activeBirdSelect.innerHTML = '<option value="">-- Select Active Bird --</option>';
    registeredBirds.forEach(bird => {
      const option = document.createElement('option');
      option.value = bird.id;
      option.textContent = `${bird.birdName} (${bird.ownerName})`;
      if (bird.id === activeBirdId) {
        option.selected = true;
      }
      activeBirdSelect.appendChild(option);
    });
  }

  function updateActiveBirdUI() {
    const activeBird = registeredBirds.find(b => b.id === activeBirdId);
    if (activeBird) {
      activeBirdBadge.textContent = `${activeBird.birdName}`;
      activeBirdBadge.className = 'bg-blue-500/20 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-500/30';
    } else {
      activeBirdBadge.textContent = 'None Selected';
      activeBirdBadge.className = 'bg-rose-500/20 text-rose-300 text-[10px] font-bold px-2 py-0.5 rounded border border-rose-500/30';
      activeBirdId = ''; // clean up null state
    }
    updateDownloadFilenames();
  }

  function updateDownloadFilenames() {
    const downloadAudioBtn = document.getElementById('download-audio-btn');
    const downloadVideoBtn = document.getElementById('download-video-btn');
    
    let filenamePrefix = 'bird';
    const activeBird = registeredBirds.find(b => b.id === activeBirdId);
    if (activeBird) {
      const cleanBirdName = activeBird.birdName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const cleanOwnerName = activeBird.ownerName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      filenamePrefix = `${cleanBirdName}_${cleanOwnerName}`;
    }

    if (downloadAudioBtn && downloadAudioBtn.download) {
      const currentDownloadName = downloadAudioBtn.download;
      const extension = currentDownloadName.endsWith('.wav') ? '.wav' : '.wav';
      const timestampMatch = currentDownloadName.match(/\d+/);
      const timestamp = timestampMatch ? timestampMatch[0] : Date.now();
      downloadAudioBtn.download = `${filenamePrefix}_audio_${timestamp}${extension}`;
    }
    
    if (downloadVideoBtn && downloadVideoBtn.download) {
      const currentDownloadName = downloadVideoBtn.download;
      const extension = currentDownloadName.endsWith('.webm') ? '.webm' : '.webm';
      const timestampMatch = currentDownloadName.match(/\d+/);
      const timestamp = timestampMatch ? timestampMatch[0] : Date.now();
      downloadVideoBtn.download = `${filenamePrefix}_video_${timestamp}${extension}`;
    }
  }

  function renderLeaderboard() {
    if (registeredBirds.length === 0) {
      leaderboardList.innerHTML = '<p class="text-slate-500 italic text-center py-4">No birds registered yet.</p>';
      return;
    }

    // Sort by highest score descending
    const sorted = [...registeredBirds].sort((a, b) => b.highestScore - a.highestScore);

    leaderboardList.innerHTML = sorted.map((bird, idx) => {
      const isSelect = bird.id === activeBirdId;
      const selectClass = isSelect ? 'border-blue-500/40 bg-blue-950/20' : 'border-slate-800/80 bg-slate-900/30';
      const selectBadge = isSelect ? '<span class="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded font-semibold font-mono flex-shrink-0">ACTIVE</span>' : '';
      
      let rankIcon = `#${idx + 1}`;
      let rankColor = 'text-slate-400';
      if (idx === 0) {
        rankIcon = '🏆';
        rankColor = 'text-yellow-400 font-bold';
      } else if (idx === 1) {
        rankIcon = '🥈';
        rankColor = 'text-slate-200 font-bold';
      } else if (idx === 2) {
        rankIcon = '🥉';
        rankColor = 'text-amber-600 font-bold';
      }

      return `
        <div class="flex justify-between items-center p-2.5 rounded-xl border transition-all duration-300 ${selectClass}">
          <div class="flex items-center space-x-2.5 min-w-0">
            <span class="text-xs font-mono w-6 text-center ${rankColor}">${rankIcon}</span>
            <div class="truncate">
              <div class="font-bold text-slate-200 truncate flex items-center space-x-1.5">
                <span class="truncate">${bird.birdName}</span>
                ${selectBadge}
              </div>
              <div class="text-[10px] text-slate-400 truncate">Owner: ${bird.ownerName}</div>
            </div>
          </div>
          <div class="text-right flex-shrink-0">
            <div class="text-xs font-bold font-mono text-blue-400">${bird.highestScore} pts</div>
            <div class="text-[9px] text-slate-500 font-semibold font-mono">${bird.history.length} eval</div>
          </div>
        </div>
      `;
    }).join('');
  }

  async function startCamera(silent = false) {
    const toggleCameraBtn = document.getElementById('toggle-camera-btn');
    const cameraVideo = document.getElementById('camera-preview');
    const cameraPlaceholder = document.getElementById('camera-placeholder');

    if (!isCameraActive) {
      if (cameraPlaceholder) {
        cameraPlaceholder.innerHTML = `
          <svg class="w-8 h-8 text-blue-400 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="text-xs font-semibold text-blue-400 mt-2">Requesting Camera Access...</span>
        `;
      }

      try {
        // Request video stream only to avoid microphone permission conflicts/errors
        try {
          videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
          });
        } catch (firstErr) {
          videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
        
        if (cameraVideo) {
          cameraVideo.srcObject = videoStream;
        }
        if (cameraPlaceholder) {
          cameraPlaceholder.classList.remove('flex');
          cameraPlaceholder.classList.add('hidden');
        }
        
        isCameraActive = true;
        if (toggleCameraBtn) {
          toggleCameraBtn.innerHTML = `<span>🛑 Stop Camera</span>`;
          toggleCameraBtn.className = "bg-rose-950/40 hover:bg-rose-900/50 text-rose-400 border border-rose-900/30 rounded-lg py-1.5 px-3 text-xs font-semibold transition-all shadow";
        }
        if (!silent) {
          showToast('Camera started successfully.', 'success');
        }
      } catch (err) {
        console.error("Camera access error:", err);
        if (!silent) {
          showToast('Camera access denied or unavailable.', 'error');
        }
        if (cameraPlaceholder) {
          cameraPlaceholder.classList.remove('hidden');
          cameraPlaceholder.classList.add('flex');
          cameraPlaceholder.innerHTML = `
            <svg class="w-8 h-8 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <span class="text-xs font-semibold text-rose-400 text-center px-4">Camera Disabled / Blocked</span>
          `;
        }
      }
    }
  }

  function stopCamera(silent = false) {
    const toggleCameraBtn = document.getElementById('toggle-camera-btn');
    const cameraVideo = document.getElementById('camera-preview');
    const cameraPlaceholder = document.getElementById('camera-placeholder');

    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      videoStream = null;
    }
    if (cameraVideo) {
      cameraVideo.srcObject = null;
    }
    if (cameraPlaceholder) {
      cameraPlaceholder.classList.remove('hidden');
      cameraPlaceholder.classList.add('flex');
      cameraPlaceholder.innerHTML = `
        <svg class="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
        </svg>
        <span class="text-xs font-semibold text-slate-500">Camera Preview Off</span>
      `;
    }
    
    isCameraActive = false;
    if (toggleCameraBtn) {
      toggleCameraBtn.innerHTML = `<span>📹 Start Camera</span>`;
      toggleCameraBtn.className = "bg-slate-900 hover:bg-slate-850 text-blue-400 text-xs font-semibold py-1.5 px-3 rounded-lg border border-slate-800 hover:border-blue-500/30 transition-all flex items-center space-x-1.5 shadow";
    }
    if (!silent) {
      showToast('Camera stopped.', 'info');
    }
  }

  function setupCameraToggle() {
    const toggleCameraBtn = document.getElementById('toggle-camera-btn');
    if (!toggleCameraBtn) return;

    toggleCameraBtn.addEventListener('click', async () => {
      if (!isCameraActive) {
        await startCamera();
      } else {
        stopCamera();
      }
    });
  }

  // Camera & Chart Tab Switcher inside Source Section
  if (tabCameraBtn && tabChartBtn && cameraTabContent && chartTabContent && leaderboardTabContent) {
    tabCameraBtn.addEventListener('click', () => {
      // Set active styles
      tabCameraBtn.className = 'text-sm font-semibold text-blue-400 border-b-2 border-blue-400 pb-1 transition-colors flex items-center space-x-1.5';
      tabChartBtn.className = 'text-sm font-semibold text-slate-400 hover:text-slate-200 border-b-2 border-transparent pb-1 transition-colors flex items-center space-x-1.5';
      tabLeaderboardBtn.className = 'text-sm font-semibold text-slate-400 hover:text-slate-200 border-b-2 border-transparent pb-1 transition-colors flex items-center space-x-1.5';
      
      // Toggle visibility
      cameraTabContent.classList.remove('hidden');
      audioInputContainer.classList.remove('hidden');
      chartTabContent.classList.add('hidden');
      leaderboardTabContent.classList.add('hidden');
      // classificationWidgetContainer.classList.add('hidden');
      scoreWidgetContainer.classList.add('hidden');
    });

    tabChartBtn.addEventListener('click', () => {
      // Set active styles
      tabChartBtn.className = 'text-sm font-semibold text-blue-400 border-b-2 border-blue-400 pb-1 transition-colors flex items-center space-x-1.5';
      tabCameraBtn.className = 'text-sm font-semibold text-slate-400 hover:text-slate-200 border-b-2 border-transparent pb-1 transition-colors flex items-center space-x-1.5';
      tabLeaderboardBtn.className = 'text-sm font-semibold text-slate-400 hover:text-slate-200 border-b-2 border-transparent pb-1 transition-colors flex items-center space-x-1.5';
      
      // Toggle visibility
      chartTabContent.classList.remove('hidden');
      cameraTabContent.classList.add('hidden');
      leaderboardTabContent.classList.add('hidden');
      // classificationWidgetContainer.classList.remove('hidden');
      scoreWidgetContainer.classList.remove('hidden');
      audioInputContainer.classList.add('hidden');
      
      // Resize and update Chart.js canvas to ensure it fits uvicorn newly visible flex/aspect-ratio layout
      if (gradeChart) {
        gradeChart.resize();
        gradeChart.update();
      }
    });

    tabLeaderboardBtn.addEventListener('click', () => {
      // Set active styles
      tabLeaderboardBtn.className = 'text-sm font-semibold text-blue-400 border-b-2 border-blue-400 pb-1 transition-colors flex items-center space-x-1.5';
      tabCameraBtn.className = 'text-sm font-semibold text-slate-400 hover:text-slate-200 border-b-2 border-transparent pb-1 transition-colors flex items-center space-x-1.5';
      tabChartBtn.className = 'text-sm font-semibold text-slate-400 hover:text-slate-200 border-b-2 border-transparent pb-1 transition-colors flex items-center space-x-1.5';
      leaderboardTabContent.classList.remove('hidden');
      chartTabContent.classList.add('hidden');
      cameraTabContent.classList.add('hidden');
      // classificationWidgetContainer.classList.remove('hidden');
      scoreWidgetContainer.classList.remove('hidden');
      audioInputContainer.classList.add('hidden');
    });
  }

  // Theme Switcher Logic
  const themeSwitchBtn = document.getElementById('theme-switch-btn');
  if (themeSwitchBtn) {
    // Load initial theme from localStorage
    const savedTheme = localStorage.getItem('theme-color') || 'blue';
    if (savedTheme === 'green') {
      document.body.classList.add('theme-green');
      themeSwitchBtn.innerHTML = '<span>🎨 Green Theme</span>';
    } else {
      document.body.classList.remove('theme-green');
      themeSwitchBtn.innerHTML = '<span>🎨 Blue Theme</span>';
    }

    themeSwitchBtn.addEventListener('click', () => {
      if (document.body.classList.contains('theme-green')) {
        document.body.classList.remove('theme-green');
        themeSwitchBtn.innerHTML = '<span>🎨 Blue Theme</span>';
        localStorage.setItem('theme-color', 'blue');
        showToast('Switched to Blue Theme (Trust Theme)', 'info');
      } else {
        document.body.classList.add('theme-green');
        themeSwitchBtn.innerHTML = '<span>🎨 Green Theme</span>';
        localStorage.setItem('theme-color', 'green');
        showToast('Switched to Green Theme (Nature Theme)', 'info');
      }
    });
  }

});
