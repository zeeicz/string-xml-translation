// Display translation status message in the UI
function displayStatus(message) {
  document.querySelector("#line-info").textContent = message;
}

// Append a new message to the translation log area
function appendTranslationLog(message) {
  const logArea = document.querySelector("#translation-log");
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logArea.appendChild(entry);
  logArea.scrollTop = logArea.scrollHeight; // Auto-scroll to the bottom
}

// Validate uploaded XML file
function handleFileValidation() {
  const fileInput = document.getElementById("xmlFile");
  const file = fileInput.files[0];
  const nameDisplay = document.getElementById("fileName");
  const errorMsg = document.getElementById("fileError");
  const infoDisplay = document.getElementById("selectedFileInfo");
  const translateBtn = document.getElementById("translateButton");

  errorMsg.textContent = '';
  translateBtn.disabled = true;

  if (!file) {
    nameDisplay.textContent = 'Choose XML File';
    infoDisplay.style.display = 'none';
    return;
  }

  if (!file.name.endsWith(".xml")) {
    errorMsg.textContent = 'Only XML files are supported.';
    nameDisplay.textContent = 'Choose XML File';
    fileInput.value = '';
    infoDisplay.style.display = 'none';
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    const content = e.target.result;
    try {
      if (!content.includes('<?xml') || !content.includes('<resources>')) {
        throw new Error('The file is not a valid Android strings.xml format.');
      }
      nameDisplay.textContent = file.name;
      infoDisplay.textContent = `Selected File: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
      infoDisplay.style.display = 'block';
      translateBtn.disabled = false;
    } catch (err) {
      errorMsg.textContent = err.message;
      fileInput.value = '';
      nameDisplay.textContent = 'Choose XML File';
      infoDisplay.style.display = 'none';
    }
  };

  reader.readAsText(file);
}

let translationInProgress = false;
let activeXHR = null;

// Upload file and initiate translation process
function startTranslation() {
  if (translationInProgress) {
    alert("Translation is already in progress. Please wait until it completes.");
    return;
  }

  const file = document.getElementById("xmlFile").files[0];
  if (!file) {
    alert("Please select a file before starting translation.");
    return;
  }

  translationInProgress = true;
  activeXHR = new XMLHttpRequest();

  // Reset progress UI
  document.getElementById("progress-bar").style.width = "0%";
  document.getElementById("progress-text").textContent = "0%";
  document.getElementById("line-counter").textContent = "0/0";
  document.getElementById("downloadLink").style.display = "none";
  document.getElementById("refreshPrompt").style.display = "none";
  document.getElementById("translation-log").innerHTML = "";
  document.getElementById("log-container").style.display = "block";

  const formData = new FormData();
  formData.append("file", file);
  formData.append("from", document.getElementById("fromLanguage").value);
  formData.append("to", document.getElementById("toLanguage").value);

  const progressEvents = new EventSource("/translation-progress");

  // Handle translation progress events
  progressEvents.onmessage = event => {
    const { type, current, total, message } = JSON.parse(event.data);

    if (type === "progress") {
      const percent = Math.floor((current / total) * 100);
      document.getElementById("progress-bar").style.width = `${percent}%`;
      document.getElementById("progress-text").textContent = `${percent}%`;
      document.getElementById("line-counter").textContent = `${current} / ${total}`;
      displayStatus(`Translating line ${current} of ${total}`);
    }

    if (type === "log") {
      appendTranslationLog(message);
    }

    if (type === "complete") {
      progressEvents.close();
      document.getElementById("progress-bar").style.width = "100%";
      document.getElementById("progress-text").textContent = "100%";
      document.getElementById("line-counter").textContent = `${total} / ${total}`;
      displayStatus("Translation completed successfully.");
    }
  };

  progressEvents.onerror = () => {
    progressEvents.close();
    console.error("Failed to receive progress updates.");
  };

  activeXHR.open("POST", "/translate");
  activeXHR.responseType = "blob";

  // Handle server response
  activeXHR.onload = () => {
    translationInProgress = false;
    progressEvents.close();

    if (activeXHR.status === 200) {
      const downloadLink = document.getElementById("downloadLink");
      downloadLink.href = URL.createObjectURL(activeXHR.response);
      downloadLink.style.display = "block";
      displayStatus("Translation completed. File is ready for download.");
      document.getElementById("refreshPrompt").style.display = "block";
    } else {
      displayStatus("Translation failed.");
      alert("An error occurred during translation. Please try again.");
    }
  };

  // Monitor upload progress
  activeXHR.upload.onprogress = event => {
    if (event.lengthComputable) {
      const percent = Math.floor((event.loaded / event.total) * 100);
      document.getElementById("progress-bar").style.width = `${percent}%`;
      document.getElementById("progress-text").textContent = `${percent}%`;
      displayStatus(`Uploading... ${percent}% complete`);
    }
  };

  activeXHR.send(formData);
}

// Reload the page to reset the application state
function resetApp() {
  location.reload();
}
