function updateStatusText(message) {
  document.getElementById("line-info").textContent = message;
}

// Function to update translation log
function updateTranslationLog(logMessage) {
  const logContainer = document.getElementById("translation-log");
  const logEntry = document.createElement("div");
  logEntry.className = "log-entry";
  logEntry.textContent = logMessage;
  logContainer.appendChild(logEntry);
  
  // Auto-scroll to the bottom of the log
  logContainer.scrollTop = logContainer.scrollHeight;
}

function validateFile() {
  const fileInput = document.getElementById('xmlFile');
  const fileNameDisplay = document.getElementById('fileName');
  const fileError = document.getElementById('fileError');
  const fileInfoDisplay = document.getElementById('selectedFileInfo');
  const translateButton = document.getElementById('translateButton');
  
  fileError.textContent = '';
  translateButton.disabled = true;
  
  if (!fileInput.files.length) {
    fileNameDisplay.textContent = 'Choose XML File';
    fileInfoDisplay.style.display = 'none';
    return;
  }
  
  const file = fileInput.files[0];
  if (!file.name.endsWith('.xml')) {
    fileError.textContent = 'Please upload an XML file (.xml)';
    fileNameDisplay.textContent = 'Choose XML File';
    fileInput.value = '';
    fileInfoDisplay.style.display = 'none';
    return;
  }
  
  const reader = new FileReader();
  reader.onload = e => {
    try {
      if (!e.target.result.includes('<?xml') && !e.target.result.includes('<resources>')) {
        throw new Error('Invalid XML');
      }
      fileNameDisplay.textContent = file.name;
      fileInfoDisplay.textContent = `Selected: ${file.name} (${(file.size/1024).toFixed(2)} KB)`;
      fileInfoDisplay.style.display = 'block';
      translateButton.disabled = false;
    } catch {
      fileError.textContent = 'Invalid Android strings.xml';
      fileNameDisplay.textContent = 'Choose XML File';
      fileInput.value = '';
      fileInfoDisplay.style.display = 'none';
    }
  };
  reader.readAsText(file);
}

let isTranslating = false;
let currentXHR = null;

function uploadFile() {
  if (isTranslating) {
    alert('Please wait for the current translation to complete');
    return;
  }
  
  const file = document.getElementById('xmlFile').files[0];
  if (!file) return alert("Please choose a file!");

  isTranslating = true;
  document.getElementById("progress-bar").style.width = "0%";
  document.getElementById("progress-text").textContent = "0%";
  document.getElementById("line-counter").textContent = "0/0";
  document.getElementById('downloadLink').style.display = 'none';
  document.getElementById('refreshPrompt').style.display = 'none';
  
  // Clear previous log entries
  document.getElementById("translation-log").innerHTML = "";
  // Show log container
  document.getElementById("log-container").style.display = "block";

  const formData = new FormData();
  formData.append("file", file);
  formData.append("from", document.getElementById('fromLanguage').value);
  formData.append("to", document.getElementById('toLanguage').value);

  const xhr = new XMLHttpRequest();
  currentXHR = xhr;
  
  // Set up event source for progress updates
  const eventSource = new EventSource("/translation-progress");
  
  eventSource.onmessage = function(event) {
    const data = JSON.parse(event.data);
    
    if (data.type === "progress") {
      // Update progress bar
      const percent = Math.floor(data.current / data.total * 100);
      document.getElementById("progress-bar").style.width = percent + "%";
      document.getElementById("progress-text").textContent = percent + "%";
      
      // Update line counter
      document.getElementById("line-counter").textContent = `${data.current} / ${data.total}`;
      updateStatusText(`Translating line ${data.current} of ${data.total}`);
    } 
    else if (data.type === "log") {
      // Add to translation log
      updateTranslationLog(data.message);
    }
    else if (data.type === "complete") {
      // Clean up when done
      eventSource.close();
      document.getElementById("progress-bar").style.width = "100%";
      document.getElementById("progress-text").textContent = "100%";
      document.getElementById("line-counter").textContent = `${data.total} / ${data.total}`;
      updateStatusText("Translation complete!");
    }
  };
  
  eventSource.onerror = function() {
    eventSource.close();
    console.error("EventSource failed");
  };

  xhr.responseType = 'blob';
  xhr.open("POST", "/translate", true);

  xhr.onload = function() {
    isTranslating = false;
    currentXHR = null;
    eventSource.close();
    
    if (xhr.status === 200) {
      const link = document.getElementById('downloadLink');
      link.href = URL.createObjectURL(xhr.response);
      link.style.display = 'block';
      document.getElementById("progress-bar").style.width = "100%";
      document.getElementById("progress-text").textContent = "100%";
      updateStatusText("File ready for download");
      document.getElementById('refreshPrompt').style.display = 'block';
    } else {
      updateStatusText("Translation failed");
      alert("Translation failed. Please try again.");
    }
  };

  xhr.upload.onprogress = e => {
    if (e.lengthComputable) {
      const percent = Math.floor((e.loaded / e.total) * 100);
      document.getElementById("progress-bar").style.width = percent + "%";
      document.getElementById("progress-text").textContent = percent + "%";
      updateStatusText(`Uploading... ${percent}% complete`);
    }
  };

  xhr.send(formData);
}

function refreshPage() {
  location.reload();
}